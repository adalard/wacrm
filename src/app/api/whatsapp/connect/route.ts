import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getConnectionState,
  fetchQRCode,
  logoutInstance,
  type EvolutionConfig,
} from '@/lib/whatsapp/evolution-api'
import { decrypt } from '@/lib/whatsapp/encryption'

function decryptSafely(val: string | null | undefined): string {
  if (!val) return ''
  try {
    return decrypt(val)
  } catch (err) {
    return val
  }
}

/**
 * GET /api/whatsapp/connect
 *
 * Exposes pairing status, connection state, and base64 QR Codes
 * for settings connection interface in Evolution mode.
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

    if (configError || !config) {
      return NextResponse.json(
        { connected: false, message: 'WhatsApp integration not configured.' },
        { status: 200 }
      )
    }

    if (config.connection_method !== 'evolution') {
      return NextResponse.json({
        connected: false,
        message: 'Current connection method is not Evolution API',
      })
    }

    const serverUrl = config.evolution_server_url || ''
    const apiKey = decryptSafely(config.evolution_api_key)
    const instanceName = config.evolution_instance_name || ''

    const evolutionConfig: EvolutionConfig = {
      serverUrl,
      apiKey,
      instanceName,
    }

    // 1) Query Connection State
    try {
      const state = await getConnectionState({ config: evolutionConfig })

      if (state.connected) {
        // Update database connection status if connected
        if (config.status !== 'connected') {
          await supabase
            .from('whatsapp_config')
            .update({
              status: 'connected',
              connected_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id)
        }

        return NextResponse.json({
          connected: true,
          status: 'CONNECTED',
          instanceName,
        })
      }

      // 2) If disconnected, fetch pairing QR Code
      const qrResult = await fetchQRCode({ config: evolutionConfig })

      return NextResponse.json({
        connected: false,
        status: state.status || 'DISCONNECTED',
        instanceName,
        code: qrResult.code,
        base64: qrResult.base64,
      })
    } catch (err: any) {
      console.error('[whatsapp/connect GET] Evolution error:', err)
      return NextResponse.json({
        connected: false,
        status: 'OFFLINE',
        message: err.message || 'Failed to reach Evolution API server',
      })
    }
  } catch (error) {
    console.error('Error in WhatsApp connect GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/whatsapp/connect
 *
 * Handles actions like "logout" (disconnecting the session).
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

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (configError || !config) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    if (config.connection_method !== 'evolution') {
      return NextResponse.json({ error: 'Action only supported for Evolution API' }, { status: 400 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'logout') {
      const serverUrl = config.evolution_server_url || ''
      const apiKey = decryptSafely(config.evolution_api_key)
      const instanceName = config.evolution_instance_name || ''

      const evolutionConfig: EvolutionConfig = {
        serverUrl,
        apiKey,
        instanceName,
      }

      try {
        await logoutInstance({ config: evolutionConfig })
      } catch (err: any) {
        console.warn('[whatsapp/connect POST] Logout error on Evolution server:', err.message)
        // Proceed anyway to clear it in the CRM db
      }

      // Update local db
      await supabase
        .from('whatsapp_config')
        .update({
          status: 'disconnected',
          connected_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in WhatsApp connect POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
