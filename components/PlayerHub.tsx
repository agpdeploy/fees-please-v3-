"use client";

import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";
import TeamAvailabilityClient from "../app/t/[slugid]/TeamAvailabilityClient";

export default function PlayerHub() {
  const { profile, roles } = useProfile();
  const { activeClubId } = useActiveClub();

  const activeRole = roles?.find((r: any) => r.club_id === activeClubId && r.role === 'player');
  const teamId = activeRole?.team_id || profile?.team_id;
  const clubId = activeRole?.club_id || profile?.club_id;
  const clubName = activeRole?.clubs?.name || "Team";
  const playerId = activeRole?.player_id || roles?.find((r: any) => r.club_id === clubId && r.role === 'player')?.player_id;

  if (!teamId || !clubId) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No team found.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <TeamAvailabilityClient 
        teamId={teamId} 
        clubId={clubId} 
        teamName={clubName} 
        initialPlayerId={playerId} 
        isEmbedded={true}
      />
    </div>
  );
}
