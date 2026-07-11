ALTER TABLE "public"."email_reports" 
ADD COLUMN IF NOT EXISTS "send_to_all_admins" BOOLEAN DEFAULT TRUE;
