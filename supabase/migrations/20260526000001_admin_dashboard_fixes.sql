-- Remove PostHog / Data Expansion / UI Fixes Migration

-- 1. Fix get_active_clubs_paginated by removing sport_type (doesn't exist on clubs)
DROP FUNCTION IF EXISTS public.get_active_clubs_paginated(INT, INT);

CREATE OR REPLACE FUNCTION public.get_active_clubs_paginated(limit_val INT, offset_val INT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  team_count BIGINT,
  player_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is super admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.created_at,
    (SELECT count(*) FROM public.teams t WHERE t.club_id = c.id) as team_count,
    (SELECT count(*) FROM public.players p WHERE p.club_id = c.id) as player_count
  FROM public.clubs c
  WHERE c.deleted_at IS NULL
  ORDER BY c.created_at DESC
  LIMIT limit_val OFFSET offset_val;
END;
$$;

-- 2. Expand get_super_admin_stats to include cash/card funds and email/google logins
DROP FUNCTION IF EXISTS public.get_super_admin_stats();
CREATE OR REPLACE FUNCTION public.get_super_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_clubs INT;
  v_total_teams INT;
  v_total_fixtures INT;
  v_total_players INT;
  v_players_with_contact INT;
  v_total_funds NUMERIC;
  v_cash_funds NUMERIC;
  v_card_funds NUMERIC;
  v_total_profiles INT;
  v_onboarded_profiles INT;
  v_google_logins INT;
  v_email_logins INT;
BEGIN
  -- Check if user is super admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT count(*) INTO v_total_clubs FROM public.clubs WHERE deleted_at IS NULL;
  SELECT count(*) INTO v_total_teams FROM public.teams;
  SELECT count(*) INTO v_total_fixtures FROM public.fixtures;
  SELECT count(*) INTO v_total_players FROM public.players;
  SELECT count(*) INTO v_players_with_contact FROM public.players WHERE email IS NOT NULL OR mobile_number IS NOT NULL;
  
  -- Funds (transaction_type = 'payment')
  SELECT coalesce(sum(amount), 0) INTO v_total_funds FROM public.transactions WHERE transaction_type = 'payment';
  SELECT coalesce(sum(amount), 0) INTO v_cash_funds FROM public.transactions WHERE transaction_type = 'payment' AND lower(payment_method) = 'cash';
  SELECT coalesce(sum(amount), 0) INTO v_card_funds FROM public.transactions WHERE transaction_type = 'payment' AND lower(payment_method) != 'cash';
  
  -- Profiles
  SELECT count(*) INTO v_total_profiles FROM public.profiles;
  SELECT count(*) INTO v_onboarded_profiles FROM public.profiles WHERE has_onboarded = true;

  -- Identity Providers (using auth.identities)
  SELECT count(DISTINCT user_id) INTO v_google_logins FROM auth.identities WHERE provider = 'google';
  SELECT count(DISTINCT user_id) INTO v_email_logins FROM auth.identities WHERE provider = 'email';

  RETURN json_build_object(
    'total_clubs', v_total_clubs,
    'total_teams', v_total_teams,
    'total_fixtures', v_total_fixtures,
    'total_players', v_total_players,
    'players_with_contact', v_players_with_contact,
    'total_funds', v_total_funds,
    'cash_funds', v_cash_funds,
    'card_funds', v_card_funds,
    'total_profiles', v_total_profiles,
    'onboarded_profiles', v_onboarded_profiles,
    'google_logins', v_google_logins,
    'email_logins', v_email_logins
  );
END;
$$;

-- 3. Expand get_cross_club_players to include team names
DROP FUNCTION IF EXISTS public.get_cross_club_players();

CREATE OR REPLACE FUNCTION public.get_cross_club_players()
RETURNS TABLE (
  email TEXT,
  player_names TEXT[],
  club_names TEXT[],
  team_names TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is super admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    p.email,
    array_agg(DISTINCT p.first_name || ' ' || p.last_name)::TEXT[] as player_names,
    array_agg(DISTINCT c.name)::TEXT[] as club_names,
    array_agg(DISTINCT t.name)::TEXT[] as team_names
  FROM public.players p
  JOIN public.clubs c ON p.club_id = c.id
  LEFT JOIN public.teams t ON p.default_team_id = t.id
  WHERE p.email IS NOT NULL AND p.email != '' AND c.deleted_at IS NULL
  GROUP BY p.email
  HAVING count(DISTINCT p.club_id) > 1
  ORDER BY p.email;
END;
$$;
