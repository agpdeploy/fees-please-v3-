drop policy "Clubs are viewable by everyone" on "public"."clubs";

drop policy "Enable insert for authenticated users only" on "public"."email_logs";

drop policy "Enable select for authenticated users only" on "public"."email_logs";

drop policy "Enable update for authenticated users only" on "public"."email_logs";

drop policy "Admins can manage players" on "public"."players";

drop policy "Users can update own profile" on "public"."profiles";


  create table "public"."admin_activity_logs" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone default now(),
    "user_id" uuid,
    "user_email" text,
    "action" text,
    "metadata" jsonb
      );


alter table "public"."admin_activity_logs" enable row level security;


  create table "public"."availability" (
    "id" uuid not null default gen_random_uuid(),
    "player_id" uuid not null,
    "fixture_id" uuid not null,
    "status" text not null,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."availability" enable row level security;


  create table "public"."email_reports" (
    "id" uuid not null default gen_random_uuid(),
    "club_id" uuid,
    "team_id" uuid,
    "report_type" text not null,
    "frequency" text not null,
    "schedule_day" text not null default 'monday'::text,
    "schedule_time" text not null default '08:00'::text,
    "last_sent_at" timestamp with time zone,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."email_reports" enable row level security;


  create table "public"."public_team_profiles" (
    "team_id" uuid not null,
    "team_name" text not null,
    "club_logo_url" text,
    "sponsor_1_logo" text,
    "sponsor_1_url" text,
    "sponsor_2_logo" text,
    "sponsor_2_url" text,
    "sponsor_3_logo" text,
    "sponsor_3_url" text,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."public_team_profiles" enable row level security;


  create table "public"."seasons" (
    "id" uuid not null default gen_random_uuid(),
    "club_id" uuid,
    "name" text not null,
    "start_date" date,
    "end_date" date,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."seasons" enable row level security;


  create table "public"."sponsor_analytics" (
    "id" bigint generated always as identity not null,
    "team_id" uuid,
    "sponsor_index" smallint,
    "event_type" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."sponsor_analytics" enable row level security;

alter table "public"."clubs" add column "announcement" text;

alter table "public"."clubs" add column "club_cat" text;

alter table "public"."clubs" add column "entity_type" text;

alter table "public"."clubs" add column "is_club" boolean default false;

alter table "public"."clubs" add column "owner_id" uuid;

alter table "public"."clubs" add column "pay_id_type" text;

alter table "public"."clubs" add column "pay_id_value" text;

alter table "public"."clubs" add column "settings" jsonb default '{}'::jsonb;

alter table "public"."email_logs" alter column "created_at" set default now();

alter table "public"."email_logs" alter column "created_at" drop not null;

alter table "public"."email_logs" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."email_logs" alter column "resend_id" set not null;

alter table "public"."email_logs" alter column "status" set default 'sent'::text;

alter table "public"."email_logs" alter column "status" set not null;

alter table "public"."email_logs" alter column "updated_at" set default now();

alter table "public"."email_logs" alter column "updated_at" drop not null;

alter table "public"."profiles" add column "onboarding_completed" boolean default false;

alter table "public"."teams" add column "logo_url" text;

alter table "public"."teams" add column "owner_id" uuid;

alter table "public"."teams" add column "slug" text;

alter table "public"."teams" add column "theme_colors" jsonb default '["#10b981", "#064e3b"]'::jsonb;

CREATE UNIQUE INDEX admin_activity_logs_pkey ON public.admin_activity_logs USING btree (id);

CREATE UNIQUE INDEX availability_pkey ON public.availability USING btree (id);

CREATE UNIQUE INDEX availability_player_id_fixture_id_key ON public.availability USING btree (player_id, fixture_id);

CREATE UNIQUE INDEX email_logs_resend_id_key ON public.email_logs USING btree (resend_id);

CREATE UNIQUE INDEX email_reports_pkey ON public.email_reports USING btree (id);

CREATE UNIQUE INDEX public_team_profiles_pkey ON public.public_team_profiles USING btree (team_id);

CREATE UNIQUE INDEX seasons_pkey ON public.seasons USING btree (id);

CREATE UNIQUE INDEX sponsor_analytics_pkey ON public.sponsor_analytics USING btree (id);

CREATE UNIQUE INDEX teams_slug_key ON public.teams USING btree (slug);

alter table "public"."admin_activity_logs" add constraint "admin_activity_logs_pkey" PRIMARY KEY using index "admin_activity_logs_pkey";

alter table "public"."availability" add constraint "availability_pkey" PRIMARY KEY using index "availability_pkey";

alter table "public"."email_reports" add constraint "email_reports_pkey" PRIMARY KEY using index "email_reports_pkey";

alter table "public"."public_team_profiles" add constraint "public_team_profiles_pkey" PRIMARY KEY using index "public_team_profiles_pkey";

alter table "public"."seasons" add constraint "seasons_pkey" PRIMARY KEY using index "seasons_pkey";

alter table "public"."sponsor_analytics" add constraint "sponsor_analytics_pkey" PRIMARY KEY using index "sponsor_analytics_pkey";

alter table "public"."admin_activity_logs" add constraint "admin_activity_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."admin_activity_logs" validate constraint "admin_activity_logs_user_id_fkey";

alter table "public"."availability" add constraint "availability_fixture_id_fkey" FOREIGN KEY (fixture_id) REFERENCES public.fixtures(id) ON DELETE CASCADE not valid;

alter table "public"."availability" validate constraint "availability_fixture_id_fkey";

alter table "public"."availability" add constraint "availability_player_id_fixture_id_key" UNIQUE using index "availability_player_id_fixture_id_key";

alter table "public"."availability" add constraint "availability_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE not valid;

alter table "public"."availability" validate constraint "availability_player_id_fkey";

alter table "public"."availability" add constraint "availability_status_check" CHECK ((status = ANY (ARRAY['yes'::text, 'no'::text, 'maybe'::text]))) not valid;

alter table "public"."availability" validate constraint "availability_status_check";

alter table "public"."clubs" add constraint "clubs_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) not valid;

alter table "public"."clubs" validate constraint "clubs_owner_id_fkey";

alter table "public"."email_logs" add constraint "email_logs_resend_id_key" UNIQUE using index "email_logs_resend_id_key";

alter table "public"."email_reports" add constraint "email_reports_club_id_fkey" FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE not valid;

alter table "public"."email_reports" validate constraint "email_reports_club_id_fkey";

alter table "public"."email_reports" add constraint "email_reports_frequency_check" CHECK ((frequency = ANY (ARRAY['weekly'::text, 'fortnightly'::text]))) not valid;

alter table "public"."email_reports" validate constraint "email_reports_frequency_check";

alter table "public"."email_reports" add constraint "email_reports_report_type_check" CHECK ((report_type = ANY (ARRAY['club_summary'::text, 'team_summary'::text]))) not valid;

alter table "public"."email_reports" validate constraint "email_reports_report_type_check";

alter table "public"."email_reports" add constraint "email_reports_team_id_fkey" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE not valid;

alter table "public"."email_reports" validate constraint "email_reports_team_id_fkey";

alter table "public"."public_team_profiles" add constraint "public_team_profiles_team_id_fkey" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE not valid;

alter table "public"."public_team_profiles" validate constraint "public_team_profiles_team_id_fkey";

alter table "public"."seasons" add constraint "seasons_club_id_fkey" FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE not valid;

alter table "public"."seasons" validate constraint "seasons_club_id_fkey";

alter table "public"."sponsor_analytics" add constraint "sponsor_analytics_event_type_check" CHECK ((event_type = ANY (ARRAY['impression'::text, 'click'::text]))) not valid;

alter table "public"."sponsor_analytics" validate constraint "sponsor_analytics_event_type_check";

alter table "public"."sponsor_analytics" add constraint "sponsor_analytics_team_id_fkey" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE not valid;

alter table "public"."sponsor_analytics" validate constraint "sponsor_analytics_team_id_fkey";

alter table "public"."teams" add constraint "teams_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) not valid;

alter table "public"."teams" validate constraint "teams_owner_id_fkey";

alter table "public"."teams" add constraint "teams_slug_key" UNIQUE using index "teams_slug_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.is_admin_for_report(target_club_id uuid, target_team_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Super admin check via profiles
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RETURN TRUE;
  END IF;

  -- Admin check via user_roles
  IF EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND (
      role = 'super_admin' 
      OR (club_id = target_club_id AND role = 'club_admin')
      OR (team_id = target_team_id AND role = 'team_admin')
    )
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_has_report_access(target_club_id uuid, target_team_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND (
      user_roles.role = 'super_admin' 
      OR (user_roles.club_id = target_club_id AND user_roles.role = 'club_admin')
      OR (user_roles.team_id = target_team_id AND user_roles.role = 'team_admin')
    )
  )
  OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, onboarding_completed, role)
  VALUES (new.id, new.email, false, 'player'); -- Default to player for safety
  RETURN new;
END;
$function$
;

grant delete on table "public"."admin_activity_logs" to "anon";

grant insert on table "public"."admin_activity_logs" to "anon";

grant references on table "public"."admin_activity_logs" to "anon";

grant select on table "public"."admin_activity_logs" to "anon";

grant trigger on table "public"."admin_activity_logs" to "anon";

grant truncate on table "public"."admin_activity_logs" to "anon";

grant update on table "public"."admin_activity_logs" to "anon";

grant delete on table "public"."admin_activity_logs" to "authenticated";

grant insert on table "public"."admin_activity_logs" to "authenticated";

grant references on table "public"."admin_activity_logs" to "authenticated";

grant select on table "public"."admin_activity_logs" to "authenticated";

grant trigger on table "public"."admin_activity_logs" to "authenticated";

grant truncate on table "public"."admin_activity_logs" to "authenticated";

grant update on table "public"."admin_activity_logs" to "authenticated";

grant delete on table "public"."admin_activity_logs" to "service_role";

grant insert on table "public"."admin_activity_logs" to "service_role";

grant references on table "public"."admin_activity_logs" to "service_role";

grant select on table "public"."admin_activity_logs" to "service_role";

grant trigger on table "public"."admin_activity_logs" to "service_role";

grant truncate on table "public"."admin_activity_logs" to "service_role";

grant update on table "public"."admin_activity_logs" to "service_role";

grant delete on table "public"."availability" to "anon";

grant insert on table "public"."availability" to "anon";

grant references on table "public"."availability" to "anon";

grant select on table "public"."availability" to "anon";

grant trigger on table "public"."availability" to "anon";

grant truncate on table "public"."availability" to "anon";

grant update on table "public"."availability" to "anon";

grant delete on table "public"."availability" to "authenticated";

grant insert on table "public"."availability" to "authenticated";

grant references on table "public"."availability" to "authenticated";

grant select on table "public"."availability" to "authenticated";

grant trigger on table "public"."availability" to "authenticated";

grant truncate on table "public"."availability" to "authenticated";

grant update on table "public"."availability" to "authenticated";

grant delete on table "public"."availability" to "service_role";

grant insert on table "public"."availability" to "service_role";

grant references on table "public"."availability" to "service_role";

grant select on table "public"."availability" to "service_role";

grant trigger on table "public"."availability" to "service_role";

grant truncate on table "public"."availability" to "service_role";

grant update on table "public"."availability" to "service_role";

grant delete on table "public"."email_reports" to "anon";

grant insert on table "public"."email_reports" to "anon";

grant references on table "public"."email_reports" to "anon";

grant select on table "public"."email_reports" to "anon";

grant trigger on table "public"."email_reports" to "anon";

grant truncate on table "public"."email_reports" to "anon";

grant update on table "public"."email_reports" to "anon";

grant delete on table "public"."email_reports" to "authenticated";

grant insert on table "public"."email_reports" to "authenticated";

grant references on table "public"."email_reports" to "authenticated";

grant select on table "public"."email_reports" to "authenticated";

grant trigger on table "public"."email_reports" to "authenticated";

grant truncate on table "public"."email_reports" to "authenticated";

grant update on table "public"."email_reports" to "authenticated";

grant delete on table "public"."email_reports" to "service_role";

grant insert on table "public"."email_reports" to "service_role";

grant references on table "public"."email_reports" to "service_role";

grant select on table "public"."email_reports" to "service_role";

grant trigger on table "public"."email_reports" to "service_role";

grant truncate on table "public"."email_reports" to "service_role";

grant update on table "public"."email_reports" to "service_role";

grant delete on table "public"."public_team_profiles" to "anon";

grant insert on table "public"."public_team_profiles" to "anon";

grant references on table "public"."public_team_profiles" to "anon";

grant select on table "public"."public_team_profiles" to "anon";

grant trigger on table "public"."public_team_profiles" to "anon";

grant truncate on table "public"."public_team_profiles" to "anon";

grant update on table "public"."public_team_profiles" to "anon";

grant delete on table "public"."public_team_profiles" to "authenticated";

grant insert on table "public"."public_team_profiles" to "authenticated";

grant references on table "public"."public_team_profiles" to "authenticated";

grant select on table "public"."public_team_profiles" to "authenticated";

grant trigger on table "public"."public_team_profiles" to "authenticated";

grant truncate on table "public"."public_team_profiles" to "authenticated";

grant update on table "public"."public_team_profiles" to "authenticated";

grant delete on table "public"."public_team_profiles" to "service_role";

grant insert on table "public"."public_team_profiles" to "service_role";

grant references on table "public"."public_team_profiles" to "service_role";

grant select on table "public"."public_team_profiles" to "service_role";

grant trigger on table "public"."public_team_profiles" to "service_role";

grant truncate on table "public"."public_team_profiles" to "service_role";

grant update on table "public"."public_team_profiles" to "service_role";

grant delete on table "public"."seasons" to "anon";

grant insert on table "public"."seasons" to "anon";

grant references on table "public"."seasons" to "anon";

grant select on table "public"."seasons" to "anon";

grant trigger on table "public"."seasons" to "anon";

grant truncate on table "public"."seasons" to "anon";

grant update on table "public"."seasons" to "anon";

grant delete on table "public"."seasons" to "authenticated";

grant insert on table "public"."seasons" to "authenticated";

grant references on table "public"."seasons" to "authenticated";

grant select on table "public"."seasons" to "authenticated";

grant trigger on table "public"."seasons" to "authenticated";

grant truncate on table "public"."seasons" to "authenticated";

grant update on table "public"."seasons" to "authenticated";

grant delete on table "public"."seasons" to "service_role";

grant insert on table "public"."seasons" to "service_role";

grant references on table "public"."seasons" to "service_role";

grant select on table "public"."seasons" to "service_role";

grant trigger on table "public"."seasons" to "service_role";

grant truncate on table "public"."seasons" to "service_role";

grant update on table "public"."seasons" to "service_role";

grant delete on table "public"."sponsor_analytics" to "anon";

grant insert on table "public"."sponsor_analytics" to "anon";

grant references on table "public"."sponsor_analytics" to "anon";

grant select on table "public"."sponsor_analytics" to "anon";

grant trigger on table "public"."sponsor_analytics" to "anon";

grant truncate on table "public"."sponsor_analytics" to "anon";

grant update on table "public"."sponsor_analytics" to "anon";

grant delete on table "public"."sponsor_analytics" to "authenticated";

grant insert on table "public"."sponsor_analytics" to "authenticated";

grant references on table "public"."sponsor_analytics" to "authenticated";

grant select on table "public"."sponsor_analytics" to "authenticated";

grant trigger on table "public"."sponsor_analytics" to "authenticated";

grant truncate on table "public"."sponsor_analytics" to "authenticated";

grant update on table "public"."sponsor_analytics" to "authenticated";

grant delete on table "public"."sponsor_analytics" to "service_role";

grant insert on table "public"."sponsor_analytics" to "service_role";

grant references on table "public"."sponsor_analytics" to "service_role";

grant select on table "public"."sponsor_analytics" to "service_role";

grant trigger on table "public"."sponsor_analytics" to "service_role";

grant truncate on table "public"."sponsor_analytics" to "service_role";

grant update on table "public"."sponsor_analytics" to "service_role";


  create policy "Super admins can view logs"
  on "public"."admin_activity_logs"
  as permissive
  for select
  to authenticated
using (((auth.jwt() ->> 'role'::text) = 'super_admin'::text));



  create policy "Public availability access"
  on "public"."availability"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Public can view availability"
  on "public"."availability"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Admins can update their own club"
  on "public"."clubs"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.club_id = clubs.id) AND (user_roles.user_id = auth.uid()) AND (user_roles.role = 'club_admin'::text)))));



  create policy "Public can view clubs"
  on "public"."clubs"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Public select clubs"
  on "public"."clubs"
  as permissive
  for select
  to public
using (true);



  create policy "Users can create their own clubs"
  on "public"."clubs"
  as permissive
  for insert
  to public
with check ((auth.uid() = owner_id));



  create policy "Users can only see their own club"
  on "public"."clubs"
  as permissive
  for select
  to public
using ((id IN ( SELECT user_roles.club_id
   FROM public.user_roles
  WHERE (user_roles.user_id = auth.uid()))));



  create policy "Users can view their own club"
  on "public"."clubs"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.club_id = clubs.id) AND (user_roles.user_id = auth.uid())))));



  create policy "Users can view their own clubs"
  on "public"."clubs"
  as permissive
  for select
  to public
using ((auth.uid() = owner_id));



  create policy "Enable read access for authenticated users"
  on "public"."email_logs"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Club admins can manage club reports"
  on "public"."email_reports"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.club_id = email_reports.club_id) AND ((user_roles.user_id = auth.uid()) OR (user_roles.email = (auth.jwt() ->> 'email'::text))) AND (user_roles.role = 'club_admin'::text)))));



  create policy "Enable ALL access for admins"
  on "public"."email_reports"
  as permissive
  for all
  to authenticated
using (public.is_admin_for_report(club_id, team_id))
with check (public.is_admin_for_report(club_id, team_id));



  create policy "Enable insert for admins"
  on "public"."email_reports"
  as permissive
  for insert
  to public
with check (public.user_has_report_access(club_id, team_id));



  create policy "Enable update for admins"
  on "public"."email_reports"
  as permissive
  for update
  to public
using (public.user_has_report_access(club_id, team_id))
with check (public.user_has_report_access(club_id, team_id));



  create policy "Super admins can manage all reports"
  on "public"."email_reports"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text)))));



  create policy "Team admins can manage their team reports"
  on "public"."email_reports"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.team_id = email_reports.team_id) AND ((user_roles.user_id = auth.uid()) OR (user_roles.email = (auth.jwt() ->> 'email'::text))) AND (user_roles.role = 'team_admin'::text)))));



  create policy "Public can view fixtures"
  on "public"."fixtures"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Public select fixtures"
  on "public"."fixtures"
  as permissive
  for select
  to public
using (true);



  create policy "Team Admins can update their own fixtures"
  on "public"."fixtures"
  as permissive
  for update
  to authenticated
using ((auth.uid() IN ( SELECT user_roles.user_id
   FROM public.user_roles
  WHERE ((user_roles.team_id = fixtures.team_id) AND (user_roles.role = ANY (ARRAY['team_admin'::text, 'club_admin'::text]))))));



  create policy "Team Captains can manage their team squads"
  on "public"."match_squads"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.fixtures f
     JOIN public.user_roles ur ON ((f.team_id = ur.team_id)))
  WHERE ((f.id = match_squads.fixture_id) AND (ur.user_id = auth.uid()) AND (ur.role = 'team_admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM (public.fixtures f
     JOIN public.user_roles ur ON ((f.team_id = ur.team_id)))
  WHERE ((f.id = match_squads.fixture_id) AND (ur.user_id = auth.uid()) AND (ur.role = 'team_admin'::text)))));



  create policy "Managers can edit players"
  on "public"."players"
  as permissive
  for all
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.club_id = user_roles.club_id) AND (user_roles.role = 'club_admin'::text)))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text))))))
with check (((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.club_id = user_roles.club_id) AND (user_roles.role = 'club_admin'::text)))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text))))));



  create policy "Public can view players"
  on "public"."players"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Public select players"
  on "public"."players"
  as permissive
  for select
  to public
using (true);



  create policy "Users can view players"
  on "public"."players"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.club_id = players.club_id) AND (user_roles.user_id = auth.uid())))));



  create policy "Allow individual insert for authenticated users"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((auth.uid() = id));



  create policy "Manager write access"
  on "public"."public_team_profiles"
  as permissive
  for all
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Public can read team profiles"
  on "public"."public_team_profiles"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Public read access"
  on "public"."public_team_profiles"
  as permissive
  for select
  to public
using (true);



  create policy "Club admins can manage seasons"
  on "public"."seasons"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.club_id = seasons.club_id) AND (user_roles.role = 'club_admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.club_id = seasons.club_id) AND (user_roles.role = 'club_admin'::text)))));



  create policy "Allow public inserts for analytics"
  on "public"."sponsor_analytics"
  as permissive
  for insert
  to public
with check (true);



  create policy "Manager read access"
  on "public"."sponsor_analytics"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Enable select for anyone"
  on "public"."teams"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Enable update for anyone during onboarding"
  on "public"."teams"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Managers can update their teams"
  on "public"."teams"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (((user_roles.club_id = teams.club_id) AND (user_roles.role = 'club_admin'::text)) OR ((user_roles.team_id = teams.id) AND (user_roles.role = 'team_admin'::text)))))));



  create policy "Public can view teams"
  on "public"."teams"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Public select teams"
  on "public"."teams"
  as permissive
  for select
  to public
using (true);



  create policy "Users can create their own teams"
  on "public"."teams"
  as permissive
  for insert
  to public
with check ((auth.uid() = owner_id));



  create policy "Users can insert own teams"
  on "public"."teams"
  as permissive
  for insert
  to public
with check ((auth.uid() = owner_id));



  create policy "Users can only see teams in their club"
  on "public"."teams"
  as permissive
  for select
  to public
using ((club_id IN ( SELECT user_roles.club_id
   FROM public.user_roles
  WHERE (user_roles.user_id = auth.uid()))));



  create policy "Users can update own teams"
  on "public"."teams"
  as permissive
  for update
  to public
using ((auth.uid() = owner_id));



  create policy "Users can view own teams"
  on "public"."teams"
  as permissive
  for select
  to public
using ((auth.uid() = owner_id));



  create policy "Users can view their own teams"
  on "public"."teams"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.club_id = teams.club_id) AND (user_roles.user_id = auth.uid())))));



  create policy "Team Admins can insert transactions for their team"
  on "public"."transactions"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() IN ( SELECT user_roles.user_id
   FROM public.user_roles
  WHERE ((user_roles.team_id = transactions.team_id) AND (user_roles.role = ANY (ARRAY['team_admin'::text, 'club_admin'::text]))))));



  create policy "Team Admins can view their team transactions"
  on "public"."transactions"
  as permissive
  for select
  to authenticated
using ((auth.uid() IN ( SELECT user_roles.user_id
   FROM public.user_roles
  WHERE ((user_roles.team_id = transactions.team_id) AND (user_roles.role = ANY (ARRAY['team_admin'::text, 'club_admin'::text]))))));



  create policy "Admins can delete user roles"
  on "public"."user_roles"
  as permissive
  for delete
  to public
using (((auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.role = 'super_admin'::text))) OR (auth.uid() IN ( SELECT user_roles_1.user_id
   FROM public.user_roles user_roles_1
  WHERE ((user_roles_1.club_id = user_roles_1.club_id) AND (user_roles_1.role = 'club_admin'::text))))));



  create policy "Admins can update user roles"
  on "public"."user_roles"
  as permissive
  for update
  to public
using (((auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.role = 'super_admin'::text))) OR (auth.uid() IN ( SELECT user_roles_1.user_id
   FROM public.user_roles user_roles_1
  WHERE ((user_roles_1.club_id = user_roles_1.club_id) AND (user_roles_1.role = 'club_admin'::text))))));



  create policy "Users can insert their own role"
  on "public"."user_roles"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Users can view own roles"
  on "public"."user_roles"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "Users can update own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));



