CREATE TABLE IF NOT EXISTS public.email_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('club_summary', 'team_summary')),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'fortnightly')),
  schedule_day TEXT NOT NULL DEFAULT 'monday', -- 'monday', 'sunday', etc.
  schedule_time TEXT NOT NULL DEFAULT '08:00',
  last_sent_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Turn on Row Level Security
ALTER TABLE public.email_reports ENABLE ROW LEVEL SECURITY;

-- Allow club admins to manage all reports for their club
CREATE POLICY "Admins can manage club reports" ON public.email_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.club_id = email_reports.club_id 
      AND user_roles.user_id = auth.uid() 
      AND (user_roles.role = 'club_admin' OR user_roles.role = 'super_admin')
    )
  );

-- Allow team admins to manage reports just for their team
CREATE POLICY "Team admins can manage their team reports" ON public.email_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.team_id = email_reports.team_id 
      AND user_roles.user_id = auth.uid() 
      AND user_roles.role = 'team_admin'
    )
  );
