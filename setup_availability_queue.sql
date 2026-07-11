CREATE TABLE IF NOT EXISTS public.availability_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    fixture_id UUID REFERENCES public.fixtures(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    status TEXT NOT NULL
);

ALTER TABLE public.availability_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for service role" ON public.availability_queue FOR ALL USING (true) WITH CHECK (true);
