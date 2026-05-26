-- Add soft delete column to clubs
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Update RLS policy to restrict DELETE on clubs to super_admin only
-- First, ensure RLS is enabled
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- Drop existing delete policy if it exists (assuming it might be named broadly)
-- We will just add a strict delete policy.
DROP POLICY IF EXISTS "Enable delete for super admin" ON public.clubs;

CREATE POLICY "Enable delete for super admin" ON public.clubs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  )
);

-- RPC for Super Admin Stats
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
  v_total_profiles INT;
  v_onboarded_profiles INT;
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
  
  SELECT coalesce(sum(amount), 0) INTO v_total_funds FROM public.transactions WHERE transaction_type = 'payment';
  
  SELECT count(*) INTO v_total_profiles FROM public.profiles;
  SELECT count(*) INTO v_onboarded_profiles FROM public.profiles WHERE has_onboarded = true;

  RETURN json_build_object(
    'total_clubs', v_total_clubs,
    'total_teams', v_total_teams,
    'total_fixtures', v_total_fixtures,
    'total_players', v_total_players,
    'players_with_contact', v_players_with_contact,
    'total_funds', v_total_funds,
    'total_profiles', v_total_profiles,
    'onboarded_profiles', v_onboarded_profiles
  );
END;
$$;

-- RPC for Cross Club Players
CREATE OR REPLACE FUNCTION public.get_cross_club_players()
RETURNS TABLE (
  email TEXT,
  player_names TEXT[],
  club_names TEXT[]
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
    array_agg(DISTINCT c.name)::TEXT[] as club_names
  FROM public.players p
  JOIN public.clubs c ON p.club_id = c.id
  WHERE p.email IS NOT NULL AND p.email != '' AND c.deleted_at IS NULL
  GROUP BY p.email
  HAVING count(DISTINCT p.club_id) > 1
  ORDER BY p.email;
END;
$$;

-- RPC for Paginated Active Clubs
CREATE OR REPLACE FUNCTION public.get_active_clubs_paginated(limit_val INT, offset_val INT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  sport_type TEXT,
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
    c.sport_type,
    (SELECT count(*) FROM public.teams t WHERE t.club_id = c.id) as team_count,
    (SELECT count(*) FROM public.players p WHERE p.club_id = c.id) as player_count
  FROM public.clubs c
  WHERE c.deleted_at IS NULL
  ORDER BY c.created_at DESC
  LIMIT limit_val OFFSET offset_val;
END;
$$;
