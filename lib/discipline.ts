import type { CalendarRound, DisciplinaryRecord } from "@/lib/league-data";

export type DisciplineStatus = DisciplinaryRecord & {
  suspensionRemaining: number;
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
      state.count = 0;
      state.rounds.clear();
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
    const sanctionRoundId = roundIdForRecord(record, rounds);
    const explicitMatches = Number(record.suspensionMatches ?? 0);
    const roundsSinceSanction = sanctionRoundId === null ? 0 : currentRoundId - sanctionRoundId;
    const explicitRemaining = sanctionRoundId !== null && explicitMatches > 0 && roundsSinceSanction >= 1 && roundsSinceSanction <= explicitMatches
      ? explicitMatches - roundsSinceSanction + 1
      : 0;
    const playerKey = `${record.team.toLowerCase()}::${record.player.toLowerCase()}`;
    const yellowState = yellowStates.get(playerKey);
    const automaticRemaining = yellowState?.suspensionRoundId === currentRoundId && yellowState.suspensionRecordId === record.id ? 1 : 0;
    const suspensionRemaining = Math.max(explicitRemaining, automaticRemaining);
    const yellowCards = yellowState?.count ?? 0;

    return suspensionRemaining > 0 || record.card === "Amarilla"
      ? [{ ...record, suspensionRemaining, yellowCards, isYellowAccumulationSuspension: automaticRemaining > 0 }]
      : [];
  });
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