import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWhatsAppClient } from '@/lib/whatsapp/client-factory'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import {
  createInstance,
  getConnectionState,
  configureWebhook,
} from '@/lib/whatsapp/evolution-api'

function decryptSafely(val: string | null | undefined): string {
  if (!val) return ''
  try {
    return decrypt(val)
  } catch (err) {
    return val
  }
}

/**
 * GET /api/whatsapp/config
 *
 * Checks connection health of the saved configuration.
 * Works polymorphically for both Meta and Evolution.
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (configError) {
      console.error('[whatsapp/config GET] DB error:', configError)
      return NextResponse.json(
        { connected: false, reason: 'db_error', message: 'Failed to fetch configuration' },
        { status: 200 }
      )
    }

    if (!config) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'no_config',
          message: 'No WhatsApp configuration saved yet. Choose a method and configure your account.',
        },
        { status: 200 }
      )
    }

    // Check token encryption integrity
    const method = config.connection_method || 'meta'
    if (method === 'meta') {
      try {
        if (config.access_token) decrypt(config.access_token)
      } catch (err) {
        return NextResponse.json(
          {
            connected: false,
            reason: 'token_corrupted',
            needs_reset: true,
            message: 'Meta access token cannot be decrypted. Reset configuration and save again.',
          },
          { status: 200 }
        )
      }
    } else {
      try {
        if (config.evolution_api_key) decrypt(config.evolution_api_key)
      } catch (err) {
        return NextResponse.json(
          {
            connected: false,
            reason: 'token_corrupted',
            needs_reset: true,
            message: 'Evolution API key cannot be decrypted. Reset configuration and save again.',
          },
          { status: 200 }
        )
      }
    }

    // Call factory testConnection
    const client = getWhatsAppClient(config, supabase)
    const result = await client.testConnection()

    if (result.connected) {
      return NextResponse.json({
        connected: true,
        connection_method: method,
        phone_info: result.phoneInfo,
      })
    } else {
      return NextResponse.json({
        connected: false,
        connection_method: method,
        reason: method === 'meta' ? 'meta_api_error' : 'evolution_api_error',
        message: result.message || 'API connection failed',
      })
    }
  } catch (error) {
    console.error('Error in WhatsApp config GET:', error)
    return NextResponse.json(
      { connected: false, reason: 'unknown', message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/whatsapp/config
 *
 * Saves or updates WhatsApp credentials for the authenticated tenant.
 * Self-heals/registers Evolution instances and webhooks.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      connection_method = 'meta',
      // Meta params
      phone_number_id,
      waba_id,
      access_token,
      verify_token,
      // Evolution params
      evolution_server_url,
      evolution_api_key,
      evolution_instance_name,
    } = body

    // 1) Handle Evolution API Save Flow
    if (connection_method === 'evolution') {
      if (!evolution_server_url || !evolution_api_key || !evolution_instance_name) {
        return NextResponse.json(
          { error: 'Server URL, Global API Key, and Instance Name are required.' },
          { status: 400 }
        )
      }

      const cleanServerUrl = evolution_server_url.trim().replace(/\/+$/, '')
      const cleanInstanceName = evolution_instance_name.trim().replace(/\s+/g, '_')

      // Check active connection or auto-create
      let instanceToken = evolution_api_key // Default token is the global key
      let isConnected = false

      try {
        const state = await getConnectionState({
          config: {
            serverUrl: cleanServerUrl,
            apiKey: evolution_api_key,
            instanceName: cleanInstanceName,
          },
        })
        isConnected = state.connected
      } catch (err) {
        // Instance does not exist or server returned error -> let's auto-create it
        console.log(`[config/route] Instance ${cleanInstanceName} not found. Attempting auto-creation…`)
        try {
          const createResult = await createInstance({
            serverUrl: cleanServerUrl,
            apiKey: evolution_api_key,
            instanceName: cleanInstanceName,
          })
          instanceToken = createResult.token
        } catch (createErr: any) {
          console.error('[config/route] Auto-creation failed:', createErr)
          return NextResponse.json(
            { error: `Evolution server rejected instance configuration: ${createErr.message}` },
            { status: 400 }
          )
        }
      }

      // Automatically configure webhooks on the Evolution server
      let baseOrigin = process.env.NEXT_PUBLIC_APP_URL || '';
      if (!baseOrigin) {
        const requestUrl = new URL(request.url);
        baseOrigin = requestUrl.origin;
      }
      // Strip trailing slash if present
      baseOrigin = baseOrigin.replace(/\/$/, "");

      let webhookUrl = `${baseOrigin}/api/whatsapp/webhook/evolution`;
      
      // Local development Docker network bypass
      if (webhookUrl.includes('localhost') || webhookUrl.includes('127.0.0.1')) {
        webhookUrl = webhookUrl
          .replace('localhost', 'host.docker.internal')
          .replace('127.0.0.1', 'host.docker.internal');
      }

      try {
        await configureWebhook({
          config: {
            serverUrl: cleanServerUrl,
            apiKey: evolution_api_key,
            instanceName: cleanInstanceName,
          },
          webhookUrl,
        })
        console.log(`[config/route] Successfully configured webhook: ${webhookUrl}`)
      } catch (webhookErr: any) {
        console.warn('[config/route] Self-webhook configuration failed:', webhookErr.message)
        // Swallow so we still save the credentials, but alert the server logs
      }

      // Encrypt sensitive fields
      const encryptedApiKey = encrypt(evolution_api_key)
      const encryptedInstanceToken = encrypt(instanceToken)

      // Upsert
      const { data: existing } = await supabase
        .from('whatsapp_config')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      const configPayload = {
        connection_method: 'evolution',
        evolution_server_url: cleanServerUrl,
        evolution_api_key: encryptedApiKey,
        evolution_instance_name: cleanInstanceName,
        evolution_instance_token: encryptedInstanceToken,
        // Reset Meta columns
        phone_number_id: null,
        access_token: null,
        waba_id: null,
        verify_token: null,
        status: isConnected ? 'connected' : 'disconnected',
        connected_at: isConnected ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }

      let dbError = null
      if (existing) {
        const { error } = await supabase
          .from('whatsapp_config')
          .update(configPayload)
          .eq('user_id', user.id)
        dbError = error
      } else {
        const { error } = await supabase
          .from('whatsapp_config')
          .insert({
            user_id: user.id,
            ...configPayload,
            connected_at: isConnected ? new Date().toISOString() : null,
          })
        dbError = error
      }

      if (dbError) {
        console.error('[config/route] Failed to save configuration to DB:', dbError)
        return NextResponse.json({ error: 'Failed to write configuration to database' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        phone_info: {
          id: cleanInstanceName,
          display_phone_number: cleanInstanceName,
          verified_name: `Evolution (${cleanInstanceName})`,
        },
      })
    }

    // 2) Handle Meta API Save Flow
    if (!access_token || !phone_number_id) {
      return NextResponse.json(
        { error: 'access_token and phone_number_id are required' },
        { status: 400 }
      )
    }

    // Polymorphic Meta verify
    const client = getWhatsAppClient({
      connection_method: 'meta',
      phone_number_id,
      access_token: encrypt(access_token),
    })

    const verifyResult = await client.testConnection()
    if (!verifyResult.connected) {
      return NextResponse.json(
        { error: verifyResult.message || 'Meta API rejected these credentials.' },
        { status: 400 }
      )
    }

    // Encrypt sensitive columns
    const encryptedAccessToken = encrypt(access_token)
    const encryptedVerifyToken = verify_token ? encrypt(verify_token) : null

    // Upsert Meta credentials
    const { data: existing } = await supabase
      .from('whatsapp_config')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    const configPayload = {
      connection_method: 'meta',
      phone_number_id,
      waba_id: waba_id || null,
      access_token: encryptedAccessToken,
      verify_token: encryptedVerifyToken,
      // Clear Evolution columns
      evolution_server_url: null,
      evolution_api_key: null,
      evolution_instance_name: null,
      evolution_instance_token: null,
      status: 'connected',
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    let dbError = null
    if (existing) {
      const { error } = await supabase
        .from('whatsapp_config')
        .update(configPayload)
        .eq('user_id', user.id)
      dbError = error
    } else {
      const { error } = await supabase
        .from('whatsapp_config')
        .insert({
          user_id: user.id,
          ...configPayload,
        })
      dbError = error
    }

    if (dbError) {
      console.error('[config/route] Failed to save Meta config:', dbError)
      return NextResponse.json({ error: 'Failed to write configuration to database' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      phone_info: verifyResult.phoneInfo,
    })
  } catch (error) {
    console.error('Error in WhatsApp config POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/whatsapp/config
 *
 * Clears the configuration row.
 */
export async function DELETE() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error: deleteError } = await supabase
      .from('whatsapp_config')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting whatsapp_config:', deleteError)
      return NextResponse.json({ error: 'Failed to delete configuration' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in WhatsApp config DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
