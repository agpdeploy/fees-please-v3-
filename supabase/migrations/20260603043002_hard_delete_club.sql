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
