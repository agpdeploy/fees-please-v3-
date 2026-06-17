-- Restore extracting full_name from Google auth (raw_user_meta_data)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, onboarding_completed, role)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    false, 
    'player'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;
