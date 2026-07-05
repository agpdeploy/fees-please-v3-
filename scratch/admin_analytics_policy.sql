CREATE POLICY "Super admins can manage all sponsor_analytics" 
ON public.sponsor_analytics FOR ALL TO authenticated 
USING (public.is_super_admin());
