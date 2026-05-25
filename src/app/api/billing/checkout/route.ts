import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSystemSetting } from '@/lib/api/settings'
import Stripe from 'stripe'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tier } = await request.json()
    if (!tier || !['free', 'pro', 'enterprise'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier specified' }, { status: 400 })
    }

    // 1) Retrieve Stripe credentials dynamically from database
    const stripeKey = (await getSystemSetting('stripe_secret_key')) || process.env.STRIPE_SECRET_KEY

    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any })
      
      // 2) Resolve price ID from database packages table
      const { data: pkg, error: pkgErr } = await supabase
        .from('packages')
        .select('*')
        .eq('code', tier)
        .maybeSingle()

      if (pkgErr || !pkg) {
        console.error(`[checkout] Failed to load package "${tier}":`, pkgErr)
        return NextResponse.json({ error: `Package details for tier ${tier} not found` }, { status: 500 })
      }

      // Default to database stripe_price_id, fall back to env variables
      const priceId = pkg.stripe_price_id_monthly || (
        tier === 'pro' ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_ENTERPRISE_PRICE_ID
      )
        
      if (!priceId) {
        return NextResponse.json({ error: `Stripe Price ID for tier "${tier}" is not configured in settings.` }, { status: 500 })
      }

      // Query or create Stripe Customer
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle()

      let customerId = subData?.stripe_customer_id
      if (!customerId) {
        const stripeCustomer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user.id },
        })
        customerId = stripeCustomer.id
        // Store in DB
        await supabase
          .from('subscriptions')
          .update({ stripe_customer_id: customerId })
          .eq('user_id', user.id)
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?tab=billing&success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?tab=billing&canceled=true`,
        metadata: { userId: user.id, tier },
      })

      return NextResponse.json({ url: session.url })
    }

    // --- MOCK CHECKOUT FLOW ---
    // If Stripe is not configured, directly activate the tier for local testing
    const currentPeriodEnd = new Date()
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1) // 30 days active

    const { error: dbError } = await supabase
      .from('subscriptions')
      .update({
        tier,
        status: 'active',
        stripe_subscription_id: `mock_sub_${Math.random().toString(36).substr(2, 9)}`,
        stripe_price_id: `mock_price_${tier}`,
        current_period_end: currentPeriodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (dbError) {
      console.error('[checkout] Mock db update failed:', dbError)
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
    }

    return NextResponse.json({ 
      url: `/settings?tab=billing&success=true&mock=true`,
      mocked: true 
    })
  } catch (err: any) {
    console.error('[checkout] POST Catch:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
