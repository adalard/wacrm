import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Lazy-initialized admin Supabase client to bypass RLS for webhook dispatches
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

export type WebhookEventType = 'message.received' | 'message.sent' | 'message.status' | 'message.test'

/**
 * Dispatches a real-time event notification to all registered external webhooks
 * for a specific user that are active and subscribed to the event type.
 *
 * Runs asynchronously and handles all errors internally to avoid disrupting the main flow.
 *
 * @param userId UUID of the user/tenant
 * @param event Type of the event being dispatched
 * @param data Payload data specific to the event
 */
export async function dispatchExternalWebhook(
  userId: string,
  event: WebhookEventType,
  data: any
): Promise<void> {
  // Fire-and-forget the actual dispatching logic to avoid blocking the caller
  void (async () => {
    try {
      const db = supabaseAdmin()

      // Fetch active external webhooks for the user
      const { data: webhooks, error } = await db
        .from('external_webhooks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) {
        console.error(`[webhook-dispatcher] Error fetching webhooks for user ${userId}:`, error.message)
        return
      }

      if (!webhooks || webhooks.length === 0) {
        return
      }

      // Filter webhooks that subscribe to this event type
      const matchingWebhooks = webhooks.filter((wh: any) => {
        // Postgres text[] is returned as a JS array
        const events: string[] = wh.event_types || []
        return events.includes(event)
      })

      if (matchingWebhooks.length === 0) {
        return
      }

      const timestamp = new Date().toISOString()
      const payloadObj = {
        event,
        timestamp,
        user_id: userId,
        data,
      }
      const payloadString = JSON.stringify(payloadObj)

      // Dispatch to each matching webhook URL
      await Promise.all(
        matchingWebhooks.map(async (wh: any) => {
          try {
            // Compute HMAC SHA-256 signature
            const hmac = crypto.createHmac('sha256', wh.secret)
            const signature = `sha256=${hmac.update(payloadString).digest('hex')}`

            const controller = new AbortController()
            const id = setTimeout(() => controller.abort(), 6000) // 6 second timeout

            const response = await fetch(wh.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-WACRM-Signature-256': signature,
                'User-Agent': 'WACRM-Webhook-Dispatcher/1.0',
              },
              body: payloadString,
              signal: controller.signal,
            })

            clearTimeout(id)

            if (!response.ok) {
              console.warn(
                `[webhook-dispatcher] Webhook dispatch to ${wh.url} returned status ${response.status}`
              )
            }
          } catch (dispatchErr) {
            console.error(
              `[webhook-dispatcher] Failed to dispatch to ${wh.url}:`,
              dispatchErr instanceof Error ? dispatchErr.message : dispatchErr
            )
          }
        })
      )
    } catch (err) {
      console.error('[webhook-dispatcher] Unexpected error during dispatching:', err)
    }
  })()
}
