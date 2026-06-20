CREATE POLICY "Users can update their own clubs" ON "public"."clubs" AS permissive FOR UPDATE TO public USING ((auth.uid() = owner_id));
CREATE POLICY "Users can insert their own roles" ON "public"."user_roles" AS permissive FOR INSERT TO public WITH CHECK ((auth.uid() = user_id) AND role IN ('club_admin', 'team_admin', 'player'));
