type GoalScorerMatch = {
  goalScorers?: Array<{ player: string; team: string }>;
};

const normalizeValue = (value: string) => value.trim().toLocaleLowerCase();

export function getPlayerGoalSummary(
  matches: GoalScorerMatch[],
  teamName: string,
  playerName: string
) {
  const goalsByPlayer = new Map<string, number>();
  const teamKey = normalizeValue(teamName);

  matches.forEach((match) => {
    (match.goalScorers ?? []).forEach((scorer) => {
      if (normalizeValue(scorer.team) !== teamKey) {
        return;
      }

      const playerKey = normalizeValue(scorer.player);
      goalsByPlayer.set(playerKey, (goalsByPlayer.get(playerKey) ?? 0) + 1);
    });
  });

  const playerGoals = goalsByPlayer.get(normalizeValue(playerName)) ?? 0;
  if (playerGoals === 0) {
    return { goals: 0, rank: null };
  }

  const goalRanks = [...new Set([...goalsByPlayer.values()].sort((a, b) => b - a))];
  return { goals: playerGoals, rank: goalRanks.indexOf(playerGoals) + 1 };
}