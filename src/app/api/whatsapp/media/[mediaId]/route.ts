import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMediaUrl, downloadMedia } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'

function getExtensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/zip': 'zip',
    'application/x-tar': 'tar',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'text/html': 'html',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/aac': 'aac',
  }
  return map[mime.toLowerCase().split(';')[0].trim()] || ''
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { mediaId } = await params

    if (!mediaId) {
      return NextResponse.json(
        { error: 'Media ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch and decrypt WhatsApp config
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp not configured' },
        { status: 400 }
      )
    }

    const connectionMethod = config.connection_method || 'meta'
    let buffer: Buffer
    let contentType: string
    let evolutionFileName: string | undefined

    if (connectionMethod === 'evolution') {
      let apiKey = ''
      try {
        apiKey = decrypt(config.evolution_api_key)
      } catch {
        apiKey = config.evolution_api_key || ''
      }
      const serverUrl = config.evolution_server_url
      const instanceName = config.evolution_instance_name

      if (!serverUrl || !apiKey || !instanceName) {
        return NextResponse.json(
          { error: 'Evolution API not configured correctly' },
          { status: 400 }
        )
      }

      const url = `${serverUrl.replace(/\/+$/, '')}/chat/getBase64FromMediaMessage/${instanceName}`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          message: {
            key: {
              id: mediaId,
            },
          },
          convertToMp4: false,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        console.error('[media/route GET] Evolution API error:', response.status, errorText)
        return NextResponse.json(
          { error: 'Failed to fetch media from Evolution server' },
          { status: response.status }
        )
      }

      const mediaData = await response.json()
      if (!mediaData.base64) {
        return NextResponse.json(
          { error: 'No media base64 data returned' },
          { status: 404 }
        )
      }

      buffer = Buffer.from(mediaData.base64, 'base64')
      contentType = mediaData.mimetype || 'application/octet-stream'
      evolutionFileName = mediaData.fileName
    } else {
      const accessToken = decrypt(config.access_token)

      // Get the download URL from Meta
      const mediaInfo = await getMediaUrl({ mediaId, accessToken })

      // Download the binary data
      const downloadResult = await downloadMedia({
        downloadUrl: mediaInfo.url,
        accessToken,
      })
      buffer = downloadResult.buffer
      contentType = downloadResult.contentType || mediaInfo.mimeType || 'application/octet-stream'
    }

    // Try to get filename from messages DB
    const { data: msg } = await supabase
      .from('messages')
      .select('content_text, content_type')
      .eq('message_id', mediaId)
      .maybeSingle()

    const dbFilename = msg?.content_text
    const isImage = contentType.startsWith('image/')
    const isVideo = contentType.startsWith('video/')
    const isAudio = contentType.startsWith('audio/')
    const isDocument = !isImage && !isVideo && !isAudio

    let filename = dbFilename || evolutionFileName
    if (!filename) {
      const ext = getExtensionFromMime(contentType)
      filename = ext ? `file_${mediaId}.${ext}` : `file_${mediaId}`
    }

    // Ensure the filename doesn't contain path traversal or invalid characters
    const cleanFilename = filename.replace(/[\/\\]/g, '_')
    const safeFilename = cleanFilename.replace(/"/g, '\\"')
    const disposition = isDocument ? 'attachment' : 'inline'

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Content-Disposition': `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}`
      },
    })
  } catch (error) {
    console.error('Error in WhatsApp media GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    )
  }
}
