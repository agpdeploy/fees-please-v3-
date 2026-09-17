-- Add graphic_state to fixtures
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS graphic_state JSONB DEFAULT '{}'::jsonb;

-- Create storage bucket for graphics
INSERT INTO storage.buckets (id, name, public) VALUES ('graphic_uploads', 'graphic_uploads', true) ON CONFLICT DO NOTHING;

-- Set up RLS for graphic_uploads
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'graphic_uploads');
CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'graphic_uploads' AND auth.role() = 'authenticated');
CREATE POLICY "Auth Update" ON storage.objects FOR UPDATE USING (bucket_id = 'graphic_uploads' AND auth.role() = 'authenticated');
CREATE POLICY "Auth Delete" ON storage.objects FOR DELETE USING (bucket_id = 'graphic_uploads' AND auth.role() = 'authenticated');
