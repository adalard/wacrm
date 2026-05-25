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
  contact_limit: number;
  broadcast_limit: number;
  has_api_access: boolean;
  has_bulk_sending: boolean;
  has_scheduled_sending: boolean;
}

// Fallback plan limits in case database is temporarily offline or unseeded
export const FALLBACK_LIMITS = {
  free: {
    contacts: 100,
    broadcasts: 50,
    api: false,
    bulk: false,
    scheduled: false,
  },
  pro: {
    contacts: Infinity,
    broadcasts: Infinity,
    api: true,
    bulk: true,
    scheduled: true,
  },
  enterprise: {
    contacts: Infinity,
    broadcasts: Infinity,
    api: true,
    bulk: true,
    scheduled: true,
  },
}

/**
 * Loads a package configuration from the database by its code.
 */
export async function getPackageByCode(code: string): Promise<any> {
  try {
    const db = supabaseAdmin()
    const { data: pkg, error } = await db
      .from('packages')
      .select('*')
      .eq('code', code)
      .maybeSingle()

    if (error || !pkg) return null
    return {
      name: pkg.name,
      code: pkg.code,
      contact_limit: pkg.contact_limit === -1 ? Infinity : pkg.contact_limit,
      broadcast_limit: pkg.broadcast_limit === -1 ? Infinity : pkg.broadcast_limit,
      has_api_access: pkg.has_api_access,
      has_bulk_sending: pkg.has_bulk_sending,
      has_scheduled_sending: pkg.has_scheduled_sending,
    }
  } catch (err) {
    console.error(`[limits] Failed to retrieve package "${code}":`, err)
    return null
  }
}

/**
 * Resolves the subscription plan, tier, and associated limits dynamically from the database.
 */
export async function getSubscription(userId: string): Promise<SubscriptionInfo> {
  try {
    const db = supabaseAdmin()
    
    // 1) Fetch user subscription record
    const { data: sub, error } = await db
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !sub) {
      // Fallback: load Free package details from DB
      const freePkg = await getPackageByCode('free')
      return {
        tier: 'free',
        status: 'active',
        stripe_customer_id: null,
        current_period_end: null,
        contact_limit: freePkg?.contact_limit ?? FALLBACK_LIMITS.free.contacts,
        broadcast_limit: freePkg?.broadcast_limit ?? FALLBACK_LIMITS.free.broadcasts,
        has_api_access: freePkg?.has_api_access ?? FALLBACK_LIMITS.free.api,
        has_bulk_sending: freePkg?.has_bulk_sending ?? FALLBACK_LIMITS.free.bulk,
        has_scheduled_sending: freePkg?.has_scheduled_sending ?? FALLBACK_LIMITS.free.scheduled,
      }
    }

    // Adjust tier to 'free' if subscription has fully expired
    const isPlanExpired = ['unpaid', 'incomplete'].includes(sub.status)
    const tierCode = isPlanExpired ? 'free' : (sub.tier as 'free' | 'pro' | 'enterprise')

    // 2) Fetch dynamic package configuration matching tier code
    const pkg = await getPackageByCode(tierCode)

    if (!pkg) {
      // Fallback to static boundaries if package is not seeded
      const fallback = FALLBACK_LIMITS[tierCode]
      return {
        tier: tierCode,
        status: sub.status,
        stripe_customer_id: sub.stripe_customer_id || null,
        current_period_end: sub.current_period_end || null,
        contact_limit: fallback.contacts,
        broadcast_limit: fallback.broadcasts,
        has_api_access: fallback.api,
        has_bulk_sending: fallback.bulk,
        has_scheduled_sending: fallback.scheduled,
      }
    }

    return {
      tier: tierCode,
      status: sub.status,
      stripe_customer_id: sub.stripe_customer_id || null,
      current_period_end: sub.current_period_end || null,
      contact_limit: pkg.contact_limit,
      broadcast_limit: pkg.broadcast_limit,
      has_api_access: pkg.has_api_access,
      has_bulk_sending: pkg.has_bulk_sending,
      has_scheduled_sending: pkg.has_scheduled_sending,
    }
  } catch (err) {
    console.error(`[limits] Error fetching subscription/plan for user ${userId}:`, err)
    return {
      tier: 'free',
      status: 'active',
      stripe_customer_id: null,
      current_period_end: null,
      contact_limit: FALLBACK_LIMITS.free.contacts,
      broadcast_limit: FALLBACK_LIMITS.free.broadcasts,
      has_api_access: FALLBACK_LIMITS.free.api,
      has_bulk_sending: FALLBACK_LIMITS.free.bulk,
      has_scheduled_sending: FALLBACK_LIMITS.free.scheduled,
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
    const limit = sub.contact_limit

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
    const limit = sub.broadcast_limit

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
  return sub.has_api_access
}

/**
 * Checks if the user's plan has bulk sending / broadcasts enabled.
 */
export async function hasBulkSending(userId: string): Promise<boolean> {
  const sub = await getSubscription(userId)
  return sub.has_bulk_sending
}

/**
 * Checks if the user's plan has scheduled messages sending enabled.
 */
export async function hasScheduledSending(userId: string): Promise<boolean> {
  const sub = await getSubscription(userId)
  return sub.has_scheduled_sending
}
