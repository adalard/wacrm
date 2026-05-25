import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSystemSetting, saveSystemSetting } from '@/lib/api/settings'
import Stripe from 'stripe'

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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2) Load active key states
    const publishableKey = await getSystemSetting('stripe_publishable_key')
    const secretKey = await getSystemSetting('stripe_secret_key')
    const webhookSecret = await getSystemSetting('stripe_webhook_secret')

    // Verify Stripe connection live status
    let connected = false
    let errorMsg = null

    if (secretKey) {
      try {
        const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' as any })
        await stripe.customers.list({ limit: 1 })
        connected = true
      } catch (err: any) {
        errorMsg = err.message || 'Stripe API authentication failed'
      }
    }

    return NextResponse.json({
      publishableKey: publishableKey ? `${publishableKey.substring(0, 8)}...` : '',
      hasSecretKey: !!secretKey,
      hasWebhookSecret: !!webhookSecret,
      connected,
      errorMsg,
    })
  } catch (err: any) {
    console.error('[api/admin/stripe] GET Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { publishableKey, secretKey, webhookSecret } = body

    // 2) Validate Secret Key live authenticity prior to saving
    if (secretKey) {
      try {
        const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' as any })
        await stripe.customers.list({ limit: 1 })
      } catch (err: any) {
        console.error('[api/admin/stripe] Connection validation failed:', err)
        return NextResponse.json({ error: `Stripe Credentials Invalid: ${err.message}` }, { status: 400 })
      }
    }

    // 3) Securely save settings into DB (sensitive keys are AES-256 encrypted at rest)
    if (publishableKey && publishableKey.trim() !== '') {
      await saveSystemSetting('stripe_publishable_key', publishableKey.trim(), false)
    }
    
    if (secretKey && secretKey.trim() !== '') {
      await saveSystemSetting('stripe_secret_key', secretKey.trim(), true)
    }

    if (webhookSecret && webhookSecret.trim() !== '') {
      await saveSystemSetting('stripe_webhook_secret', webhookSecret.trim(), true)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[api/admin/stripe] POST Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
