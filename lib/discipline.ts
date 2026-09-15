import type { CalendarRound, DisciplinaryRecord } from "@/lib/league-data";

export type DisciplineStatus = DisciplinaryRecord & {
  suspensionRemaining: number;
  suspensionRoundTitles: string[];
  suspensionRounds: Array<{ id: number; title: string; status: CalendarRound["status"] }>;
  yellowCards: number;
  isYellowAccumulationSuspension: boolean;
};

type YellowState = {
  count: number;
  rounds: Set<number>;
  suspensionRoundId: number | null;
  suspensionRecordId: number | string | null;
};

function roundIdForRecord(record: DisciplinaryRecord, rounds: CalendarRound[]): number | null {
  const round = rounds.find((candidate) => candidate.title === record.jornada);
  return round?.id ?? null;
}

function roundsPlayedByTeamAfter(
  rounds: CalendarRound[],
  team: string,
  startRoundId: number,
  matchesToCount: number,
): CalendarRound[] {
  if (matchesToCount <= 0) {
    return [];
  }

  return [...rounds]
    .filter((round) => round.id > startRoundId)
    .filter((round) => round.matches.some((match) => match.home === team || match.away === team))
    .sort((a, b) => a.id - b.id)
    .slice(0, matchesToCount);
}

export function getSuspensionRoundTitles(
  record: DisciplinaryRecord,
  rounds: CalendarRound[],
): string[] {
  const sanctionRoundId = roundIdForRecord(record, rounds);
  const matches = Math.max(0, Number(record.suspensionMatches ?? 0));
  if (sanctionRoundId === null || matches === 0) {
    return [];
  }

  return roundsPlayedByTeamAfter(rounds, record.team, sanctionRoundId, matches).map((round) => round.title);
}

export function recalculateSuspensionRemaining(records: DisciplinaryRecord[], rounds: CalendarRound[]): DisciplinaryRecord[] {
  const latestCompletedRoundId = rounds
    .filter((round) => round.status === "completed")
    .reduce((latest, round) => Math.max(latest, round.id), 0);
  const currentRoundId = latestCompletedRoundId + 1;

  return records.map((record) => {
    const explicitMatches = Math.max(0, Number(record.suspensionMatches ?? 0));
    const sanctionRoundId = roundIdForRecord(record, rounds);
    if (explicitMatches === 0 || sanctionRoundId === null) {
      return { ...record, suspensionRemaining: 0 };
    }

    const roundsSinceSanction = currentRoundId - sanctionRoundId;
    const suspensionRemaining = roundsSinceSanction >= 1 && roundsSinceSanction <= explicitMatches
      ? explicitMatches - roundsSinceSanction + 1
      : 0;

    return { ...record, suspensionRemaining };
  });
}

function orderedRecords(records: DisciplinaryRecord[], rounds: CalendarRound[]) {
  return records
    .map((record, index) => ({ record, index, roundId: roundIdForRecord(record, rounds) }))
    .sort((a, b) => (a.roundId ?? Number.MAX_SAFE_INTEGER) - (b.roundId ?? Number.MAX_SAFE_INTEGER) || Number(a.record.id) - Number(b.record.id) || a.index - b.index);
}

function yellowStatesByPlayer(
  records: DisciplinaryRecord[],
  rounds: CalendarRound[],
  resetBeforeRoundId?: number,
): Map<string, YellowState> {
  const states = new Map<string, YellowState>();

  for (const entry of orderedRecords(records, rounds)) {
    if (entry.record.card !== "Amarilla" || entry.roundId === null || (resetBeforeRoundId !== undefined && entry.roundId < resetBeforeRoundId)) {
      continue;
    }

    const key = `${entry.record.team.toLowerCase()}::${entry.record.player.toLowerCase()}`;
    const state = states.get(key) ?? { count: 0, rounds: new Set<number>(), suspensionRoundId: null, suspensionRecordId: null };

    if (state.suspensionRoundId !== null && entry.roundId > state.suspensionRoundId) {
      state.count = 0;
      state.rounds.clear();
      state.suspensionRoundId = null;
      state.suspensionRecordId = null;
    }

    if (!state.rounds.has(entry.roundId)) {
      state.rounds.add(entry.roundId);
      state.count += 1;
    }

    if (state.count >= 3) {
      state.suspensionRoundId = entry.roundId + 1;
      state.suspensionRecordId = entry.record.id;
    }

    states.set(key, state);
  }

  return states;
}

export function getYellowCardsForPlayer(
  records: DisciplinaryRecord[],
  rounds: CalendarRound[],
  team: string,
  player: string,
  resetBeforeRoundId?: number,
): number {
  return yellowStatesByPlayer(records, rounds, resetBeforeRoundId).get(`${team.toLowerCase()}::${player.toLowerCase()}`)?.count ?? 0;
}

export function getDisciplineStatus(
  records: DisciplinaryRecord[],
  rounds: CalendarRound[],
  currentRoundId: number,
  resetBeforeRoundId?: number,
): DisciplineStatus[] {
  const yellowStates = yellowStatesByPlayer(records, rounds, resetBeforeRoundId);

  return records.flatMap((record) => {
    const playerKey = `${record.team.toLowerCase()}::${record.player.toLowerCase()}`;
    const yellowState = yellowStates.get(playerKey);
    const automaticRemaining = yellowState?.suspensionRoundId === currentRoundId && yellowState.suspensionRecordId === record.id ? 1 : 0;
    const explicitSuspensionRounds = getSuspensionRoundTitles(record, rounds);
    const automaticSuspensionRounds = yellowState?.suspensionRoundId !== null && yellowState?.suspensionRoundId !== undefined && yellowState.count >= 3
      ? roundsPlayedByTeamAfter(rounds, record.team, yellowState.suspensionRoundId - 1, 1).map((round) => round.title)
      : [];
    const suspensionRoundTitles = Array.from(new Set([...explicitSuspensionRounds, ...automaticSuspensionRounds]));
    const suspensionRounds = rounds
      .filter((round) => suspensionRoundTitles.includes(round.title))
      .sort((a, b) => a.id - b.id)
      .map((round) => ({ id: round.id, title: round.title, status: round.status }));
    const suspensionRemaining = suspensionRounds.filter((round) => round.status !== "completed").length;
    const yellowCards = yellowState && yellowState.suspensionRoundId !== null && currentRoundId > yellowState.suspensionRoundId
      ? 0
      : yellowState?.count ?? 0;

    return suspensionRemaining > 0 || record.card === "Amarilla"
      ? [{
          ...record,
          suspensionRemaining,
          suspensionRoundTitles,
          suspensionRounds,
          yellowCards,
          isYellowAccumulationSuspension: automaticRemaining > 0 || (yellowCards >= 3 && suspensionRoundTitles.length > 0),
        }]
      : [];
  });
}

export function getNextTeamRound(
  rounds: CalendarRound[],
  currentRoundId: number,
  team: string,
): CalendarRound | undefined {
  return [...rounds]
    .filter((round) => round.id > currentRoundId && round.status !== "completed")
    .filter((round) => round.matches.some((match) => match.home === team || match.away === team))
    .sort((a, b) => a.id - b.id)[0];
}

export function dedupeActiveDisciplineStatus(records: DisciplineStatus[]): DisciplineStatus[] {
  const activeByPlayer = new Map<string, DisciplineStatus>();

  for (const record of records) {
    if (record.suspensionRemaining <= 0) {
      continue;
    }

    const key = `${record.team.toLowerCase()}::${record.player.toLowerCase()}`;
    const current = activeByPlayer.get(key);
    if (!current || record.suspensionRemaining > current.suspensionRemaining) {
      activeByPlayer.set(key, record);
    }
  }

  return Array.from(activeByPlayer.values());
}