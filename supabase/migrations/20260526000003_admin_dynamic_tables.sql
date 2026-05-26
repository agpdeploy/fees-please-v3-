-- Dynamic Tables & Admin Counts Migration

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
  ORDER BY t.created_at DESC
  LIMIT limit_val OFFSET offset_val;
END;
$$;
