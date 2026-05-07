// app/t/[slugid]/page.tsx
import { Metadata } from 'next';
import { supabase } from "@/lib/supabase";
import TeamAvailabilityClient from "./TeamAvailabilityClient";

export const dynamic = 'force-dynamic';

// --- DYNAMIC METADATA FOR LINK PREVIEWS ---
export async function generateMetadata(props: { params: Promise<any> }): Promise<Metadata> {
  const resolvedParams = await props.params;
  const identifier = resolvedParams?.slugid;

  if (!identifier) {
    return { title: 'Invalid Link | Fees Please' };
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  
  // Query to grab the team name and club logo for the preview card
  const { data: team } = await supabase
    .from('teams')
    .select(`
      name,
      public_team_profiles (
        club_logo_url
      )
    `)
    .or(`slug.eq.${identifier},id.eq.${isUuid ? identifier : '00000000-0000-0000-0000-000000000000'}`)
    .maybeSingle();

  const teamName = team?.name || "Team";
  
  // Safely extract the logo depending on how Supabase returns the joined data
  const profile = Array.isArray(team?.public_team_profiles) 
    ? team?.public_team_profiles[0] 
    : team?.public_team_profiles;
  const logoUrl = profile?.club_logo_url || "https://feesplease.app/og-default.png";

  return {
    title: `${teamName} | Fees Please`,
    description: `Availability and match fees for ${teamName}. Less chasing, more playing.`,
    openGraph: {
      title: `${teamName} Availability`,
      description: `Join ${teamName} on Fees Please to manage your match day availability.`,
      images: [
        {
          url: logoUrl,
          width: 800,
          height: 600,
          alt: `${teamName} Logo`,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${teamName} | Fees Please`,
      description: `Manage match day for ${teamName}.`,
      images: [logoUrl],
    },
  }
}

// --- MAIN PAGE COMPONENT ---
export default async function PublicTeamAvailabilityPage(props: { params: Promise<any> }) {
  // 🔥 FIX: Await the promise and look for the exact folder name: slugid
  const resolvedParams = await props.params;
  const identifier = resolvedParams?.slugid;

  if (!identifier) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
        <h1 className="text-zinc-900 dark:text-white font-black uppercase text-xl">Invalid Link</h1>
        <p className="text-zinc-500 text-sm mt-2 text-center max-w-xs">Could not read URL parameter.</p>
      </div>
    );
  }

  // 1. REGEX CHECK: UUID vs Slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  
  // 2. Query the DB
  const query = supabase.from('teams').select('id, club_id, name');
  const { data: teamData, error: teamError } = await (isUuid 
    ? query.eq('id', identifier).maybeSingle() 
    : query.eq('slug', identifier).maybeSingle());

  if (teamError || !teamData) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
        <h1 className="text-zinc-900 dark:text-white font-black uppercase text-xl">Team Not Found</h1>
        <p className="text-zinc-500 text-sm mt-2 text-center max-w-xs">Could not find team in the database.</p>
      </div>
    );
  }

  // 3. Pass data to client
  return <TeamAvailabilityClient teamId={teamData.id} clubId={teamData.club_id} teamName={teamData.name} />;
}