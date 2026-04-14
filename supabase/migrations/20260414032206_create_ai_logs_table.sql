-- Create the AI Logs table
CREATE TABLE IF NOT EXISTS public.ai_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    session_id TEXT, -- To track the conversation thread
    user_id UUID REFERENCES auth.users(id), -- Optional: if you want to know which user dAIve is helping
    prompt TEXT NOT NULL, -- What you/the user said
    response TEXT NOT NULL, -- What dAIve said back
    metadata JSONB DEFAULT '{}'::jsonb, -- Store "inner thoughts," tokens, or puppet persona info
    feedback_rating INT CHECK (feedback_rating >= 1 AND feedback_rating <= 5) -- For that feedback widget
);

-- Enable RLS (Since we enabled it by default in your new project)
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;

-- Allow dAIve (Service Role) to do anything
CREATE POLICY "Service role has full access" 
ON public.ai_logs 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);