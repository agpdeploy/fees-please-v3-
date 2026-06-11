CREATE TABLE IF NOT EXISTS "public"."seasons" (
  "id" uuid not null default extensions.uuid_generate_v4(),
  "club_id" uuid references "public"."clubs"(id) on delete cascade,
  "name" text not null,
  "status" text not null default 'active',
  "created_at" timestamp with time zone default now(),
  primary key ("id")
);

ALTER TABLE "public"."seasons" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "public"."team_seasons" (
  "id" uuid not null default extensions.uuid_generate_v4(),
  "team_id" uuid references "public"."teams"(id) on delete cascade,
  "season_id" uuid references "public"."seasons"(id) on delete cascade,
  "playhq_url" text,
  "playhq_tenant" text,
  "playhq_season_id" text,
  "playhq_grade_id" text,
  "created_at" timestamp with time zone default now(),
  primary key ("id")
);

ALTER TABLE "public"."team_seasons" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."teams" ADD COLUMN IF NOT EXISTS "active_season_id" uuid references "public"."seasons"(id) on delete set null;

ALTER TABLE "public"."fixtures" ADD COLUMN IF NOT EXISTS "season_id" uuid references "public"."seasons"(id) on delete set null;

-- RLS Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."seasons";
CREATE POLICY "Enable read access for all users" ON "public"."seasons" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all access for club admins" ON "public"."seasons";
CREATE POLICY "Enable all access for club admins" ON "public"."seasons" FOR ALL USING (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'super_admin'
  ) OR exists (
    select 1 from public.user_roles
    where user_roles.user_id = auth.uid() and user_roles.club_id = seasons.club_id and user_roles.role = 'club_admin'
  )
);

DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."team_seasons";
CREATE POLICY "Enable read access for all users" ON "public"."team_seasons" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all access for club admins" ON "public"."team_seasons";
CREATE POLICY "Enable all access for club admins" ON "public"."team_seasons" FOR ALL USING (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'super_admin'
  ) OR exists (
    select 1 from public.teams t
    join public.user_roles ur on ur.club_id = t.club_id
    where t.id = team_seasons.team_id and ur.user_id = auth.uid() and ur.role = 'club_admin'
  )
);
