-- ============================================================
-- DYNAMIC PLANS PACKAGES & SYSTEM SETTINGS SCHEMA
-- Idempotent migration — safe to run multiple times.
-- ============================================================

-- 1) Create packages table
CREATE TABLE IF NOT EXISTS public.packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  price_monthly NUMERIC NOT NULL DEFAULT 0,
  price_yearly NUMERIC NOT NULL DEFAULT 0,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  contact_limit INTEGER NOT NULL DEFAULT 100, -- -1 represents unlimited
  broadcast_limit INTEGER NOT NULL DEFAULT 50, -- -1 represents unlimited
  has_api_access BOOLEAN NOT NULL DEFAULT false,
  has_bulk_sending BOOLEAN NOT NULL DEFAULT false,
  has_scheduled_sending BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing packages
CREATE INDEX IF NOT EXISTS idx_packages_code ON public.packages(code);

-- Enable RLS for packages
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Public authenticated users can read packages" ON public.packages;
DROP POLICY IF EXISTS "Admins can manage packages" ON public.packages;

-- RLS Policies
CREATE POLICY "Public authenticated users can read packages" ON public.packages 
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage packages" ON public.packages 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

-- Pre-seed default packages (Free, Pro, Enterprise)
INSERT INTO public.packages (name, code, price_monthly, price_yearly, contact_limit, broadcast_limit, has_api_access, has_bulk_sending, has_scheduled_sending)
VALUES 
  ('Free Starter', 'free', 0, 0, 100, 50, false, false, false),
  ('Professional', 'pro', 29, 23, -1, -1, true, true, true),
  ('Enterprise', 'enterprise', 149, 119, -1, -1, true, true, true)
ON CONFLICT (code) DO UPDATE 
SET 
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  contact_limit = EXCLUDED.contact_limit,
  broadcast_limit = EXCLUDED.broadcast_limit,
  has_api_access = EXCLUDED.has_api_access,
  has_bulk_sending = EXCLUDED.has_bulk_sending,
  has_scheduled_sending = EXCLUDED.has_scheduled_sending;


-- 2) Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing settings
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(key);

-- Enable RLS for settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Admins can read system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can manage system_settings" ON public.system_settings;

-- RLS Policies (Settings are restricted to Admin role ONLY, not readable by standard tenants)
CREATE POLICY "Admins can read system_settings" ON public.system_settings 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can manage system_settings" ON public.system_settings 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

-- Auto-update updated_at for packages and settings
DROP TRIGGER IF EXISTS set_updated_at ON public.packages;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.packages 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.system_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.system_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
