import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: webhooks, error } = await supabase
      .from('external_webhooks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[api/external-webhooks] GET Error:', error)
      return NextResponse.json({ error: 'Failed to retrieve webhooks' }, { status: 500 })
    }

    return NextResponse.json(webhooks)
  } catch (err) {
    console.error('[api/external-webhooks] GET catch-all:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { url, event_types, is_active } = body

    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return NextResponse.json(
        { error: 'A valid absolute target URL (starting with http/https) is required' },
        { status: 400 }
      )
    }

    const events = event_types || ['message.received', 'message.sent', 'message.status']
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Subscribed event_types must be a non-empty array' },
        { status: 400 }
      )
    }

    // Auto-generate a secure webhook signing secret key
    const secret = `whsec_${crypto.randomBytes(16).toString('hex')}`
    const active = is_active !== false

    const { data: newWebhook, error } = await supabase
      .from('external_webhooks')
      .insert({
        user_id: user.id,
        url: url.trim(),
        secret,
        event_types: events,
        is_active: active,
      })
      .select('*')
      .single()

    if (error || !newWebhook) {
      console.error('[api/external-webhooks] POST Error:', error)
      return NextResponse.json({ error: 'Failed to create webhook subscription' }, { status: 500 })
    }

    return NextResponse.json(newWebhook)
  } catch (err) {
    console.error('[api/external-webhooks] POST catch-all:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
