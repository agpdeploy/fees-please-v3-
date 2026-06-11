-- Add is_active flags for soft deactivation
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    actor_id uuid,
    action_type text NOT NULL,
    table_name text NOT NULL,
    record_id uuid,
    old_data jsonb,
    new_data jsonb,
    timestamp timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow super admins to view audit logs
DROP POLICY IF EXISTS "Super admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Super admins can view audit logs"
    ON public.audit_logs
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (public.is_super_admin());

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id uuid;
    record_id_val uuid;
    old_json jsonb := NULL;
    new_json jsonb := NULL;
BEGIN
    -- Attempt to get the current user ID from the auth context
    current_user_id := auth.uid();
    
    IF (TG_OP = 'DELETE') THEN
        record_id_val := OLD.id;
        old_json := to_jsonb(OLD);
    ELSIF (TG_OP = 'UPDATE') THEN
        record_id_val := NEW.id;
        old_json := to_jsonb(OLD);
        new_json := to_jsonb(NEW);
    ELSIF (TG_OP = 'INSERT') THEN
        record_id_val := NEW.id;
        new_json := to_jsonb(NEW);
    END IF;

    INSERT INTO public.audit_logs (actor_id, action_type, table_name, record_id, old_data, new_data)
    VALUES (current_user_id, TG_OP, TG_TABLE_NAME, record_id_val, old_json, new_json);

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers to relevant tables
DROP TRIGGER IF EXISTS audit_clubs_changes ON public.clubs;
CREATE TRIGGER audit_clubs_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.clubs
    FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_teams_changes ON public.teams;
CREATE TRIGGER audit_teams_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.teams
    FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_players_changes ON public.players;
CREATE TRIGGER audit_players_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.players
    FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_fixtures_changes ON public.fixtures;
CREATE TRIGGER audit_fixtures_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.fixtures
    FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();


-- Update Drilldown Functions to exclude deactivated clubs and teams

-- 1. Active Teams Paginated
DROP FUNCTION IF EXISTS public.get_active_teams_paginated(INT, INT);
CREATE OR REPLACE FUNCTION public.get_active_teams_paginated(limit_val INT, offset_val INT)
RETURNS TABLE (
  id UUID,
  team_name TEXT,
  club_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  player_count BIGINT,
  fixture_count BIGINT,
  funds_collected NUMERIC,
  club_admins BIGINT,
  team_admins BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    t.id,
    t.name as team_name,
    c.name as club_name,
    t.created_at,
    (SELECT count(*) FROM public.players p WHERE p.default_team_id = t.id) as player_count,
    (SELECT count(*) FROM public.fixtures f WHERE f.team_id = t.id) as fixture_count,
    (SELECT coalesce(sum(amount), 0) FROM public.transactions tr WHERE tr.team_id = t.id AND tr.transaction_type = 'payment') as funds_collected,
    (SELECT count(DISTINCT ur.user_id) FROM public.user_roles ur WHERE ur.club_id = c.id AND ur.role = 'club_admin') as club_admins,
    (SELECT count(DISTINCT ur.user_id) FROM public.user_roles ur WHERE ur.team_id = t.id AND ur.role = 'team_admin') as team_admins
  FROM public.teams t
  LEFT JOIN public.clubs c ON t.club_id = c.id
  WHERE c.deleted_at IS NULL 
    AND coalesce(c.is_active, true) = true 
    AND coalesce(t.is_active, true) = true
  ORDER BY t.created_at DESC
  LIMIT limit_val OFFSET offset_val;
END;
$$;

-- 2. Players Drilldown
DROP FUNCTION IF EXISTS public.get_players_drilldown();
CREATE OR REPLACE FUNCTION public.get_players_drilldown()
RETURNS TABLE (
  id UUID,
  team_name TEXT,
  club_name TEXT,
  total_players BIGINT,
  players_with_contact BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name as team_name,
    c.name as club_name,
    count(p.id) as total_players,
    count(p.id) FILTER (WHERE p.email IS NOT NULL OR p.mobile_number IS NOT NULL) as players_with_contact
  FROM public.teams t
  LEFT JOIN public.clubs c ON t.club_id = c.id
  LEFT JOIN public.players p ON p.default_team_id = t.id
  WHERE c.deleted_at IS NULL 
    AND coalesce(c.is_active, true) = true 
    AND coalesce(t.is_active, true) = true
  GROUP BY t.id, t.name, c.name
  ORDER BY t.created_at DESC;
END;
$$;

-- 3. Funds Drilldown
DROP FUNCTION IF EXISTS public.get_funds_by_team();
CREATE OR REPLACE FUNCTION public.get_funds_by_team()
RETURNS TABLE (
  id UUID,
  team_name TEXT,
  club_name TEXT,
  cash_collected NUMERIC,
  card_collected NUMERIC,
  total_collected NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name as team_name,
    c.name as club_name,
    coalesce(sum(tr.amount) FILTER (WHERE lower(tr.payment_method) = 'cash'), 0) as cash_collected,
    coalesce(sum(tr.amount) FILTER (WHERE lower(tr.payment_method) != 'cash'), 0) as card_collected,
    coalesce(sum(tr.amount), 0) as total_collected
  FROM public.teams t
  LEFT JOIN public.clubs c ON t.club_id = c.id
  LEFT JOIN public.transactions tr ON tr.team_id = t.id AND tr.transaction_type = 'payment'
  WHERE c.deleted_at IS NULL 
    AND coalesce(c.is_active, true) = true 
    AND coalesce(t.is_active, true) = true
  GROUP BY t.id, t.name, c.name
  ORDER BY total_collected DESC, t.created_at DESC;
END;
$$;

-- 4. Onboarding Drilldown
DROP FUNCTION IF EXISTS public.get_onboarding_drilldown();
CREATE OR REPLACE FUNCTION public.get_onboarding_drilldown()
RETURNS TABLE (
  id UUID,
  team_name TEXT,
  club_name TEXT,
  has_club BOOLEAN,
  has_logo BOOLEAN,
  has_players BOOLEAN,
  has_season BOOLEAN,
  has_fixtures BOOLEAN,
  has_financials BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name as team_name,
    c.name as club_name,
    (c.id IS NOT NULL) as has_club,
    (c.logo_url IS NOT NULL AND c.logo_url != '') as has_logo,
    (EXISTS (SELECT 1 FROM public.players p WHERE p.default_team_id = t.id)) as has_players,
    (c.season_name IS NOT NULL AND c.season_name != '') as has_season,
    (EXISTS (SELECT 1 FROM public.fixtures f WHERE f.team_id = t.id)) as has_fixtures,
    (c.pay_id_value IS NOT NULL OR c.is_square_enabled = true) as has_financials
  FROM public.teams t
  LEFT JOIN public.clubs c ON t.club_id = c.id
  WHERE c.deleted_at IS NULL 
    AND coalesce(c.is_active, true) = true 
    AND coalesce(t.is_active, true) = true
  ORDER BY t.created_at DESC;
END;
$$;


CREATE OR REPLACE FUNCTION public.hard_delete_club(p_club_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Super admin check
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Delete all fixtures associated with teams of this club
  DELETE FROM public.fixtures WHERE team_id IN (SELECT id FROM public.teams WHERE club_id = p_club_id);
  
  -- Delete all players associated with teams of this club
  DELETE FROM public.players WHERE default_team_id IN (SELECT id FROM public.teams WHERE club_id = p_club_id);
  
  -- Delete all transactions associated with teams of this club
  DELETE FROM public.transactions WHERE team_id IN (SELECT id FROM public.teams WHERE club_id = p_club_id);
  
  -- Delete user roles for this club
  DELETE FROM public.user_roles WHERE club_id = p_club_id;
  
  -- Delete teams
  DELETE FROM public.teams WHERE club_id = p_club_id;
  
  -- Finally, delete the club
  DELETE FROM public.clubs WHERE id = p_club_id;
END;
$$;


-- Add is_active flag for soft deactivation on fixtures
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;


-- Super Admin Bypass Policies
CREATE POLICY "Super admins can manage all clubs" ON public.clubs FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all teams" ON public.teams FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all players" ON public.players FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all fixtures" ON public.fixtures FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all availability" ON public.availability FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all transactions" ON public.transactions FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all user_roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all seasons" ON public.seasons FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all email_logs" ON public.email_logs FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all email_reports" ON public.email_reports FOR ALL TO authenticated USING (public.is_super_admin());


