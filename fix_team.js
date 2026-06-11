const fs = require('fs');
let lines = fs.readFileSync('components/Team.tsx', 'utf8').split('\n');

// Find the first line that looks like real code remaining and remove any blank lines before it
while (lines.length > 0 && lines[0].trim() === '') {
  lines.shift();
}

const top = `"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { useActiveClub } from "@/contexts/ClubContext";

export default function Team() {
  const { profile, roles } = useProfile();
  const { activeClubId, clubInfo } = useActiveClub();

  const [isLoading, setIsLoading] = useState(true);
  const [activeSeasonName, setActiveSeasonName] = useState<string | null | undefined>(undefined);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [clubPlayers, setClubPlayers] = useState<any[]>([]);
  
  // Aggregated Data
  const [playerStats, setPlayerStats] = useState<Record<string, { id: string, name: string, full_name: string, is_member: boolean, balance: number, gamesPlayed: number }>>({});
  const [fixtureAvail, setFixtureAvail] = useState<any[]>([]);
  const [rosterSummary, setRosterSummary] = useState({ members: 0, casuals: 0, totalGames: 0 });

  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
`;

fs.writeFileSync('components/Team.tsx', top + lines.join('\n'));
console.log('Fixed Team.tsx top');
