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
