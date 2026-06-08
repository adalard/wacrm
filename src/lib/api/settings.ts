import { createClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'

// Lazy-initialized admin Supabase client to bypass RLS for retrieving system settings
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

function decryptSafely(val: string): string {
  try {
    return decrypt(val)
  } catch {
    return val
  }
}

/**
 * Retrieves a system setting value by key. Decrypts automatically if sensitive.
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const db = supabaseAdmin()
    const { data: setting, error } = await db
      .from('system_settings')
      .select('*')
      .eq('key', key)
      .maybeSingle()

    if (error || !setting) return null

    if (setting.is_sensitive) {
      return decryptSafely(setting.value)
    }
    return setting.value
  } catch (err) {
    console.error(`[settings] Error retrieving setting key "${key}":`, err)
    return null
  }
}

/**
 * Saves or updates a system setting. Encrypts automatically if sensitive.
 */
export async function saveSystemSetting(
  key: string,
  value: string,
  isSensitive: boolean = false
): Promise<void> {
  try {
    const db = supabaseAdmin()
    const finalValue = isSensitive ? encrypt(value) : value

    const { error } = await db
      .from('system_settings')
      .upsert({
        key,
        value: finalValue,
        is_sensitive: isSensitive,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

    if (error) throw error
  } catch (err) {
    console.error(`[settings] Error saving setting key "${key}":`, err)
    throw err
  }
}
