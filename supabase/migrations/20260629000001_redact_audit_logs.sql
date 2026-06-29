CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id uuid;
    record_id_val uuid;
    old_json jsonb := NULL;
    new_json jsonb := NULL;
BEGIN
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

    -- Redact sensitive details for GDPR compliance
    IF TG_TABLE_NAME IN ('profiles', 'players') THEN
        IF old_json IS NOT NULL THEN
            old_json := old_json - 'email' - 'phone' - 'mobile_number' - 'full_name' - 'nickname' - 'first_name' - 'last_name';
        END IF;
        IF new_json IS NOT NULL THEN
            new_json := new_json - 'email' - 'phone' - 'mobile_number' - 'full_name' - 'nickname' - 'first_name' - 'last_name';
        END IF;
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
