import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { getWhatsAppClient } from '@/lib/whatsapp/client-factory'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  phonesMatch,
} from '@/lib/whatsapp/phone-utils'

// Exported core function so the immediate execution route can reuse it
export async function processScheduledMessage(row: any, admin: any): Promise<string> {
  // 1. Sanitize and validate phone
  const sanitizedPhone = sanitizePhoneForMeta(row.receiver_phone)
  if (!isValidE164(sanitizedPhone)) {
    throw new Error(`Invalid phone number format: ${row.receiver_phone}`)
  }

  // 2. Fetch WhatsApp config for the user
  const { data: config, error: configError } = await admin
    .from('whatsapp_config')
    .select('*')
    .eq('user_id', row.user_id)
    .single()

  if (configError || !config) {
    throw new Error('WhatsApp is not configured for this account.')
  }

  // 3. Get WhatsApp client (decryption is handled safely inside the client factory)
  const client = getWhatsAppClient(config, admin)

  // 4. Send polymorphically with variant retry support
  const variants = phoneVariants(sanitizedPhone)
  let waMessageId = ''
  let workingPhone = sanitizedPhone
  let lastError: unknown = null

  const attempt = async (phone: string): Promise<string> => {
    if (row.message_type === 'template') {
      const result = await client.sendTemplate({
        to: phone,
        templateName: row.template_name,
        language: row.template_language || 'en_US',
        params: row.template_params || [],
      })
      return result.messageId
    } else {
      const result = await client.sendText({
        to: phone,
        text: row.content_text,
      })
      return result.messageId
    }
  }

  for (const variant of variants) {
    try {
      waMessageId = await attempt(variant)
      workingPhone = variant
      lastError = null
      break
    } catch (err) {
      lastError = err
      console.warn(`[scheduled/cron] Variant "${variant}" failed, trying next…`, err)
    }
  }

  if (lastError) {
    throw lastError
  }

  // 5. Find or Create Contact
  let contact = null
  const { data: contacts, error: contactsError } = await admin
    .from('contacts')
    .select('*')
    .eq('user_id', row.user_id)

  if (!contactsError && contacts) {
    contact = contacts.find((c: any) => phonesMatch(c.phone, workingPhone))
  }

  if (!contact) {
    const { data: newContact, error: createError } = await admin
      .from('contacts')
      .insert({
        user_id: row.user_id,
        phone: workingPhone,
        name: workingPhone,
      })
      .select()
      .single()

    if (createError) {
      throw new Error(`WhatsApp sent successfully, but failed to create contact: ${createError.message}`)
    }
    contact = newContact
  } else if (workingPhone !== sanitizedPhone) {
    // Correct stored variant if needed
    await admin
      .from('contacts')
      .update({ phone: workingPhone })
      .eq('id', contact.id)
  }

  // 6. Find or Create Conversation
  let conversation = null
  const { data: existingConv, error: findConvError } = await admin
    .from('conversations')
    .select('*')
    .eq('user_id', row.user_id)
    .eq('contact_id', contact.id)
    .maybeSingle()

  if (!findConvError && existingConv) {
    conversation = existingConv
  } else {
    const { data: newConv, error: createConvError } = await admin
      .from('conversations')
      .insert({
        user_id: row.user_id,
        contact_id: contact.id,
      })
      .select()
      .single()

    if (createConvError) {
      throw new Error(`WhatsApp sent successfully, but failed to create conversation: ${createConvError.message}`)
    }
    conversation = newConv
  }

  // 7. Insert message record
  const { error: msgError } = await admin.from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'agent',
    content_type: row.message_type,
    content_text: row.content_text || null,
    template_name: row.template_name || null,
    message_id: waMessageId,
    status: 'sent',
  })

  if (msgError) {
    throw new Error(`WhatsApp sent successfully, but DB insert failed: ${msgError.message}`)
  }

  // 8. Update conversation metrics
  await admin
    .from('conversations')
    .update({
      last_message_text: row.content_text || `[${row.template_name}]`,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id)

  return waMessageId
}

// GET: Cron worker trigger
export async function GET(request: Request) {
  try {
    const expected = process.env.AUTOMATION_CRON_SECRET
    const { searchParams } = new URL(request.url)
    const supplied = request.headers.get('x-cron-secret') || searchParams.get('secret')

    const isDev = process.env.NODE_ENV === 'development'

    if (!isDev) {
      if (!expected) {
        return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
      }
      if (supplied !== expected) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const admin = supabaseAdmin()
    const result = await processDueScheduledMessages(admin)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in scheduled messages cron:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function processDueScheduledMessages(admin: any): Promise<{ processed: number; succeeded: number; failed: number }> {
  // Query due scheduled messages
  const { data: due, error: dbError } = await admin
    .from('scheduled_messages')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(50)

  if (dbError) {
    throw dbError
  }

  if (!due || due.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  let processed = 0
  let succeeded = 0
  let failed = 0

  for (const row of due) {
    // Locking mechanism: Attempt to claim the scheduled message row
    const { data: claim } = await admin
      .from('scheduled_messages')
      .update({ status: 'processing' })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    if (!claim) continue // Overlapped by another worker

    try {
      const waMessageId = await processScheduledMessage(row, admin)

      // Success state
      await admin
        .from('scheduled_messages')
        .update({
          status: 'sent',
          whatsapp_message_id: waMessageId,
          error_message: null,
        })
        .eq('id', row.id)

      succeeded++
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[scheduled/cron] Message ID ${row.id} failed:`, msg)

      // Failure state
      await admin
        .from('scheduled_messages')
        .update({
          status: 'failed',
          error_message: msg,
        })
        .eq('id', row.id)

      failed++
    }
    processed++
  }

  return { processed, succeeded, failed }
}
