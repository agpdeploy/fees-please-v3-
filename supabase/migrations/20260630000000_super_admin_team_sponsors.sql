-- Add Super Admin override policy for team_sponsors
CREATE POLICY "Super admins can manage all team_sponsors" 
ON public.team_sponsors FOR ALL TO authenticated 
USING (public.is_super_admin());
