import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey } from '@/lib/api/auth'
import { hasApiAccess } from '@/lib/api/limits'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { sanitizePhoneForMeta, isValidE164 } from '@/lib/whatsapp/phone-utils'

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

/**
 * POST /api/v1/automations/trigger
 * Public developer API to trigger workspace automations via custom integrations.
 */
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

    // 2) Enforce SaaS Plan limits (Developer APIs are locked for Free accounts)
    const hasAccess = await hasApiAccess(userId)
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Payment Required. Developer API access is locked for Free Starter accounts. Please upgrade to Professional inside Billing Settings.' },
        { status: 402 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON request body.' },
        { status: 400 }
      )
    }

    const { trigger_key, phone, contact_id, name, email, variables } = body

    // 3) Validate Payload Inputs
    if (!trigger_key) {
      return NextResponse.json(
        { error: 'trigger_key is required' },
        { status: 400 }
      )
    }

    const db = supabaseAdmin()
    let resolvedContactId: string | null = null

    // 4) Resolve or Auto-Provision Contact
    if (contact_id) {
      // Look up contact by UUID
      const { data: contact } = await db
        .from('contacts')
        .select('id')
        .eq('id', contact_id)
        .eq('user_id', userId)
        .maybeSingle()

      if (!contact) {
        return NextResponse.json(
          { error: `Contact not found with ID "${contact_id}" in this workspace.` },
          { status: 404 }
        )
      }
      resolvedContactId = contact.id
    } else if (phone) {
      // Sanitize phone number to standard format
      const sanitizedPhone = sanitizePhoneForMeta(phone)
      if (!isValidE164(sanitizedPhone)) {
        return NextResponse.json(
          { error: 'Invalid phone number format. Must be international E164 (e.g. +1234567890).' },
          { status: 400 }
        )
      }

      // Look up existing contact by phone
      const { data: contact } = await db
        .from('contacts')
        .select('id')
        .eq('phone', sanitizedPhone)
        .eq('user_id', userId)
        .maybeSingle()

      if (contact) {
        resolvedContactId = contact.id
      } else {
        // Auto-provision a new contact!
        const { data: newContact, error: insertError } = await db
          .from('contacts')
          .insert({
            user_id: userId,
            phone: sanitizedPhone,
            name: name || `API Lead (${sanitizedPhone})`,
            email: email || null
          })
          .select()
          .single()

        if (insertError) {
          console.error('[automations/trigger] Failed to auto-provision contact:', insertError)
          return NextResponse.json(
            { error: `Failed to auto-provision contact: ${insertError.message}` },
            { status: 500 }
          )
        }
        resolvedContactId = newContact.id
      }
    } else {
      return NextResponse.json(
        { error: 'Either phone or contact_id must be provided to associate with a contact.' },
        { status: 400 }
      )
    }

    // 5) Trigger WACRM Automation Engine
    await runAutomationsForTrigger({
      userId,
      triggerType: 'api_trigger',
      contactId: resolvedContactId,
      context: {
        message_text: `API Trigger: ${trigger_key}`,
        api_trigger_key: trigger_key.toString().trim().toLowerCase(),
        vars: variables || {} // natively pass custom variables
      }
    })

    return NextResponse.json({
      ok: true,
      message: `Trigger event "${trigger_key}" successfully dispatched.`,
      contact_id: resolvedContactId
    })

  } catch (err: any) {
    console.error('[automations/trigger] Route failure:', err)
    return NextResponse.json(
      { error: `Internal server failure: ${err.message}` },
      { status: 500 }
    )
  }
}
