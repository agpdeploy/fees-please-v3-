ALTER TABLE "public"."fixtures"
ADD COLUMN IF NOT EXISTS "reminder_sent" boolean DEFAULT false;
