/**
 * Evolution API helpers (WhatsApp Web Baileys wrapper).
 *
 * Like the Meta API helpers, all functions here accept a single options object
 * (named parameters) to avoid swapped argument bugs.
 */

if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export interface EvolutionConfig {
  serverUrl: string
  apiKey: string
  instanceName: string
}

export interface EvolutionSendResult {
  messageId: string
}

export interface EvolutionConnectionState {
  connected: boolean
  status: string
  state?: string
}

export interface EvolutionQRCodeResult {
  code?: string
  base64?: string
  connected: boolean
}

function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

interface EvolutionErrorResponse {
  message?: string | string[]
  error?: string
}

async function throwEvolutionError(response: Response, fallback: string): Promise<never> {
  let message = fallback
  try {
    const data = (await response.json()) as EvolutionErrorResponse
    if (data.message) {
      message = Array.isArray(data.message) ? data.message.join(', ') : data.message
    } else if (data.error) {
      message = data.error
    }
  } catch {
    // Keep fallback
  }
  throw new Error(message)
}

// ============================================================
// Instance Management
// ============================================================

export interface CreateInstanceArgs {
  serverUrl: string
  apiKey: string
  instanceName: string
}

/**
 * Creates a new instance on the Evolution server.
 * Returns the generated instance token if successful.
 */
export async function createInstance(args: CreateInstanceArgs): Promise<{ token: string }> {
  const { serverUrl, apiKey, instanceName } = args
  const url = `${cleanUrl(serverUrl)}/instance/create`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify({
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    }),
  })

  if (!response.ok) {
    await throwEvolutionError(response, `Failed to create Evolution instance: ${response.status}`)
  }

  const data = await response.json()
  // The token is typically in data.hash.apikey or data.instance.token
  const token = data.hash?.apikey || data.instance?.token || apiKey
  return { token }
}

export interface LogoutInstanceArgs {
  config: EvolutionConfig
}

/**
 * Logs out and deletes the instance from the Evolution server.
 */
export async function logoutInstance(args: LogoutInstanceArgs): Promise<void> {
  const { config } = args
  const url = `${cleanUrl(config.serverUrl)}/instance/logout/${config.instanceName}`

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: config.apiKey,
    },
  })

  // 404 means the instance didn't exist anyway, which is fine for logout
  if (!response.ok && response.status !== 404) {
    await throwEvolutionError(response, `Failed to logout Evolution instance: ${response.status}`)
  }
}

// ============================================================
// Connection & QR Code
// ============================================================

export interface GetConnectionStateArgs {
  config: EvolutionConfig
}

/**
 * Retrieves the connection state of the WhatsApp instance.
 */
export async function getConnectionState(
  args: GetConnectionStateArgs
): Promise<EvolutionConnectionState> {
  const { config } = args
  const url = `${cleanUrl(config.serverUrl)}/instance/connectionState/${config.instanceName}`

  const response = await fetch(url, {
    headers: {
      apikey: config.apiKey,
    },
  })

  if (!response.ok) {
    await throwEvolutionError(response, `Failed to fetch connection state: ${response.status}`)
  }

  const data = await response.json()
  const status = data.instance?.status || 'DISCONNECTED'
  const state = data.instance?.state || 'close'

  return {
    connected: status === 'CONNECTED' || state === 'open',
    status,
    state,
  }
}

export interface FetchQRCodeArgs {
  config: EvolutionConfig
}

/**
 * Retrieves the connection QR Code for pairing the device.
 */
export async function fetchQRCode(args: FetchQRCodeArgs): Promise<EvolutionQRCodeResult> {
  const { config } = args
  const url = `${cleanUrl(config.serverUrl)}/instance/connect/${config.instanceName}`

  const response = await fetch(url, {
    headers: {
      apikey: config.apiKey,
    },
  })

  if (!response.ok) {
    await throwEvolutionError(response, `Failed to fetch QR Code: ${response.status}`)
  }

  const data = await response.json()

  // Evolution returns the base64 string and code
  return {
    code: data.code,
    base64: data.base64, // e.g. "data:image/png;base64,..."
    connected: data.connected || false,
  }
}

// ============================================================
// Webhooks Configuration
// ============================================================

export interface ConfigureWebhookArgs {
  config: EvolutionConfig
  webhookUrl: string
}

/**
 * Sets the webhook target for the instance.
 */
export async function configureWebhook(args: ConfigureWebhookArgs): Promise<void> {
  const { config, webhookUrl } = args
  const url = `${cleanUrl(config.serverUrl)}/webhook/set/${config.instanceName}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.apiKey,
    },
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: webhookUrl,
        headers: {
          'x-wacrm-source': 'evolution-api',
        },
        webhookByEvents: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'SEND_MESSAGE',
        ],
      },
    }),
  })

  if (!response.ok) {
    await throwEvolutionError(response, `Failed to configure webhook: ${response.status}`)
  }
}

// ============================================================
// Messaging & Emulations
// ============================================================

export interface SendEvolutionTextMessageArgs {
  config: EvolutionConfig
  to: string
  text: string
  contextMessageId?: string
}

/**
 * Sends a text message through the Evolution instance.
 */
export async function sendEvolutionTextMessage(
  args: SendEvolutionTextMessageArgs
): Promise<EvolutionSendResult> {
  const { config, to, text, contextMessageId } = args
  const url = `${cleanUrl(config.serverUrl)}/message/sendText/${config.instanceName}`

  // Clean phone number: drop @s.whatsapp.net if present, strip symbols
  let cleanNumber = to.replace(/@s\.whatsapp\.net$/, '').replace(/[+\s-]/g, '')
  // Append standard WhatsApp domain if required by instance
  if (!cleanNumber.includes('@')) {
    cleanNumber = `${cleanNumber}`
  }

  const payload: Record<string, unknown> = {
    number: cleanNumber,
    text,
  }

  // Swipe-reply support for Evolution if contextMessageId is passed
  if (contextMessageId) {
    payload.options = {
      quoted: {
        key: {
          id: contextMessageId,
        },
      },
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.apiKey,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    await throwEvolutionError(response, `Failed to send text message: ${response.status}`)
  }

  const data = await response.json()
  // Evolution returns the Baileys message response shape: { key: { id } }
  const messageId = data.key?.id || data.messageId
  if (!messageId) {
    throw new Error('No message ID returned from Evolution API')
  }

  return { messageId }
}

export interface SendEvolutionMediaMessageArgs {
  config: EvolutionConfig
  to: string
  mediaUrl: string
  mediaType: 'image' | 'video' | 'audio' | 'document'
  caption?: string
  fileName?: string
}

/**
 * Sends a media message (image, video, document, audio) through the Evolution instance.
 */
export async function sendEvolutionMediaMessage(
  args: SendEvolutionMediaMessageArgs
): Promise<EvolutionSendResult> {
  const { config, to, mediaUrl, mediaType, caption, fileName } = args
  const url = `${cleanUrl(config.serverUrl)}/message/sendMedia/${config.instanceName}`

  let cleanNumber = to.replace(/@s\.whatsapp\.net$/, '').replace(/[+\s-]/g, '')

  const payload: Record<string, unknown> = {
    number: cleanNumber,
    mediatype: mediaType,
    media: mediaUrl,
  }

  if (caption) {
    payload.caption = caption
  }
  if (fileName) {
    payload.fileName = fileName
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.apiKey,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    await throwEvolutionError(response, `Failed to send media message: ${response.status}`)
  }

  const data = await response.json()
  const messageId = data.key?.id || data.messageId
  if (!messageId) {
    throw new Error('No message ID returned from Evolution API')
  }

  return { messageId }
}

export interface SendPresenceArgs {
  config: EvolutionConfig
  to: string
  presence: 'composing' | 'recording' | 'paused'
  delay?: number
}

/**
 * Sets the dynamic presence state (e.g. typing indicator) to emulate human actions.
 */
export async function sendPresence(args: SendPresenceArgs): Promise<void> {
  const { config, to, presence, delay = 1200 } = args
  const url = `${cleanUrl(config.serverUrl)}/chat/sendPresence/${config.instanceName}`

  const cleanNumber = to.replace(/@s\.whatsapp\.net$/, '').replace(/[+\s-]/g, '')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.apiKey,
    },
    body: JSON.stringify({
      number: cleanNumber,
      presence,
      delay,
    }),
  })

  // Swallowing minor presence emulation errors so they never block message dispatch
  if (!response.ok) {
    console.warn(`[Evolution presence emulation failed with status: ${response.status}]`)
  }
}
