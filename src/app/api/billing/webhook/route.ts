import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSystemSetting } from '@/lib/api/settings'
import Stripe from 'stripe'

// Lazy-initialized admin Supabase client to bypass RLS for Webhook database updates
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

export async function POST(request: Request) {
  // Retrieve Stripe Secret Key and Webhook Secret dynamically from database settings
  const stripeKey = (await getSystemSetting('stripe_secret_key')) || process.env.STRIPE_SECRET_KEY
  const webhookSecret = (await getSystemSetting('stripe_webhook_secret')) || process.env.STRIPE_WEBHOOK_SECRET

  if (!stripeKey || !webhookSecret) {
    console.warn('[stripe-webhook] Webhook endpoint triggered but Stripe key or webhook secret is unconfigured.')
    return NextResponse.json(
      { error: 'Billing webhooks are not configured on this server.' },
      { status: 501 }
    )
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any })
  const payload = await request.text()
  const sig = request.headers.get('stripe-signature')

  let event: Stripe.Event

  try {
    if (!sig) throw new Error('stripe-signature header is missing')
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret)
  } catch (err: any) {
    console.error(`[stripe-webhook] Authenticity signature failed:`, err.message)
    return NextResponse.json({ error: `Signature verification failed: ${err.message}` }, { status: 400 })
  }

  const db = supabaseAdmin()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        const tier = session.metadata?.tier || 'pro'
        
        if (!userId) {
          console.warn('[stripe-webhook] checkout.session.completed missing userId metadata')
          break
        }

        const subscriptionId = session.subscription as string
        const stripeSubscription: any = await stripe.subscriptions.retrieve(subscriptionId)

        await db
          .from('subscriptions')
          .update({
            tier,
            status: stripeSubscription.status,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: stripeSubscription.items.data[0].price.id,
            current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)

        console.info(`[stripe-webhook] Successfully activated tier "${tier}" subscription for user: ${userId}`)
        break
      }

      case 'customer.subscription.updated': {
        const stripeSubscription: any = event.data.object
        const customerId = stripeSubscription.customer as string

        // Resolve user by customerId
        const { data: subData } = await db
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (!subData) {
          console.warn(`[stripe-webhook] subscription.updated could not find customer: ${customerId}`)
          break
        }

        // De-escalate tier if subscription is canceled or unpaid
        const isActive = ['active', 'trialing'].includes(stripeSubscription.status)
        let updatePayload: any = {
          status: stripeSubscription.status,
          stripe_price_id: stripeSubscription.items.data[0].price.id,
          current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }

        if (!isActive) {
          updatePayload.tier = 'free'
        }

        await db
          .from('subscriptions')
          .update(updatePayload)
          .eq('user_id', subData.user_id)

        console.info(`[stripe-webhook] Updated subscription status to "${stripeSubscription.status}" for user: ${subData.user_id}`)
        break
      }

      case 'customer.subscription.deleted': {
        const stripeSubscription: any = event.data.object
        const customerId = stripeSubscription.customer as string

        const { data: subData } = await db
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (!subData) {
          console.warn(`[stripe-webhook] subscription.deleted could not find customer: ${customerId}`)
          break
        }

        await db
          .from('subscriptions')
          .update({
            tier: 'free',
            status: stripeSubscription.status,
            stripe_subscription_id: null,
            stripe_price_id: null,
            current_period_end: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', subData.user_id)

        console.info(`[stripe-webhook] Subscription deleted. Reverted user ${subData.user_id} back to Free plan.`)
        break
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error(`[stripe-webhook] Internal webhook event processing error:`, err.message)
    return NextResponse.json({ error: 'Internal event processing error' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
