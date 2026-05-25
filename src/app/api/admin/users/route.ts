import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // 1) Verify Admin Role
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Access restricted.' }, { status: 403 })
    }

    // 2) Fetch user directory
    // We will query profiles and join them with subscriptions, whatsapp_config, and contacts count
    // In Supabase JS, we can fetch profiles first, then gather subscriptions and stats in bulk
    const { data: profiles, error: profsErr } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, created_at')
      .order('created_at', { ascending: false })

    if (profsErr || !profiles) {
      console.error('[api/admin/users] Error retrieving profiles:', profsErr)
      return NextResponse.json({ error: 'Failed to retrieve profiles' }, { status: 500 })
    }

    const { data: subscriptions, error: subsErr } = await supabase
      .from('subscriptions')
      .select('user_id, tier, status')

    const { data: configs, error: confsErr } = await supabase
      .from('whatsapp_config')
      .select('user_id, status')

    const { data: contacts, error: contsErr } = await supabase
      .from('contacts')
      .select('user_id')

    // Map stats in memory
    const usersDirectory = profiles.map((p: any) => {
      const sub = subscriptions?.find((s: any) => s.user_id === p.user_id)
      const conf = configs?.find((c: any) => c.user_id === p.user_id)
      const contactsCount = contacts?.filter((c: any) => c.user_id === p.user_id).length || 0

      return {
        id: p.user_id,
        email: p.email,
        full_name: p.full_name,
        tier: sub?.tier || 'free',
        status: sub?.status || 'active',
        created_at: p.created_at,
        whatsapp_status: conf?.status || 'disconnected',
        contacts_count: contactsCount,
      }
    })

    return NextResponse.json(usersDirectory)
  } catch (err: any) {
    console.error('[api/admin/users] Catch-all error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
