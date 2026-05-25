import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch user's scheduled messages
export async function GET() {
  try {
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

    const { data: messages, error: dbError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .order('scheduled_for', { ascending: true })

    if (dbError) {
      return NextResponse.json(
        { error: dbError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(messages)
  } catch (error) {
    console.error('Error fetching scheduled messages:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// POST: Create single or bulk scheduled messages
export async function POST(request: Request) {
  try {
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

    const body = await request.json()
    const { messages } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Provide a non-empty array of messages' },
        { status: 400 }
      )
    }

    // Validate messages
    const toInsert = []
    for (const msg of messages) {
      const {
        receiver_phone,
        message_type,
        content_text,
        template_name,
        template_language,
        template_params,
        scheduled_for,
      } = msg

      if (!receiver_phone || !message_type || !scheduled_for) {
        return NextResponse.json(
          { error: 'receiver_phone, message_type, and scheduled_for are required' },
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

      // Build row
      toInsert.push({
        user_id: user.id,
        receiver_phone,
        message_type,
        content_text: message_type === 'text' ? content_text : null,
        template_name: message_type === 'template' ? template_name : null,
        template_language: message_type === 'template' ? (template_language || 'en_US') : null,
        template_params: message_type === 'template' ? (template_params || []) : null,
        scheduled_for: new Date(scheduled_for).toISOString(),
        status: 'pending',
      })
    }

    const { data: inserted, error: dbError } = await supabase
      .from('scheduled_messages')
      .insert(toInsert)
      .select()

    if (dbError) {
      return NextResponse.json(
        { error: dbError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, count: inserted.length, data: inserted })
  } catch (error) {
    console.error('Error creating scheduled messages:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// DELETE: Delete/Cancel a scheduled message
export async function DELETE(request: Request) {
  try {
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Message ID is required' },
        { status: 400 }
      )
    }

    const { error: dbError } = await supabase
      .from('scheduled_messages')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Ensure security sandbox

    if (dbError) {
      return NextResponse.json(
        { error: dbError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting scheduled message:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
