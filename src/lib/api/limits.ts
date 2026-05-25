import { createClient } from '@supabase/supabase-js'

// Lazy-initialized admin Supabase client to bypass RLS for SaaS limits checking
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

export interface SubscriptionInfo {
  tier: 'free' | 'pro' | 'enterprise';
  status: string;
  stripe_customer_id: string | null;
  current_period_end: string | null;
}

export const TIER_LIMITS = {
  free: {
    contacts: 100,
    broadcastsPerMonth: 50,
    apiAccess: false,
    webhookAccess: false,
  },
  pro: {
    contacts: Infinity,
    broadcastsPerMonth: Infinity,
    apiAccess: true,
    webhookAccess: true,
  },
  enterprise: {
    contacts: Infinity,
    broadcastsPerMonth: Infinity,
    apiAccess: true,
    webhookAccess: true,
  },
}

/**
 * Resolves the subscription plan and tier details for a tenant user.
 */
export async function getSubscription(userId: string): Promise<SubscriptionInfo> {
  try {
    const db = supabaseAdmin()
    const { data: sub, error } = await db
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !sub) {
      // Graceful fallback to Free plan
      return {
        tier: 'free',
        status: 'active',
        stripe_customer_id: null,
        current_period_end: null,
      }
    }

    // Default to Free if status is unpaid or fully expired
    const isPlanExpired = ['unpaid', 'incomplete'].includes(sub.status)
    const tier = isPlanExpired ? 'free' : (sub.tier as 'free' | 'pro' | 'enterprise')

    return {
      tier,
      status: sub.status,
      stripe_customer_id: sub.stripe_customer_id || null,
      current_period_end: sub.current_period_end || null,
    }
  } catch (err) {
    console.error(`[limits] Error fetching subscription for user ${userId}:`, err)
    return {
      tier: 'free',
      status: 'active',
      stripe_customer_id: null,
      current_period_end: null,
    }
  }
}

/**
 * Checks if the user is allowed to add more contacts based on their SaaS plan limits.
 */
export async function checkContactLimit(
  userId: string
): Promise<{ allowed: boolean; count: number; limit: number }> {
  try {
    const sub = await getSubscription(userId)
    const limit = TIER_LIMITS[sub.tier].contacts

    if (limit === Infinity) {
      return { allowed: true, count: 0, limit }
    }

    const db = supabaseAdmin()
    const { count, error } = await db
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) throw error

    const currentCount = count || 0
    return {
      allowed: currentCount < limit,
      count: currentCount,
      limit,
    }
  } catch (err) {
    console.error(`[limits] Error checking contact limit for user ${userId}:`, err)
    return { allowed: false, count: 0, limit: 100 } // Fail closed on error
  }
}

/**
 * Checks if the user is allowed to send more broadcasts in the current calendar month.
 */
export async function checkBroadcastLimit(
  userId: string,
  addingCount: number = 1
): Promise<{ allowed: boolean; count: number; limit: number }> {
  try {
    const sub = await getSubscription(userId)
    const limit = TIER_LIMITS[sub.tier].broadcastsPerMonth

    if (limit === Infinity) {
      return { allowed: true, count: 0, limit }
    }

    const db = supabaseAdmin()
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data: broadcasts, error } = await db
      .from('broadcasts')
      .select('total_recipients')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())

    if (error) throw error

    const currentMonthSent =
      broadcasts?.reduce((acc: number, curr: any) => acc + (curr.total_recipients || 0), 0) || 0

    return {
      allowed: (currentMonthSent + addingCount) <= limit,
      count: currentMonthSent,
      limit,
    }
  } catch (err) {
    console.error(`[limits] Error checking broadcast limit for user ${userId}:`, err)
    return { allowed: false, count: 0, limit: 50 } // Fail closed
  }
}

/**
 * Checks if the user's plan tier is allowed to use Developer REST APIs and webhooks.
 */
export async function hasApiAccess(userId: string): Promise<boolean> {
  const sub = await getSubscription(userId)
  return TIER_LIMITS[sub.tier].apiAccess
}
