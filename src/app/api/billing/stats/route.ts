import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSubscription, TIER_LIMITS } from '@/lib/api/limits'

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

    // 1) Fetch active subscription details
    const sub = await getSubscription(user.id)

    // 2) Count total contacts in database for this user
    const { count: contactsCount, error: contactsError } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (contactsError) {
      console.error('[api/billing/stats] Contacts count failed:', contactsError)
    }

    // 3) Sum monthly broadcast recipients
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data: broadcasts, error: broadcastsError } = await supabase
      .from('broadcasts')
      .select('total_recipients')
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth.toISOString())

    if (broadcastsError) {
      console.error('[api/billing/stats] Broadcasts count failed:', broadcastsError)
    }

    const broadcastsCount =
      broadcasts?.reduce((acc: number, curr: any) => acc + (curr.total_recipients || 0), 0) || 0

    // Resolve plan configuration values
    const limits = TIER_LIMITS[sub.tier]

    return NextResponse.json({
      contactsCount: contactsCount || 0,
      contactsLimit: limits.contacts,
      broadcastsCount,
      broadcastsLimit: limits.broadcastsPerMonth,
      tier: sub.tier,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      stripeMocked: !process.env.STRIPE_SECRET_KEY,
    })
  } catch (err: any) {
    console.error('[api/billing/stats] Catch-all error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
