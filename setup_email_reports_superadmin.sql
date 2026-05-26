-- Allow super admins to manage all reports
CREATE POLICY "Super admins can manage all reports" ON public.email_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );
