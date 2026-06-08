-- Migration: 017_migrate_evolution_media_urls.sql
-- Description: Convert existing direct WhatsApp CDN media URLs to local proxy URLs to enable correct image/media loading in the inbox.

UPDATE messages
SET media_url = '/api/whatsapp/media/' || message_id
WHERE content_type IN ('image', 'video', 'document', 'audio')
  AND media_url LIKE 'https://%whatsapp.net%';
