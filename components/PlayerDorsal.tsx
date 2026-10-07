type RosterTeam = {
  name: string;
  players?: Array<{ name: string; dorsal?: number | string | null }>;
};

export function findPlayerDorsal(teams: readonly RosterTeam[], teamName: string, playerName: string) {
  const normalizedTeamName = teamName.trim().toLowerCase();
  const normalizedPlayerName = playerName.trim().toLowerCase();
  const team = teams.find((entry) => entry.name.trim().toLowerCase() === normalizedTeamName);
  return team?.players?.find((player) => player.name.trim().toLowerCase() === normalizedPlayerName)?.dorsal;
}

export function PlayerDorsal({ dorsal }: { dorsal?: number | string | null }) {
  if (dorsal === undefined || dorsal === null || String(dorsal).trim() === "") {
    return null;
  }

  return <span className="player-dorsal-badge" aria-label={`Dorsal ${dorsal}`}>#{dorsal}</span>;
}