import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateApiKey } from '@/lib/api/auth'

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

    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, created_at, last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[api/api-keys] GET Error:', error)
      return NextResponse.json({ error: 'Failed to retrieve API keys' }, { status: 500 })
    }

    return NextResponse.json(keys)
  } catch (err) {
    console.error('[api/api-keys] GET catch-all:', err)
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
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Key description/name is required' }, { status: 400 })
    }

    const { rawKey, prefix, hash } = generateApiKey()

    const { data: insertedKey, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: user.id,
        name: name.trim(),
        key_hash: hash,
        key_prefix: prefix,
      })
      .select('id, name, key_prefix, created_at')
      .single()

    if (error || !insertedKey) {
      console.error('[api/api-keys] POST Error:', error)
      return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
    }

    // Expose the rawKey ONLY ONCE here. It is never stored or returned again!
    return NextResponse.json({
      ...insertedKey,
      rawKey,
    })
  } catch (err) {
    console.error('[api/api-keys] POST catch-all:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
