import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (subError || !sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (stripeKey && sub.stripe_customer_id) {
      const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any })
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?tab=billing`,
      })
      return NextResponse.json({ url: portalSession.url })
    }

    // --- MOCK PORTAL FLOW (Downgrade to Free) ---
    // If Stripe is not configured, the billing portal button acts as a toggle
    // to downgrade the account back to Free tier for easy limits testing.
    const { error: dbError } = await supabase
      .from('subscriptions')
      .update({
        tier: 'free',
        status: 'active',
        stripe_subscription_id: null,
        stripe_price_id: null,
        current_period_end: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (dbError) {
      console.error('[portal] Mock downgrade failed:', dbError)
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
    }

    return NextResponse.json({
      url: `/settings?tab=billing&portal_mock=true`,
      mocked: true
    })
  } catch (err: any) {
    console.error('[portal] POST Catch:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
