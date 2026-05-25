-- ============================================================
-- Migration 016: Multi-User Collaboration & Teammate Logins
-- Idempotent migration — safe to run multiple times.
-- ============================================================

-- 1) Alter assignees table to support login invitation tokens
ALTER TABLE public.assignees ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.assignees ADD COLUMN IF NOT EXISTS invite_token UUID DEFAULT uuid_generate_v4();
ALTER TABLE public.assignees ADD COLUMN IF NOT EXISTS invite_status TEXT DEFAULT 'invited' CHECK (invite_status IN ('invited', 'active'));

-- Ensure any existing 'manager' ("Me") assignees are marked as active and self-linked
UPDATE public.assignees 
SET invite_status = 'active', member_id = user_id 
WHERE role = 'manager' AND member_id IS NULL;

-- 2) Create security definer function to fetch accessible workspaces
CREATE OR REPLACE FUNCTION public.get_accessible_workspace_owners()
RETURNS TABLE (owner_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- The user is the owner of their own workspace
  SELECT auth.uid()
  UNION
  -- The user is a teammate of another user's workspace
  SELECT a.user_id
  FROM public.assignees a
  WHERE a.member_id = auth.uid() AND a.invite_status = 'active';
END;
$$;


-- 3) Create transparent user_id override trigger function for active teammates
CREATE OR REPLACE FUNCTION public.resolve_workspace_owner_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  -- Overwrite NULL with auth.uid() if not provided
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  -- Resolve if the current inserting user is an active teammate of another workspace
  SELECT user_id INTO v_owner_id
  FROM public.assignees
  WHERE member_id = NEW.user_id AND invite_status = 'active'
  LIMIT 1;

  -- Override user_id to the workspace owner's ID before insertion
  IF v_owner_id IS NOT NULL THEN
    NEW.user_id := v_owner_id;
  END IF;

  RETURN NEW;
END;
$$;


-- 4) Apply transparent triggers on all tenant resource tables
DROP TRIGGER IF EXISTS trg_resolve_owner_contacts ON public.contacts;
CREATE TRIGGER trg_resolve_owner_contacts BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.resolve_workspace_owner_id();

DROP TRIGGER IF EXISTS trg_resolve_owner_conversations ON public.conversations;
CREATE TRIGGER trg_resolve_owner_conversations BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.resolve_workspace_owner_id();

DROP TRIGGER IF EXISTS trg_resolve_owner_deals ON public.deals;
CREATE TRIGGER trg_resolve_owner_deals BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.resolve_workspace_owner_id();

DROP TRIGGER IF EXISTS trg_resolve_owner_tags ON public.tags;
CREATE TRIGGER trg_resolve_owner_tags BEFORE INSERT ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.resolve_workspace_owner_id();

DROP TRIGGER IF EXISTS trg_resolve_owner_custom_fields ON public.custom_fields;
CREATE TRIGGER trg_resolve_owner_custom_fields BEFORE INSERT ON public.custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.resolve_workspace_owner_id();

DROP TRIGGER IF EXISTS trg_resolve_owner_contact_notes ON public.contact_notes;
CREATE TRIGGER trg_resolve_owner_contact_notes BEFORE INSERT ON public.contact_notes
  FOR EACH ROW EXECUTE FUNCTION public.resolve_workspace_owner_id();

DROP TRIGGER IF EXISTS trg_resolve_owner_whatsapp_config ON public.whatsapp_config;
CREATE TRIGGER trg_resolve_owner_whatsapp_config BEFORE INSERT ON public.whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.resolve_workspace_owner_id();

DROP TRIGGER IF EXISTS trg_resolve_owner_message_templates ON public.message_templates;
CREATE TRIGGER trg_resolve_owner_message_templates BEFORE INSERT ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.resolve_workspace_owner_id();

DROP TRIGGER IF EXISTS trg_resolve_owner_pipelines ON public.pipelines;
CREATE TRIGGER trg_resolve_owner_pipelines BEFORE INSERT ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.resolve_workspace_owner_id();

DROP TRIGGER IF EXISTS trg_resolve_owner_broadcasts ON public.broadcasts;
CREATE TRIGGER trg_resolve_owner_broadcasts BEFORE INSERT ON public.broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.resolve_workspace_owner_id();

DROP TRIGGER IF EXISTS trg_resolve_owner_scheduled_messages ON public.scheduled_messages;
CREATE TRIGGER trg_resolve_owner_scheduled_messages BEFORE INSERT ON public.scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION public.resolve_workspace_owner_id();

DROP TRIGGER IF EXISTS trg_resolve_owner_automations ON public.automations;
CREATE TRIGGER trg_resolve_owner_automations BEFORE INSERT ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.resolve_workspace_owner_id();

DROP TRIGGER IF EXISTS trg_resolve_owner_automation_logs ON public.automation_logs;
CREATE TRIGGER trg_resolve_owner_automation_logs BEFORE INSERT ON public.automation_logs
  FOR EACH ROW EXECUTE FUNCTION public.resolve_workspace_owner_id();

DROP TRIGGER IF EXISTS trg_resolve_owner_assignees ON public.assignees;
CREATE TRIGGER trg_resolve_owner_assignees BEFORE INSERT ON public.assignees
  FOR EACH ROW EXECUTE FUNCTION public.resolve_workspace_owner_id();


-- 5) Update all RLS policies to check accessible workspace owners

-- Profiles RLS
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT
  USING (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Contacts RLS
DROP POLICY IF EXISTS "Users can manage own contacts" ON public.contacts;
CREATE POLICY "Users can manage own contacts" ON public.contacts FOR ALL
  USING (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()))
  WITH CHECK (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()));

-- Tags RLS
DROP POLICY IF EXISTS "Users can manage own tags" ON public.tags;
CREATE POLICY "Users can manage own tags" ON public.tags FOR ALL
  USING (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()))
  WITH CHECK (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()));

-- Contact Tags RLS
DROP POLICY IF EXISTS "Users can manage contact tags" ON public.contact_tags;
CREATE POLICY "Users can manage contact tags" ON public.contact_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND c.user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners())));

-- Custom Fields RLS
DROP POLICY IF EXISTS "Users can manage own custom fields" ON public.custom_fields;
CREATE POLICY "Users can manage own custom fields" ON public.custom_fields FOR ALL
  USING (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()))
  WITH CHECK (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()));

-- Contact Custom Values RLS
DROP POLICY IF EXISTS "Users can manage custom values" ON public.contact_custom_values;
CREATE POLICY "Users can manage custom values" ON public.contact_custom_values FOR ALL
  USING (EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND c.user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners())));

-- Contact Notes RLS
DROP POLICY IF EXISTS "Users can manage own notes" ON public.contact_notes;
CREATE POLICY "Users can manage own notes" ON public.contact_notes FOR ALL
  USING (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()))
  WITH CHECK (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()));

-- Conversations RLS
DROP POLICY IF EXISTS "Users can manage own conversations" ON public.conversations;
CREATE POLICY "Users can manage own conversations" ON public.conversations FOR ALL
  USING (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()))
  WITH CHECK (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()));

-- Messages RLS
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages" ON public.messages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners())));

-- WhatsApp Config RLS
DROP POLICY IF EXISTS "Users can manage own config" ON public.whatsapp_config;
CREATE POLICY "Users can view config" ON public.whatsapp_config FOR SELECT
  USING (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()));
CREATE POLICY "Users can manage config" ON public.whatsapp_config FOR ALL
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.assignees a WHERE a.member_id = auth.uid() AND a.role = 'manager' AND a.user_id = whatsapp_config.user_id))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.assignees a WHERE a.member_id = auth.uid() AND a.role = 'manager' AND a.user_id = whatsapp_config.user_id));

-- Message Templates RLS
DROP POLICY IF EXISTS "Users can manage own templates" ON public.message_templates;
CREATE POLICY "Users can manage own templates" ON public.message_templates FOR ALL
  USING (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()))
  WITH CHECK (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()));

-- Pipelines RLS
DROP POLICY IF EXISTS "Users can manage own pipelines" ON public.pipelines;
CREATE POLICY "Users can manage own pipelines" ON public.pipelines FOR ALL
  USING (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()))
  WITH CHECK (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()));

-- Pipeline Stages RLS
DROP POLICY IF EXISTS "Users can manage pipeline stages" ON public.pipeline_stages;
CREATE POLICY "Users can manage pipeline stages" ON public.pipeline_stages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.pipelines p WHERE p.id = pipeline_id AND p.user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners())));

-- Deals RLS
DROP POLICY IF EXISTS "Users can manage own deals" ON public.deals;
CREATE POLICY "Users can manage own deals" ON public.deals FOR ALL
  USING (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()))
  WITH CHECK (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()));

-- Broadcasts RLS
DROP POLICY IF EXISTS "Users can manage own broadcasts" ON public.broadcasts;
CREATE POLICY "Users can manage own broadcasts" ON public.broadcasts FOR ALL
  USING (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()))
  WITH CHECK (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()));

-- Scheduled Messages RLS
DROP POLICY IF EXISTS "Users can manage own scheduled messages" ON public.scheduled_messages;
CREATE POLICY "Users can manage own scheduled messages" ON public.scheduled_messages FOR ALL
  USING (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()))
  WITH CHECK (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()));

-- Automations RLS
DROP POLICY IF EXISTS "Users can manage own automations" ON public.automations;
CREATE POLICY "Users can manage own automations" ON public.automations FOR ALL
  USING (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()))
  WITH CHECK (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()));

-- Automation Steps RLS
DROP POLICY IF EXISTS "Users can manage steps of own automations" ON public.automation_steps;
CREATE POLICY "Users can manage steps of own automations" ON public.automation_steps FOR ALL
  USING (EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_id AND a.user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners())));

-- Automation Logs RLS
DROP POLICY IF EXISTS "Users can view own automation logs" ON public.automation_logs;
CREATE POLICY "Users can view own automation logs" ON public.automation_logs FOR ALL
  USING (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()))
  WITH CHECK (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()));

-- Assignees RLS
DROP POLICY IF EXISTS "Users can manage own assignees" ON public.assignees;
CREATE POLICY "Users can view assignees" ON public.assignees FOR SELECT
  USING (user_id IN (SELECT owner_id FROM public.get_accessible_workspace_owners()));
CREATE POLICY "Users can manage assignees" ON public.assignees FOR ALL
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.assignees a WHERE a.member_id = auth.uid() AND a.role = 'manager' AND a.user_id = assignees.user_id))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.assignees a WHERE a.member_id = auth.uid() AND a.role = 'manager' AND a.user_id = assignees.user_id));


-- 6) Update handle_new_user signup trigger to intercept and map teammate registrations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_token TEXT;
  v_assignee_id UUID;
BEGIN
  -- Extract invite token from metadata if supplied
  v_invite_token := NEW.raw_user_meta_data->>'invite_token';

  -- Insert profile row
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );

  -- Check if teammate is registering via an invitation token
  IF v_invite_token IS NOT NULL AND v_invite_token <> '' THEN
    SELECT id INTO v_assignee_id 
    FROM public.assignees 
    WHERE invite_token = v_invite_token::UUID AND invite_status = 'invited'
    LIMIT 1;
  END IF;

  -- Fallback to matching pending teammate by email
  IF v_assignee_id IS NULL THEN
    SELECT id INTO v_assignee_id 
    FROM public.assignees 
    WHERE email = NEW.email AND invite_status = 'invited'
    LIMIT 1;
  END IF;

  IF v_assignee_id IS NOT NULL THEN
    -- Update teammate record to link auth user and activate it
    UPDATE public.assignees
    SET member_id = NEW.id,
        invite_status = 'active',
        name = COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), name),
        updated_at = NOW()
    WHERE id = v_assignee_id;
  ELSE
    -- Standard standalone subscriber registration
    -- Insert default Free tier subscription
    INSERT INTO public.subscriptions (user_id, tier, status)
    VALUES (
      NEW.id,
      'free',
      'active'
    );

    -- Auto-provision their default 'manager' ("Me") assignee
    INSERT INTO public.assignees (user_id, name, email, role, invite_status, member_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Me'),
      NEW.email,
      'manager',
      'active',
      NEW.id
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to initialize tenant assets for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
