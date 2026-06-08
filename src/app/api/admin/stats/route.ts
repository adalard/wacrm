import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Lazy-initialized admin Supabase client to bypass RLS for stats querying
let _adminClient: any = null
function getSupabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

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

    // 2) Fetch system-wide telemetry stats using admin client to bypass RLS
    const adminDb = getSupabaseAdmin()
    
    // Count total users
    const { count: totalUsers } = await adminDb
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    // Count Pro plans
    const { count: activePro } = await adminDb
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('tier', 'pro')
      .eq('status', 'active')

    // Count Enterprise plans
    const { count: activeEnterprise } = await adminDb
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('tier', 'enterprise')
      .eq('status', 'active')

    // Sum system-wide sent messages
    const { count: systemWideMessages } = await adminDb
      .from('messages')
      .select('*', { count: 'exact', head: true })

    // Calculate MRR (Pro plan: $29/mo, Enterprise: $149/mo)
    const proMRR = (activePro || 0) * 29
    const entMRR = (activeEnterprise || 0) * 149
    const estimatedMRR = proMRR + entMRR

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      activePro: activePro || 0,
      activeEnterprise: activeEnterprise || 0,
      systemWideMessages: systemWideMessages || 0,
      estimatedMRR,
    })
  } catch (err: any) {
    console.error('[api/admin/stats] Catch-all error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
