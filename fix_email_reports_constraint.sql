ALTER TABLE "public"."email_reports" DROP CONSTRAINT IF EXISTS "email_reports_frequency_check";
ALTER TABLE "public"."email_reports" ADD CONSTRAINT "email_reports_frequency_check" 
CHECK ((frequency = ANY (ARRAY['weekly'::text, 'fortnightly'::text, 'instant_event'::text])));

ALTER TABLE "public"."email_reports" DROP CONSTRAINT IF EXISTS "email_reports_report_type_check";
ALTER TABLE "public"."email_reports" ADD CONSTRAINT "email_reports_report_type_check" 
CHECK ((report_type = ANY (ARRAY['club_summary'::text, 'team_summary'::text, 'availability_report'::text])));
