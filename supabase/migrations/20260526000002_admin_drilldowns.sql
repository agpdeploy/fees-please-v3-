-- Super Admin Drilldowns Migration

-- 1. Active Teams Paginated
CREATE OR REPLACE FUNCTION public.get_active_teams_paginated(limit_val INT, offset_val INT)
RETURNS TABLE (
  id UUID,
  team_name TEXT,
  club_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  player_count BIGINT,
  fixture_count BIGINT,
  funds_collected NUMERIC
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
    (SELECT coalesce(sum(amount), 0) FROM public.transactions tr WHERE tr.team_id = t.id AND tr.transaction_type = 'payment') as funds_collected
  FROM public.teams t
  LEFT JOIN public.clubs c ON t.club_id = c.id
  WHERE c.deleted_at IS NULL
  ORDER BY t.created_at DESC
  LIMIT limit_val OFFSET offset_val;
END;
$$;


-- 2. Players Drilldown
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
  GROUP BY t.id, t.name, c.name
  ORDER BY t.created_at DESC;
END;
$$;


-- 3. Funds Drilldown
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
  GROUP BY t.id, t.name, c.name
  ORDER BY total_collected DESC, t.created_at DESC;
END;
$$;


-- 4. Onboarding Drilldown
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
  ORDER BY t.created_at DESC;
END;
$$;
