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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2) List all packages
    const { data: packages, error } = await supabase
      .from('packages')
      .select('*')
      .order('price_monthly', { ascending: true })

    if (error) {
      console.error('[api/admin/packages] GET Error:', error)
      return NextResponse.json({ error: 'Failed to retrieve packages' }, { status: 500 })
    }

    return NextResponse.json(packages)
  } catch (err: any) {
    console.error('[api/admin/packages] GET Catch:', err)
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

    // 2) Update package details
    const body = await request.json()
    const {
      id,
      name,
      price_monthly,
      price_yearly,
      stripe_price_id_monthly,
      stripe_price_id_yearly,
      contact_limit,
      broadcast_limit,
      has_api_access,
      has_bulk_sending,
      has_scheduled_sending,
    } = body

    if (!id || !name) {
      return NextResponse.json({ error: 'Plan ID and Name are required' }, { status: 400 })
    }

    const { data: updatedPkg, error: dbError } = await supabase
      .from('packages')
      .update({
        name,
        price_monthly: Number(price_monthly),
        price_yearly: Number(price_yearly),
        stripe_price_id_monthly: stripe_price_id_monthly || null,
        stripe_price_id_yearly: stripe_price_id_yearly || null,
        contact_limit: Number(contact_limit),
        broadcast_limit: Number(broadcast_limit),
        has_api_access: Boolean(has_api_access),
        has_bulk_sending: Boolean(has_bulk_sending),
        has_scheduled_sending: Boolean(has_scheduled_sending),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (dbError || !updatedPkg) {
      console.error('[api/admin/packages] PATCH error:', dbError)
      return NextResponse.json({ error: 'Failed to update plan tier' }, { status: 500 })
    }

    return NextResponse.json(updatedPkg)
  } catch (err: any) {
    console.error('[api/admin/packages] POST Catch:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
