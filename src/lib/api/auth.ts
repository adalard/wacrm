import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Lazy-initialized admin Supabase client to bypass RLS for API Key verification
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

/**
 * Computes the SHA-256 hash of a string.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Generates a new secure API key and its non-sensitive prefix.
 * @returns { rawKey: string, prefix: string, hash: string }
 */
export function generateApiKey(): { rawKey: string; prefix: string; hash: string } {
  const randomHex = crypto.randomBytes(32).toString('hex')
  const rawKey = `wac_${randomHex}`
  const prefix = rawKey.substring(0, 10) // e.g., 'wac_a1b2c3'
  const hash = hashApiKey(rawKey)

  return { rawKey, prefix, hash }
}

/**
 * Authenticates a request by checking the Authorization header.
 * Extracts the bearer token, hashes it, and queries the database for the matching tenant.
 * Updates the last_used_at timestamp asynchronously.
 * 
 * @param request NextJS Request object
 * @returns UUID string of the authenticated user_id, or null if unauthorized
 */
export async function authenticateApiKey(request: Request): Promise<string | null> {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const rawKey = authHeader.substring(7).trim()
    if (!rawKey.startsWith('wac_')) {
      return null
    }

    const keyHash = hashApiKey(rawKey)
    const db = supabaseAdmin()

    const { data: apiKey, error } = await db
      .from('api_keys')
      .select('id, user_id')
      .eq('key_hash', keyHash)
      .maybeSingle()

    if (error || !apiKey) {
      return null
    }

    // Update last_used_at asynchronously (fire-and-forget) to minimize request latency
    void db
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKey.id)
      .then(({ error: updateErr }: { error: any }) => {
        if (updateErr) {
          console.warn(`[auth] Failed to update last_used_at for key ${apiKey.id}:`, updateErr.message)
        }
      })

    return apiKey.user_id
  } catch (error) {
    console.error('[auth] Error authenticating API key:', error)
    return null
  }
}
