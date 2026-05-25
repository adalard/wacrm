import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
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

    // 2) Parse request
    const body = await request.json()
    const { userId, tier } = body

    if (!userId || !tier || !['free', 'pro', 'enterprise'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid parameters specified' }, { status: 400 })
    }

    // 3) Update user subscription tier directly in DB
    const currentPeriodEnd = new Date()
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1) // 30 days active override period

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        tier,
        status: 'active',
        stripe_subscription_id: `admin_override_${Math.random().toString(36).substr(2, 9)}`,
        stripe_price_id: `admin_price_${tier}`,
        current_period_end: currentPeriodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('[api/admin/override] Error updating subscription tier:', updateError)
      return NextResponse.json({ error: 'Failed to update subscription tier' }, { status: 500 })
    }

    return NextResponse.json({ success: true, tier })
  } catch (err: any) {
    console.error('[api/admin/override] Catch-all error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
