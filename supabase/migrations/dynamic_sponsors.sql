CREATE TABLE IF NOT EXISTS public.team_sponsors (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
    name text,
    logo_url text,
    url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for team_sponsors
ALTER TABLE public.team_sponsors ENABLE ROW LEVEL SECURITY;

-- Create policy for public viewing
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.team_sponsors FOR SELECT USING (true);

-- Create policy for club admins to manage their team's sponsors
CREATE POLICY "Club admins can insert team sponsors" 
ON public.team_sponsors FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN teams t ON ur.club_id = t.club_id 
    WHERE ur.user_id = auth.uid() AND t.id = team_sponsors.team_id
  )
);

CREATE POLICY "Club admins can update team sponsors" 
ON public.team_sponsors FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN teams t ON ur.club_id = t.club_id 
    WHERE ur.user_id = auth.uid() AND t.id = team_sponsors.team_id
  )
);

CREATE POLICY "Club admins can delete team sponsors" 
ON public.team_sponsors FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN teams t ON ur.club_id = t.club_id 
    WHERE ur.user_id = auth.uid() AND t.id = team_sponsors.team_id
  )
);

-- Alter sponsor_analytics
ALTER TABLE public.sponsor_analytics ADD COLUMN IF NOT EXISTS sponsor_id uuid REFERENCES public.team_sponsors(id) ON DELETE SET NULL;
