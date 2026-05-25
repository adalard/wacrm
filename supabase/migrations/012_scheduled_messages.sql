-- ============================================================
-- Migration 012: Scheduled Messages
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_phone TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'template')),
  content_text TEXT,
  template_name TEXT,
  template_language TEXT DEFAULT 'en_US',
  template_params JSONB, -- JSON array of parameters
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  error_message TEXT,
  whatsapp_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user_id ON scheduled_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status_scheduled_for ON scheduled_messages(status, scheduled_for);

-- Enable RLS
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can manage own scheduled messages" ON scheduled_messages;
CREATE POLICY "Users can manage own scheduled messages" ON scheduled_messages
  FOR ALL USING (auth.uid() = user_id);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON scheduled_messages;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
