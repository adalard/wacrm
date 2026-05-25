-- ============================================================
-- SAAS SUBSCRIPTIONS & LIMITS SCHEMA
-- Idempotent migration — safe to run multiple times.
-- ============================================================

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'canceled', 'past_due', 'incomplete', 'unpaid')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;

-- RLS Policies
CREATE POLICY "Users can view own subscription" ON public.subscriptions 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions" ON public.subscriptions 
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- AUTO-UPDATE UPDATED_AT TIMESTAMP
-- ============================================================
DROP TRIGGER IF EXISTS set_updated_at ON public.subscriptions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.subscriptions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUTO-CREATE PROFILE AND SUBSCRIPTION ON USER SIGNUP (REPLACED)
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );

  -- Insert default Free tier subscription
  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (
    NEW.id,
    'free',
    'active'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to initialize tenant assets for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Re-establish the signup trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill subscriptions for any already existing profiles
INSERT INTO public.subscriptions (user_id, tier, status)
SELECT user_id, 'free', 'active' 
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- SAAS LIMITS CHECK TRIGGERS
-- ============================================================

-- 1) Contact creation limit checker
CREATE OR REPLACE FUNCTION public.check_contact_creation_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  -- Resolve active subscription tier
  SELECT tier INTO v_tier FROM public.subscriptions WHERE user_id = NEW.user_id;
  IF v_tier IS NULL THEN
    v_tier := 'free';
  END IF;

  -- Determine contacts cap
  IF v_tier = 'free' THEN
    v_limit := 100;
  ELSE
    -- Unlimited for pro/enterprise
    RETURN NEW;
  END IF;

  -- Count existing contacts
  SELECT COUNT(*)::INTEGER INTO v_count FROM public.contacts WHERE user_id = NEW.user_id;

  -- Block if limit reached
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Contact limit reached. Free Starter accounts are capped at % contacts. Please upgrade inside Billing Settings.', v_limit;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_contact_limit ON public.contacts;
CREATE TRIGGER trg_check_contact_limit
  BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.check_contact_creation_limit();

-- 2) Broadcast creation limit checker
CREATE OR REPLACE FUNCTION public.check_broadcast_creation_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_limit INTEGER;
  v_sent INTEGER;
  v_start TIMESTAMPTZ;
BEGIN
  -- Resolve active subscription tier
  SELECT tier INTO v_tier FROM public.subscriptions WHERE user_id = NEW.user_id;
  IF v_tier IS NULL THEN
    v_tier := 'free';
  END IF;

  -- Determine broadcasts limit
  IF v_tier = 'free' THEN
    v_limit := 50;
  ELSE
    RETURN NEW;
  END IF;

  -- Compute monthly total recipients sent
  v_start := date_trunc('month', NOW());
  SELECT COALESCE(SUM(total_recipients), 0)::INTEGER INTO v_sent 
    FROM public.broadcasts 
    WHERE user_id = NEW.user_id AND created_at >= v_start;

  -- Block if quota exceeded
  IF (v_sent + NEW.total_recipients) > v_limit THEN
    RAISE EXCEPTION 'Monthly broadcast limit reached. Free Starter accounts are capped at % broadcast recipients per calendar month. Current sent: %, Attempting to send: %. Please upgrade inside Billing Settings.', v_limit, v_sent, NEW.total_recipients;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_broadcast_limit ON public.broadcasts;
CREATE TRIGGER trg_check_broadcast_limit
  BEFORE INSERT ON public.broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.check_broadcast_creation_limit();

