-- ============================================================
-- TEAMMATES & ASSIGNEES SCHEMA
-- Idempotent migration — safe to run multiple times.
-- ============================================================

-- 1) Create assignees table
CREATE TABLE IF NOT EXISTS public.assignees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'sales_rep' CHECK (role IN ('sales_rep', 'support_agent', 'manager')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_assignees_user_id ON public.assignees(user_id);

-- Enable RLS
ALTER TABLE public.assignees ENABLE ROW LEVEL SECURITY;

-- Drop legacy constraints & policies
DROP POLICY IF EXISTS "Users can manage own assignees" ON public.assignees;

-- RLS Policy: Users can only see and manage their own teammates
CREATE POLICY "Users can manage own assignees" ON public.assignees
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger auto-update updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.assignees;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.assignees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 2) Update deals schema and foreign key
-- Set any existing deals.assigned_to to NULL if they point to profiles (no longer valid UUID in public.assignees)
UPDATE public.deals SET assigned_to = NULL;

ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_assigned_to_fkey;

ALTER TABLE public.deals ADD CONSTRAINT deals_assigned_to_fkey 
  FOREIGN KEY (assigned_to) REFERENCES public.assignees(id) ON DELETE SET NULL;


-- 3) Update conversations schema and foreign key
-- Set any existing conversations.assigned_agent_id to NULL
UPDATE public.conversations SET assigned_agent_id = NULL;

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_assigned_agent_id_fkey;

ALTER TABLE public.conversations ADD CONSTRAINT conversations_assigned_agent_id_fkey 
  FOREIGN KEY (assigned_agent_id) REFERENCES public.assignees(id) ON DELETE SET NULL;


-- 4) Update signup trigger public.handle_new_user() to auto-provision a default assignee
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

  -- Insert default teammate assignee ("Me")
  INSERT INTO public.assignees (user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Me'),
    NEW.email,
    'manager'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to initialize tenant assets for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Backfill default assignees for all existing profiles if they don't have any
INSERT INTO public.assignees (user_id, name, email, role)
SELECT user_id, COALESCE(full_name, 'Me'), email, 'manager'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.assignees a WHERE a.user_id = p.user_id AND a.role = 'manager'
);
