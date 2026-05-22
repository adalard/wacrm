import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
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

    const { error } = await supabase
      .from('external_webhooks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[api/external-webhooks/delete] Error:', error)
      return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/external-webhooks/delete] catch-all:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
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
    const body = await request.json()
    const { url, event_types, is_active } = body

    if (!id) {
      return NextResponse.json({ error: 'Webhook ID is required' }, { status: 400 })
    }

    const updates: Record<string, any> = {}
    if (url !== undefined) {
      if (typeof url !== 'string' || !url.startsWith('http')) {
        return NextResponse.json({ error: 'Invalid webhook URL format' }, { status: 400 })
      }
      updates.url = url.trim()
    }
    if (event_types !== undefined) {
      if (!Array.isArray(event_types) || event_types.length === 0) {
        return NextResponse.json({ error: 'event_types must be a non-empty array' }, { status: 400 })
      }
      updates.event_types = event_types
    }
    if (is_active !== undefined) {
      updates.is_active = !!is_active
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No properties to update provided' }, { status: 400 })
    }

    const { data: updatedWebhook, error } = await supabase
      .from('external_webhooks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error || !updatedWebhook) {
      console.error('[api/external-webhooks/patch] Error:', error)
      return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 })
    }

    return NextResponse.json(updatedWebhook)
  } catch (err) {
    console.error('[api/external-webhooks/patch] catch-all:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
