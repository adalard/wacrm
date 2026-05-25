import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { processScheduledMessage } from '../../cron/route'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const admin = supabaseAdmin()

    // 1. Fetch the scheduled message and ensure it belongs to the user
    const { data: row, error: fetchError } = await admin
      .from('scheduled_messages')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!row) {
      return NextResponse.json({ error: 'Scheduled message not found' }, { status: 404 })
    }

    if (row.status === 'sent') {
      return NextResponse.json({ error: 'This message has already been sent.' }, { status: 400 })
    }

    // 2. Claim the message: status to 'processing'
    const { data: claim } = await admin
      .from('scheduled_messages')
      .update({ status: 'processing' })
      .eq('id', id)
      .in('status', ['pending', 'failed'])
      .select('id')
      .maybeSingle()

    if (!claim) {
      return NextResponse.json({ error: 'Message is already being processed.' }, { status: 409 })
    }

    // 3. Process sending
    try {
      const waMessageId = await processScheduledMessage(row, admin)

      // Update row as sent
      const { data: updated } = await admin
        .from('scheduled_messages')
        .update({
          status: 'sent',
          whatsapp_message_id: waMessageId,
          error_message: null,
        })
        .eq('id', id)
        .select()
        .single()

      return NextResponse.json({ success: true, message: updated })
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[scheduled/send-now] Immediate send for ID ${id} failed:`, msg)

      // Update row as failed
      const { data: updated } = await admin
        .from('scheduled_messages')
        .update({
          status: 'failed',
          error_message: msg,
        })
        .eq('id', id)
        .select()
        .single()

      return NextResponse.json({ error: msg, message: updated }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in scheduled message send now route:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
