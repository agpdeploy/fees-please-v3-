import { Metadata } from 'next';
import { supabase } from "@/lib/supabase";
import UnsubscribeClient from "./UnsubscribeClient";

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { params: Promise<any> }): Promise<Metadata> {
  const resolvedParams = await props.params;
  const identifier = resolvedParams?.slugid;

  if (!identifier) {
    return { title: 'Unsubscribe | Fees Please' };
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  
  const { data: team } = await supabase
    .from('teams')
    .select('name')
    .or(`slug.eq.${identifier},id.eq.${isUuid ? identifier : '00000000-0000-0000-0000-000000000000'}`)
    .maybeSingle();

  const teamName = team?.name || "Team";

  return {
    title: `Unsubscribe | ${teamName} | Fees Please`,
    description: `Unsubscribe from match day reminders for ${teamName}.`,
  };
}

export default async function UnsubscribePage(props: { params: Promise<any> }) {
  const resolvedParams = await props.params;
  const identifier = resolvedParams?.slugid;

  if (!identifier) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
        <h1 className="text-zinc-900 dark:text-white font-black uppercase text-xl">Invalid Link</h1>
      </div>
    );
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  
  const query = supabase.from('teams').select('id, name');
  const { data: teamData, error: teamError } = await (isUuid 
    ? query.eq('id', identifier).maybeSingle() 
    : query.eq('slug', identifier).maybeSingle());

  if (teamError || !teamData) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
        <h1 className="text-zinc-900 dark:text-white font-black uppercase text-xl">Team Not Found</h1>
      </div>
    );
  }

  return <UnsubscribeClient teamId={teamData.id} teamName={teamData.name} />;
}
