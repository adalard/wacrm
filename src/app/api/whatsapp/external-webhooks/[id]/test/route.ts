import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Webhook ID is required' }, { status: 400 })
    }

    const { data: webhook, error } = await supabase
      .from('external_webhooks')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error || !webhook) {
      return NextResponse.json({ error: 'Webhook subscription not found' }, { status: 404 })
    }

    const timestamp = new Date().toISOString()
    const testData = {
      ping: 'pong',
      message: 'This is a secure live test event dispatched from your WACRM Settings dashboard.',
      sample_payload: {
        message_id: 'test-msg-uuid-12345678',
        whatsapp_message_id: 'wamid.HBgLMTIzNDU2Nzg5MEUCGQhFNDI4OUI0RTNBOAA=',
        phone: '+1234567890',
        sender_type: 'customer',
        content_type: 'text',
        content_text: 'Hello from WACRM webhook validator!',
        status: 'delivered',
        created_at: timestamp,
      },
    }

    const payloadObj = {
      event: 'message.test',
      timestamp,
      user_id: user.id,
      data: testData,
    }
    const payloadString = JSON.stringify(payloadObj)

    // Compute signature using the webhook secret
    const hmac = crypto.createHmac('sha256', webhook.secret)
    const signature = `sha256=${hmac.update(payloadString).digest('hex')}`

    // Call external endpoint synchronously to report output status
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WACRM-Signature-256': signature,
          'User-Agent': 'WACRM-Webhook-Validator/1.0',
        },
        body: payloadString,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const bodyText = await response.text()
      const previewText = bodyText.length > 200 ? `${bodyText.substring(0, 200)}...` : bodyText

      return NextResponse.json({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        responsePreview: previewText || '[Empty Response Body]',
      })
    } catch (fetchErr: any) {
      clearTimeout(timeoutId)
      const errorMsg = fetchErr.name === 'AbortError' ? 'Request timed out after 6 seconds' : fetchErr.message
      return NextResponse.json({
        success: false,
        error: `Failed to deliver test payload: ${errorMsg}`,
      })
    }
  } catch (err) {
    console.error('[api/external-webhooks/test] catch-all:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
