-- Super Admin Bypass Policies
CREATE POLICY "Super admins can manage all clubs" ON public.clubs FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all teams" ON public.teams FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all players" ON public.players FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all fixtures" ON public.fixtures FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all availability" ON public.availability FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all transactions" ON public.transactions FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all user_roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all seasons" ON public.seasons FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all email_logs" ON public.email_logs FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can manage all email_reports" ON public.email_reports FOR ALL TO authenticated USING (public.is_super_admin());
