ALTER TABLE "public"."players"
ADD COLUMN IF NOT EXISTS "email" text,
ADD COLUMN IF NOT EXISTS "unsubscribed" boolean DEFAULT false;
