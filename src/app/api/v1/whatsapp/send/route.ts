import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey } from '@/lib/api/auth'
import { getWhatsAppClient } from '@/lib/whatsapp/client-factory'
import { isLegacyFormat, encrypt, decrypt } from '@/lib/whatsapp/encryption'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils'
import { dispatchExternalWebhook } from '@/lib/api/webhooks'
import { hasApiAccess } from '@/lib/api/limits'

// Lazy-initialized admin Supabase client to bypass RLS for API endpoints
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

function decryptSafely(val: string): string {
  try {
    return decrypt(val)
  } catch {
    return val
  }
}

export async function POST(request: Request) {
  try {
    // 1) Authenticate Developer API Key
    const userId = await authenticateApiKey(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Invalid or missing Bearer API Key.' },
        { status: 401 }
      )
    }

    // Enforce SaaS pricing plan limits
    const hasAccess = await hasApiAccess(userId)
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Payment Required. Developer API access is locked for Free Starter accounts. Please upgrade to Professional inside Billing Settings.' },
        { status: 402 }
      )
    }

    const body = await request.json()
    const {
      phone,
      message_type,
      content_text,
      template_name,
      template_params,
      media_url,
    } = body

    // 2) Validate basic payload structure
    if (!phone || !message_type) {
      return NextResponse.json(
        { error: 'phone and message_type are required' },
        { status: 400 }
      )
    }

    if (message_type !== 'text' && message_type !== 'template') {
      return NextResponse.json(
        { error: 'message_type must be either "text" or "template"' },
        { status: 400 }
      )
    }

    if (message_type === 'text' && !content_text) {
      return NextResponse.json(
        { error: 'content_text is required for text messages' },
        { status: 400 }
      )
    }

    if (message_type === 'template' && !template_name) {
      return NextResponse.json(
        { error: 'template_name is required for template messages' },
        { status: 400 }
      )
    }

    // 3) Sanitize and validate recipient phone number
    const sanitizedPhone = sanitizePhoneForMeta(phone)
    if (!isValidE164(sanitizedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Must be international E164 (e.g. +1234567890).' },
        { status: 400 }
      )
    }

    const db = supabaseAdmin()

    // 4) Load WhatsApp configuration
    const { data: config, error: configError } = await db
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (configError || !config || config.status !== 'connected') {
      return NextResponse.json(
        { error: 'WhatsApp not connected. Please connect your WhatsApp integration in CRM Settings first.' },
        { status: 400 }
      )
    }

    // 5) Find or create Contact
    const { data: contacts, error: contactsError } = await db
      .from('contacts')
      .select('*')
      .eq('user_id', userId)

    if (contactsError) {
      console.error('[api/v1/send] Error fetching contacts:', contactsError)
      return NextResponse.json({ error: 'Database error retrieving contact' }, { status: 500 })
    }

    // Flexible phone matching
    let contact = contacts?.find((c: any) => {
      const n1 = c.phone.replace(/\D/g, '')
      const n2 = sanitizedPhone.replace(/\D/g, '')
      if (n1 === n2) return true
      if (n1.length >= 8 && n2.length >= 8) {
        return n1.slice(-8) === n2.slice(-8)
      }
      return false
    })

    if (!contact) {
      const { data: newContact, error: createContactErr } = await db
        .from('contacts')
        .insert({
          user_id: userId,
          phone: sanitizedPhone,
          name: phone, // Default name to the raw input phone
        })
        .select()
        .single()

      if (createContactErr || !newContact) {
        console.error('[api/v1/send] Failed to auto-create contact:', createContactErr)
        return NextResponse.json({ error: 'Database error auto-creating contact' }, { status: 500 })
      }
      contact = newContact
    }

    // 6) Find or create Conversation
    let { data: conversation, error: convError } = await db
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_id', contact.id)
      .maybeSingle()

    if (convError) {
      console.error('[api/v1/send] Error finding conversation:', convError)
      return NextResponse.json({ error: 'Database error retrieving conversation' }, { status: 500 })
    }

    if (!conversation) {
      const { data: newConv, error: createConvErr } = await db
        .from('conversations')
        .insert({
          user_id: userId,
          contact_id: contact.id,
        })
        .select()
        .single()

      if (createConvErr || !newConv) {
        console.error('[api/v1/send] Failed to auto-create conversation:', createConvErr)
        return NextResponse.json({ error: 'Database error auto-creating conversation' }, { status: 500 })
      }
      conversation = newConv
    }

    // Self-heal legacy CBC-encrypted Meta tokens
    if (config.connection_method === 'meta' && config.access_token && isLegacyFormat(config.access_token)) {
      const decrypted = decryptSafely(config.access_token)
      void db
        .from('whatsapp_config')
        .update({ access_token: encrypt(decrypted) })
        .eq('id', config.id)
    }

    // 7) Polymorphically send through client factory
    const client = getWhatsAppClient(config, db)
    let waMessageId = ''
    let workingPhone = sanitizedPhone

    const attempt = async (targetPhone: string): Promise<string> => {
      if (message_type === 'template') {
        const result = await client.sendTemplate({
          to: targetPhone,
          templateName: template_name,
          params: template_params || [],
        })
        return result.messageId
      }
      const result = await client.sendText({
        to: targetPhone,
        text: content_text,
      })
      return result.messageId
    }

    try {
      const variants = phoneVariants(sanitizedPhone)
      let lastError: unknown = null

      for (const variant of variants) {
        try {
          waMessageId = await attempt(variant)
          workingPhone = variant
          lastError = null
          break
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          if (config.connection_method === 'meta' && !isRecipientNotAllowedError(message)) {
            throw err
          }
          lastError = err
          console.warn(`[api/v1/send] Variant "${variant}" failed, trying next…`, message)
        }
      }

      if (lastError) throw lastError
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown WhatsApp API error'
      console.error('[api/v1/send] WhatsApp API send failed:', message)
      return NextResponse.json(
        { error: `WhatsApp API send failed: ${message}` },
        { status: 502 }
      )
    }

    // Auto-update contact phone if variant corrector worked
    if (workingPhone !== sanitizedPhone) {
      await db
        .from('contacts')
        .update({ phone: workingPhone, updated_at: new Date().toISOString() })
        .eq('id', contact.id)
    }

    // 8) Insert message record into DB
    const { data: messageRecord, error: msgError } = await db
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_type: 'agent',
        content_type: message_type,
        content_text: content_text || null,
        media_url: media_url || null,
        template_name: template_name || null,
        message_id: waMessageId,
        status: 'sent',
      })
      .select()
      .single()

    if (msgError || !messageRecord) {
      console.error('[api/v1/send] Error inserting sent message:', msgError)
      return NextResponse.json(
        { error: `Message sent but failed to save in CRM database: ${msgError?.message || 'Empty'}` },
        { status: 500 }
      )
    }

    // 9) Update conversation metrics
    await db
      .from('conversations')
      .update({
        last_message_text: content_text || `[${message_type}]`,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)

    // 10) Dispatch Real-time Outbound webhook to 3rd party listeners
    await dispatchExternalWebhook(userId, 'message.sent', {
      id: messageRecord.id,
      conversation_id: conversation.id,
      sender_type: 'agent',
      content_type: message_type,
      content_text: content_text || null,
      media_url: media_url || null,
      template_name: template_name || null,
      message_id: waMessageId,
      status: 'sent',
      created_at: messageRecord.created_at,
      phone: workingPhone,
    })

    return NextResponse.json({
      success: true,
      message_id: messageRecord.id,
      whatsapp_message_id: waMessageId,
    })
  } catch (error) {
    console.error('[api/v1/send] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
