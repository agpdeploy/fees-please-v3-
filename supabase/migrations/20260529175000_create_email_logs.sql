CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    resend_id TEXT,
    fixture_id UUID REFERENCES public.fixtures(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    status TEXT
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for authenticated users only" ON public.email_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable select for authenticated users only" ON public.email_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable update for authenticated users only" ON public.email_logs FOR UPDATE TO authenticated USING (true);
