-- ============================================================
-- 010_evolution_api_support.sql — Evolution API support
--
-- Idempotent migration — safe to run multiple times.
-- ============================================================

DO $$
BEGIN
  -- Add connection_method column if it does not exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'whatsapp_config' AND column_name = 'connection_method'
  ) THEN
    ALTER TABLE whatsapp_config ADD COLUMN connection_method TEXT NOT NULL DEFAULT 'meta' CHECK (connection_method IN ('meta', 'evolution'));
  END IF;

  -- Add evolution_server_url column if it does not exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'whatsapp_config' AND column_name = 'evolution_server_url'
  ) THEN
    ALTER TABLE whatsapp_config ADD COLUMN evolution_server_url TEXT;
  END IF;

  -- Add evolution_api_key column if it does not exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'whatsapp_config' AND column_name = 'evolution_api_key'
  ) THEN
    ALTER TABLE whatsapp_config ADD COLUMN evolution_api_key TEXT;
  END IF;

  -- Add evolution_instance_name column if it does not exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'whatsapp_config' AND column_name = 'evolution_instance_name'
  ) THEN
    ALTER TABLE whatsapp_config ADD COLUMN evolution_instance_name TEXT;
  END IF;

  -- Add evolution_instance_token column if it does not exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'whatsapp_config' AND column_name = 'evolution_instance_token'
  ) THEN
    ALTER TABLE whatsapp_config ADD COLUMN evolution_instance_token TEXT;
  END IF;
END $$;

-- Drop NOT NULL constraints from phone_number_id and access_token since they are not needed for evolution
ALTER TABLE whatsapp_config ALTER COLUMN phone_number_id DROP NOT NULL;
ALTER TABLE whatsapp_config ALTER COLUMN access_token DROP NOT NULL;
