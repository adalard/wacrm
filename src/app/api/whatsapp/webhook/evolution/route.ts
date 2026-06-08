import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone, phonesMatch } from '@/lib/whatsapp/phone-utils'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { dispatchExternalWebhook } from '@/lib/api/webhooks'

// Lazy-initialized admin Supabase client to bypass RLS for webhooks
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

// Map Baileys status values to our database statuses
const STATUS_MAP: Record<number, string> = {
  0: 'sent',       // ERROR -> fallback
  1: 'sent',       // PENDING
  2: 'sent',       // SERVER_ACK / SENT
  3: 'delivered',  // DELIVERY_ACK / DELIVERED
  4: 'read',       // READ
  5: 'read',       // PLAYED (for audio messages)
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const payload = JSON.parse(rawBody)

    const event = payload.event || payload.type
    const instance = payload.instance

    if (!event || !instance) {
      return NextResponse.json({ error: 'Invalid event payload' }, { status: 400 })
    }

    // Process webhook asynchronously so we ack immediately to avoid timeouts
    processEvolutionWebhook(event, instance, payload).catch((err) => {
      console.error('[webhook/evolution] Error processing event:', err)
    })

    return NextResponse.json({ status: 'received' }, { status: 200 })
  } catch (error) {
    console.error('[webhook/evolution] Error parsing body:', error)
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
}

async function processEvolutionWebhook(event: string, instance: string, payload: any) {
  const db = supabaseAdmin()

  // 1) Find the active user config by Evolution instance name
  const { data: config, error: configError } = await db
    .from('whatsapp_config')
    .select('*')
    .eq('evolution_instance_name', instance)
    .maybeSingle()

  if (configError || !config) {
    console.warn(`[webhook/evolution] No config found for instance: ${instance}`)
    return
  }

  const userId = config.user_id

  // 2) Route events
  if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT' || event === 'SEND_MESSAGE') {
    const data = payload.data
    if (!data) return

    const key = data.key
    if (!key) return

    const fromMe = key.fromMe === true
    const messageId = key.id
    const senderJid = key.remoteJid || ''

    if (!senderJid || senderJid.endsWith('@g.us')) {
      // Ignore group chats to prevent CRM pollution
      return
    }

    const rawPhone = senderJid.split('@')[0]
    const senderPhone = normalizePhone(rawPhone)

    // Handle inbound OR outbound sync
    if (fromMe) {
      // Synchronize messages sent from the agent's phone directly
      await syncOutboundMessage(db, userId, senderPhone, messageId, data)
    } else {
      // Process incoming customer message
      const pushName = data.pushName || 'WhatsApp Contact'
      await handleInboundMessage(db, userId, senderPhone, pushName, messageId, data)
    }
  } else if (event === 'messages.update' || event === 'MESSAGES_UPDATE') {
    const data = payload.data
    if (!data) return

    const messageId = data.key?.id
    const statusVal = data.status

    if (messageId && statusVal !== undefined) {
      await handleStatusReceipt(db, messageId, statusVal)
    }
  }
}

// ============================================================
// Event Handlers
// ============================================================

async function handleInboundMessage(
  db: any,
  userId: string,
  phone: string,
  pushName: string,
  messageId: string,
  data: any
) {
  // Find or create contact
  const contactOutcome = await findOrCreateContact(db, userId, phone, pushName)
  if (!contactOutcome) return
  const contact = contactOutcome.contact

  // Find or create conversation
  const conversation = await findOrCreateConversation(db, userId, contact.id)
  if (!conversation) return

  // Parse message content
  const { contentText, mediaUrl, contentType } = parseEvolutionMessageContent(data, messageId)

  // Verify that we haven't already inserted this message (deduplication)
  const { data: existing } = await db
    .from('messages')
    .select('id')
    .eq('message_id', messageId)
    .maybeSingle()

  if (existing) {
    console.log(`[webhook/evolution] Message ${messageId} already exists, skipping insert`)
    return
  }

  // Count prior customer messages
  const { count: priorMsgCount } = await db
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id)
    .eq('sender_type', 'customer')

  const isFirstInbound = (priorMsgCount ?? 0) === 0

  // Insert message into DB
  const { data: insertedMsg, error: insertError } = await db.from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'customer',
    content_type: contentType,
    content_text: contentText,
    media_url: mediaUrl,
    message_id: messageId,
    status: 'delivered',
    created_at: new Date((data.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
  }).select().single()

  if (insertError || !insertedMsg) {
    console.error('[webhook/evolution] Failed to insert inbound message:', insertError)
    return
  }

  // Trigger external webhook
  void dispatchExternalWebhook(userId, 'message.received', {
    id: insertedMsg.id,
    conversation_id: conversation.id,
    sender_type: 'customer',
    content_type: contentType,
    content_text: contentText,
    media_url: mediaUrl,
    message_id: messageId,
    status: 'delivered',
    created_at: insertedMsg.created_at,
    phone: phone,
  })

  // Update conversation unread counts and last message
  await db
    .from('conversations')
    .update({
      last_message_text: contentText || `[${contentType}]`,
      last_message_at: new Date().toISOString(),
      unread_count: (conversation.unread_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id)

  // Update broadcast reply tracking if contact replied to a recent campaign
  await flagBroadcastReplyIfAny(db, userId, contact.id)

  // Trigger automation runs
  const triggers: ('new_contact_created' | 'first_inbound_message' | 'new_message_received' | 'keyword_match')[] = [
    'new_message_received',
    'keyword_match',
  ]
  if (contactOutcome.wasCreated) triggers.unshift('new_contact_created')
  if (isFirstInbound) triggers.unshift('first_inbound_message')

  const inboundText = contentText || ''
  for (const triggerType of triggers) {
    runAutomationsForTrigger({
      userId,
      triggerType,
      contactId: contact.id,
      context: {
        message_text: inboundText,
        conversation_id: conversation.id,
      },
    }).catch((err) => console.error(`[webhook/evolution/automation] Trigger ${triggerType} failed:`, err))
  }
}

async function syncOutboundMessage(db: any, userId: string, phone: string, messageId: string, data: any) {
  // Look up contact
  const { data: contacts } = await db
    .from('contacts')
    .select('*')
    .eq('user_id', userId)

  const contact = contacts?.find((c: any) => phonesMatch(c.phone, phone))
  if (!contact) return

  // Find conversation
  const { data: conversation } = await db
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('contact_id', contact.id)
    .maybeSingle()

  if (!conversation) return

  // Verify we haven't logged this already
  const { data: existing } = await db
    .from('messages')
    .select('id')
    .eq('message_id', messageId)
    .maybeSingle()

  if (existing) return

  const { contentText, mediaUrl, contentType } = parseEvolutionMessageContent(data, messageId)

  // Insert outgoing message
  const { data: insertedMsg } = await db.from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'agent', // Or 'bot' if from automation, default 'agent' is safe
    content_type: contentType,
    content_text: contentText,
    media_url: mediaUrl,
    message_id: messageId,
    status: 'read', // Already read by sender
    created_at: new Date((data.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
  }).select().single()

  // Trigger external webhook
  if (insertedMsg) {
    void dispatchExternalWebhook(userId, 'message.sent', {
      id: insertedMsg.id,
      conversation_id: conversation.id,
      sender_type: 'agent',
      content_type: contentType,
      content_text: contentText,
      media_url: mediaUrl,
      message_id: messageId,
      status: 'read',
      created_at: insertedMsg.created_at,
      phone: phone,
    })
  }

  // Update conversation
  await db
    .from('conversations')
    .update({
      last_message_text: contentText || `[${contentType}]`,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id)
}

async function handleStatusReceipt(db: any, messageId: string, statusVal: number) {
  const mappedStatus = STATUS_MAP[statusVal]
  if (!mappedStatus) return

  // Update messages table
  const { data: updatedMsg, error: msgErr } = await db
    .from('messages')
    .update({ status: mappedStatus })
    .eq('message_id', messageId)
    .select('*, conversations(user_id, contacts(phone))')
    .maybeSingle()

  if (msgErr) {
    console.error('[webhook/evolution] Error updating status in messages:', msgErr)
  }

  if (updatedMsg && updatedMsg.conversations?.user_id) {
    void dispatchExternalWebhook(updatedMsg.conversations.user_id, 'message.status', {
      id: updatedMsg.id,
      conversation_id: updatedMsg.conversation_id,
      sender_type: updatedMsg.sender_type,
      content_type: updatedMsg.content_type,
      content_text: updatedMsg.content_text,
      media_url: updatedMsg.media_url,
      message_id: updatedMsg.message_id,
      status: updatedMsg.status,
      created_at: updatedMsg.created_at,
      phone: updatedMsg.conversations.contacts?.phone || null,
    })
  }

  // Update broadcast_recipients status
  const { data: recipient } = await db
    .from('broadcast_recipients')
    .select('id, status')
    .eq('whatsapp_message_id', messageId)
    .maybeSingle()

  if (!recipient) return

  // Re-use logic: only advance forward in the status ladder
  const ladder = ['pending', 'sent', 'delivered', 'read', 'replied']
  const curIdx = ladder.indexOf(recipient.status)
  const newIdx = ladder.indexOf(mappedStatus)

  if (newIdx > curIdx) {
    const ts = new Date().toISOString()
    const update: Record<string, unknown> = { status: mappedStatus }

    if (mappedStatus === 'sent') update.sent_at = ts
    if (mappedStatus === 'delivered') update.delivered_at = ts
    if (mappedStatus === 'read') update.read_at = ts

    await db
      .from('broadcast_recipients')
      .update(update)
      .eq('id', recipient.id)
  }
}

// ============================================================
// Utility Helpers
// ============================================================

function parseEvolutionMessageContent(data: any, messageId: string): {
  contentText: string | null
  mediaUrl: string | null
  contentType: 'text' | 'image' | 'video' | 'document' | 'audio' | 'location'
} {
  const message = data.message
  if (!message) {
    return { contentText: null, mediaUrl: null, contentType: 'text' }
  }

  // Text message
  if (message.conversation) {
    return { contentText: message.conversation, mediaUrl: null, contentType: 'text' }
  }
  if (message.extendedTextMessage?.text) {
    return { contentText: message.extendedTextMessage.text, mediaUrl: null, contentType: 'text' }
  }

  // Image message
  if (message.imageMessage) {
    return {
      contentText: message.imageMessage.caption || null,
      mediaUrl: `/api/whatsapp/media/${messageId}`,
      contentType: 'image',
    }
  }

  // Video message
  if (message.videoMessage) {
    return {
      contentText: message.videoMessage.caption || null,
      mediaUrl: `/api/whatsapp/media/${messageId}`,
      contentType: 'video',
    }
  }

  // Document message
  if (message.documentMessage) {
    return {
      contentText: message.documentMessage.caption || message.documentMessage.title || null,
      mediaUrl: `/api/whatsapp/media/${messageId}`,
      contentType: 'document',
    }
  }

  // Audio message
  if (message.audioMessage) {
    return {
      contentText: null,
      mediaUrl: `/api/whatsapp/media/${messageId}`,
      contentType: 'audio',
    }
  }

  // Location message
  if (message.locationMessage) {
    const loc = message.locationMessage
    const lat = loc.degreesLatitude
    const lng = loc.degreesLongitude
    return {
      contentText: `Location: ${lat}, ${lng} (View on Map)`,
      mediaUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      contentType: 'location',
    }
  }

  return {
    contentText: '[Unsupported message payload]',
    mediaUrl: null,
    contentType: 'text',
  }
}

async function findOrCreateContact(db: any, userId: string, phone: string, name: string) {
  const { data: contacts, error } = await db
    .from('contacts')
    .select('*')
    .eq('user_id', userId)

  if (error) return null

  const existing = contacts?.find((c: any) => phonesMatch(c.phone, phone))

  if (existing) {
    if (name && name !== 'WhatsApp Contact' && name !== existing.name) {
      await db
        .from('contacts')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    }
    return { contact: existing, wasCreated: false }
  }

  const { data: newContact, error: createError } = await db
    .from('contacts')
    .insert({
      user_id: userId,
      phone,
      name: name || phone,
    })
    .select()
    .single()

  if (createError) return null
  return { contact: newContact, wasCreated: true }
}

async function findOrCreateConversation(db: any, userId: string, contactId: string) {
  const { data: existing, error } = await db
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .single()

  if (!error && existing) return existing

  const { data: newConv, error: createError } = await db
    .from('conversations')
    .insert({
      user_id: userId,
      contact_id: contactId,
    })
    .select()
    .single()

  if (createError) return null
  return newConv
}

async function flagBroadcastReplyIfAny(db: any, userId: string, contactId: string) {
  try {
    const { data: recs } = await db
      .from('broadcast_recipients')
      .select('id, status, broadcast_id, broadcasts!inner(user_id)')
      .eq('contact_id', contactId)
      .eq('broadcasts.user_id', userId)
      .in('status', ['sent', 'delivered', 'read'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (!recs || recs.length === 0) return

    const row = recs[0]
    await db
      .from('broadcast_recipients')
      .update({ status: 'replied', replied_at: new Date().toISOString() })
      .eq('id', row.id)
  } catch (err) {
    console.error('[webhook/evolution] Flag broadcast reply error:', err)
  }
}
