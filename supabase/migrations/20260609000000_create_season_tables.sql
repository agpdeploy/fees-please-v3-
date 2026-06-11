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
CREATE POLICY "Enable read access for all users" ON "public"."seasons" FOR SELECT USING (true);
CREATE POLICY "Enable all access for club admins" ON "public"."seasons" FOR ALL USING (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.club_id = seasons.club_id and (profiles.role = 'club_admin' or profiles.role = 'super_admin')
  )
);

CREATE POLICY "Enable read access for all users" ON "public"."team_seasons" FOR SELECT USING (true);
CREATE POLICY "Enable all access for club admins" ON "public"."team_seasons" FOR ALL USING (
  exists (
    select 1 from public.teams t
    join public.profiles p on p.club_id = t.club_id
    where t.id = team_seasons.team_id and p.id = auth.uid() and (p.role = 'club_admin' or p.role = 'super_admin')
  )
);
