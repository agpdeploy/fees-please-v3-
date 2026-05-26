-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage club reports" ON public.email_reports;
DROP POLICY IF EXISTS "Team admins can manage their team reports" ON public.email_reports;
DROP POLICY IF EXISTS "Super admins can manage all reports" ON public.email_reports;
DROP POLICY IF EXISTS "Club admins can manage club reports" ON public.email_reports;

-- Super Admins can manage all reports
CREATE POLICY "Super admins can manage all reports" ON public.email_reports
  FOR ALL
  USING (public.is_super_admin());

-- Club Admins can manage reports for their club
CREATE POLICY "Club admins can manage club reports" ON public.email_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.club_id = email_reports.club_id 
      AND (user_roles.user_id = auth.uid() OR user_roles.email = (auth.jwt() ->> 'email'))
      AND user_roles.role = 'club_admin'
    )
  );

-- Team Admins can manage reports for their team
CREATE POLICY "Team admins can manage their team reports" ON public.email_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.team_id = email_reports.team_id 
      AND (user_roles.user_id = auth.uid() OR user_roles.email = (auth.jwt() ->> 'email'))
      AND user_roles.role = 'team_admin'
    )
  );
