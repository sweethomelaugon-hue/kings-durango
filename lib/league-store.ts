import { promises as fs } from "fs";
import path from "path";

import {
  teams as seedTeams,
  matches as seedMatches,
  calendar as seedCalendar,
  sanctions as seedSanctions,
  type Team,
  type Match,
  type CalendarRound,
  type DisciplinaryRecord,
} from "@/lib/league-data";
import { getSupabaseClient, getSupabaseWriteClient, hasSupabaseConfig, hasSupabaseWriteConfig } from "@/lib/supabase";

export type FinancialMovement = {
  id: number;
  concept: string;
  amount: number;
  type: "gasto" | "cobro";
  kind?: "cuota" | "patrocinio" | "premio" | "otro";
  category?: string;
  entity?: string;
  paid?: number;
  pending?: number;
  date?: string;
  status?: "planificado" | "pendiente" | "pagado";
  previousPaid?: number;
  settlementOnly?: boolean;
};

export type SeasonRecord = {
  id: string;
  name: string;
  yearStart: number;
  yearEnd: number;
  isActive: boolean;
};

export type RoundRecord = {
  id: string;
  seasonId: string;
  title: string;
  roundNumber: number;
  date: string;
  status: "completed" | "in-progress" | "upcoming";
};

export type PlayerRecord = {
  id?: string;
  teamId?: string;
  seasonId?: string;
  name: string;
  dorsal: number | string;
  isGoalkeeper?: boolean;
};

export type TeamRecord = Team & {
  short_name?: string;
  primaryColor?: string;
  shieldImage?: string;
  stadiumName?: string;
  stadium_name?: string;
  seasonId?: string;
  players: PlayerRecord[];
};

export type MatchRecord = Match & {
  id: number | string;
  seasonId?: string;
  roundId?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  scheduledAt?: string;
  stadiumName?: string;
  status?: "scheduled" | "finished" | "in-progress" | "cancelled";
  goalScorers?: Array<{ player: string; team: string; minute?: number }>;
};

export type LeagueStore = {
  seasons: SeasonRecord[];
  teams: TeamRecord[];
  rounds: RoundRecord[];
  matches: MatchRecord[];
  calendar: CalendarRound[];
  sanctions: DisciplinaryRecord[];
  finances: {
    fees: Record<string, number>;
    payments: Record<string, number>;
    expenses: FinancialMovement[];
    costs: {
      yellow: number;
      doubleYellow: number;
      red: number;
      other: number;
    };
    points?: {
      yellow: number;
      doubleYellow: number;
      red: number;
      other: number;
    };
    yellowCardResetRoundId?: number;
  };
};

const defaultSeason: SeasonRecord = {
  id: "season-2026",
  name: "Temporada 2026",
  yearStart: 2026,
  yearEnd: 2027,
  isActive: true,
};

const defaultStore: LeagueStore = {
  seasons: [defaultSeason],
  teams: seedTeams.map((team) => ({
    ...team,
    seasonId: defaultSeason.id,
    players: team.players.map((player) => ({
      ...player,
      teamId: team.id,
      seasonId: defaultSeason.id,
    })),
  })),
  rounds: seedCalendar.map((round, index) => ({
    id: `round-${index + 1}`,
    seasonId: defaultSeason.id,
    title: round.title,
    roundNumber: index + 1,
    date: round.date,
    status: round.status,
  })),
  matches: seedMatches.map((match, index) => ({
    ...match,
    id: match.id ?? index + 1,
    seasonId: defaultSeason.id,
    roundId: `round-${Number(match.jornada.replace(/\D+/g, "")) || index + 1}`,
    homeTeamId: seedTeams.find((team) => team.name === match.home)?.id ?? match.home,
    awayTeamId: seedTeams.find((team) => team.name === match.away)?.id ?? match.away,
    scheduledAt: `${match.date}T${match.time}:00`,
    stadiumName: match.stadium,
    status: match.score === "-" ? "scheduled" : "finished",
  })),
  calendar: seedCalendar,
  sanctions: seedSanctions,
  finances: {
    fees: Object.fromEntries(seedTeams.map((team) => [team.name, 250])),
    payments: Object.fromEntries(seedTeams.map((team) => [team.name, 120])),
    expenses: [
      { id: 1, concept: "Balones", amount: 160, type: "gasto", category: "Gasto", entity: "Material", paid: 160, pending: 0, date: "2026-09-01", status: "pagado" },
      { id: 2, concept: "Fichas de arbitraje", amount: 180, type: "gasto", category: "Gasto", entity: "Arbitraje", paid: 180, pending: 0, date: "2026-09-01", status: "pagado" },
      { id: 3, concept: "Inscripción inicial", amount: 700, type: "cobro", category: "Inscripción", entity: "Aston Birras", paid: 150, pending: 550, date: "2026-09-01", status: "pendiente" },
    ],
    costs: {
      yellow: 30,
      doubleYellow: 60,
      red: 80,
      other: 120,
    },
    points: {
      yellow: 2,
      doubleYellow: 4,
      red: 5,
      other: 0,
    },
      yellowCardResetRoundId: undefined,
  },
};

function normalizeSupabaseStatus(value: unknown, fallback: string): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) {
    return fallback;
  }

  if (candidate === "in_progress" || candidate === "in-progress") {
    return "in-progress";
  }

  if (candidate === "completed") {
    return "completed";
  }

  if (candidate === "upcoming") {
    return "upcoming";
  }

  return fallback;
}

function normalizeSupabaseMoney(value: unknown, fallback = 0): number {
  const numericValue = Number(value ?? fallback);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

type GoalScorerEntry = {
  player: string;
  team: string;
  minute?: number;
};

export function buildSupabaseSyncRows(store: LeagueStore) {
  const seasonId = store.seasons[0]?.id ?? "season-2026";
  const seasonRow = {
    id: seasonId,
    name: store.seasons[0]?.name ?? "Temporada 2026",
    year_start: Number(store.seasons[0]?.yearStart ?? 2026),
    year_end: Number(store.seasons[0]?.yearEnd ?? 2027),
    is_active: Boolean(store.seasons[0]?.isActive ?? true),
  };

  const toIdString = (value: unknown): string => {
    if (typeof value === "string") {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
    return "";
  };

  const teamIds = new Map<string, string>();
  const teamRows = store.teams.map((team) => {
    const resolvedId = toIdString(team.id).length > 0 ? team.id : crypto.randomUUID();
    teamIds.set(team.name.trim().toLowerCase(), String(resolvedId));
    return {
      id: String(resolvedId),
      season_id: team.seasonId ?? seasonId,
      name: team.name,
      short_name: team.shortName ?? team.short_name ?? team.name.slice(0, 3).toUpperCase(),
      stadium_name: team.stadiumName ?? team.stadium_name ?? "Tabira",
    };
  });

  const playerRows = store.teams.flatMap((team) =>
    (team.players ?? []).map((player) => {
      const playerId = toIdString(player.id).length > 0 ? String(player.id) : crypto.randomUUID();
      return {
        id: playerId,
        season_id: player.seasonId ?? team.seasonId ?? seasonId,
        team_id: teamIds.get(team.name.trim().toLowerCase()) ?? (typeof team.id === "string" ? team.id : crypto.randomUUID()),
        name: player.name,
        dorsal: Number(player.dorsal ?? 0),
        is_goalkeeper: Boolean(player.isGoalkeeper),
      };
    })
  );

  const roundSource: Array<Record<string, unknown>> =
    Array.isArray(store.rounds) && store.rounds.length > 0 ? (store.rounds as Array<Record<string, unknown>>) : (store.calendar as Array<Record<string, unknown>>);

  const roundRows = roundSource.map((round, index) => ({
    id: toIdString(round.id).length > 0 ? String(round.id) : crypto.randomUUID(),
    season_id: typeof round.seasonId === "string" ? round.seasonId : seasonId,
    title: typeof round.title === "string" ? round.title : `Jornada ${index + 1}`,
    round_number: Number(typeof round.roundNumber === "number" ? round.roundNumber : index + 1),
    date: typeof round.date === "string" ? round.date : "2026-09-10",
    status: typeof round.status === "string" ? round.status : "upcoming",
  }));

  const roundIdByTitle = new Map<string, string>();
  for (const round of roundRows) {
    roundIdByTitle.set(String(round.title).trim().toLowerCase(), String(round.id));
  }

  const matchRows = store.matches.map((match, index) => {
    const score = typeof match.score === "string" ? match.score : "-";
    const [homeGoals, awayGoals] = score === "-" ? [0, 0] : score.split(/[-:]/).map((value) => Number.parseInt(value.trim(), 10) || 0);
    const homeTeamId = teamIds.get(String(match.home ?? "").trim().toLowerCase()) ?? teamIds.get(String(store.teams[index]?.name ?? "").trim().toLowerCase()) ?? crypto.randomUUID();
    const awayTeamId = teamIds.get(String(match.away ?? "").trim().toLowerCase()) ?? crypto.randomUUID();
    const roundId = roundIdByTitle.get(String(match.jornada ?? match.home ?? "").trim().toLowerCase())
      ?? roundIdByTitle.get(String(store.calendar.find((calendarRound) => calendarRound.matches.some((entry) => entry.home === match.home && entry.away === match.away))?.title ?? "").trim().toLowerCase())
      ?? String(roundRows[0]?.id ?? crypto.randomUUID());

    return {
      id: toIdString(match.id).length > 0 ? String(match.id) : crypto.randomUUID(),
      season_id: match.seasonId ?? store.seasons[0]?.id ?? seasonId,
      round_id: roundId,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      scheduled_at: match.scheduledAt ?? `${match.date ?? "2026-09-10"}T${match.time ?? "19:00"}:00`,
      stadium_name: match.stadium ?? match.stadiumName ?? "Tabira",
      home_goals: Number(homeGoals ?? 0),
      away_goals: Number(awayGoals ?? 0),
      status: match.status ?? ((match.score && match.score !== "-") ? "finished" : "scheduled"),
    };
  });

  const eventRows = store.matches.flatMap((match) =>
    (match.goalScorers ?? []).map((scorer) => {
      const teamId = teamIds.get(String(scorer.team ?? "").trim().toLowerCase());
      const playerId = store.teams
        .find((team) => team.name.trim().toLowerCase() === String(scorer.team ?? "").trim().toLowerCase())
        ?.players.find((player) => player.name.trim().toLowerCase() === String(scorer.player ?? "").trim().toLowerCase())?.id
        ?? crypto.randomUUID();

      return {
        id: crypto.randomUUID(),
        match_id: toIdString(match.id).length > 0 ? String(match.id) : crypto.randomUUID(),
        player_id: playerId,
        team_id: teamId ?? crypto.randomUUID(),
        event_type: "goal",
        minute: Number(scorer.minute ?? 0),
        notes: `Sincronizado desde admin (${match.home} vs ${match.away})`,
      };
    })
  );

  const sanctionRows = store.sanctions.map((sanction) => {
    const team = store.teams.find((candidate) => candidate.name.trim().toLowerCase() === String(sanction.team ?? "").trim().toLowerCase());
    const player = team?.players.find((candidate) => candidate.name.trim().toLowerCase() === String(sanction.player ?? "").trim().toLowerCase());

    return {
      id: toIdString(sanction.id).length > 0 ? String(sanction.id) : crypto.randomUUID(),
      player_id: player?.id ?? crypto.randomUUID(),
      team_id: team ? (teamIds.get(team.name.trim().toLowerCase()) ?? crypto.randomUUID()) : crypto.randomUUID(),
      match_id: null,
      card_type: sanction.card ?? "Amarilla",
      reason: sanction.reason ?? "Registrada desde admin",
      cost_amount: Number(sanction.costAmount ?? sanction.cost_amount ?? 0),
    };
  });

  const feeRows = Object.entries(store.finances?.fees ?? {}).map(([teamName, amount]) => {
    const teamId = teamIds.get(teamName.trim().toLowerCase());
    return {
      id: crypto.randomUUID(),
      team_id: teamId ?? crypto.randomUUID(),
      season_id: seasonId,
      fee_amount: Number(amount ?? 0),
      paid_amount: Number(store.finances?.payments?.[teamName] ?? 0),
      status: Number(store.finances?.payments?.[teamName] ?? 0) >= Number(amount ?? 0) ? "paid" : "pending",
    };
  });

  const financialMovementRows = (store.finances?.expenses ?? []).map((entry) => {
    const teamName = typeof entry.entity === "string" ? entry.entity.trim() : "";
    const teamId = teamName ? teamIds.get(teamName.trim().toLowerCase()) ?? null : null;

    return {
      id: toIdString(entry.id).length > 0 ? String(entry.id) : crypto.randomUUID(),
      season_id: seasonId,
      team_id: teamId,
      concept: entry.concept ?? "Movimiento financiero",
      movement_type: entry.type === "cobro" ? "income" : "expense",
      amount: Number(entry.amount ?? 0),
      notes: entry.category ? `${entry.category}` : undefined,
    };
  });

  return {
    seasons: [seasonRow],
    teams: teamRows,
    players: playerRows,
    rounds: roundRows,
    matches: matchRows,
    match_events: eventRows,
    disciplinary_records: sanctionRows,
    team_fees: feeRows,
    financial_movements: financialMovementRows,
  };
}

export function buildGoalScorersFromEvents(
  events: Array<Record<string, unknown>>
): GoalScorerEntry[] {
  const entries: GoalScorerEntry[] = [];

  for (const event of events) {
    const eventType = typeof event.event_type === "string" ? event.event_type : "";
    if (eventType !== "goal" && eventType !== "own_goal") {
      continue;
    }

    const playerName = typeof (event as { player?: { name?: string } }).player?.name === "string"
      ? (event as { player?: { name?: string } }).player?.name?.trim() ?? ""
      : "";
    const teamName = typeof (event as { team?: { name?: string } }).team?.name === "string"
      ? (event as { team?: { name?: string } }).team?.name?.trim() ?? ""
      : "";

    if (!playerName || !teamName) {
      continue;
    }

    const minute = Number(event.minute);
    const scorer: GoalScorerEntry = {
      player: repairMojibake(playerName),
      team: repairMojibake(teamName),
      ...(Number.isFinite(minute) ? { minute } : {}),
    };
    entries.push(scorer);
  }

  return entries;
}

async function readSupabaseLeagueStore(): Promise<LeagueStore | null> {
  if (!hasSupabaseConfig) {
    return null;
  }

  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const [{ data: seasonsData, error: seasonsError }, { data: teamsData, error: teamsError }, { data: roundsData, error: roundsError }, { data: matchesData, error: matchesError }, { data: feesData, error: feesError }, { data: movementsData, error: movementsError }, { data: sanctionsData, error: sanctionsError }, { data: eventsData, error: eventsError }] = await Promise.all([
    client.from("seasons").select("id, name, year_start, year_end, is_active").order("year_start", { ascending: true }),
    client.from("teams").select("id, name, short_name, stadium_name, season_id, players:players(id, name, dorsal, is_goalkeeper)").order("name"),
    client.from("rounds").select("id, title, round_number, date, status, season_id").order("round_number", { ascending: true }),
    client.from("matches").select("id, season_id, round_id, home_team_id, away_team_id, scheduled_at, stadium_name, home_goals, away_goals, status, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)").order("scheduled_at", { ascending: true }),
    client.from("team_fees").select("team_id, fee_amount, paid_amount, status").order("team_id", { ascending: true }),
    client.from("financial_movements").select("id, concept, amount, movement_type, team_id, notes, created_at").order("created_at", { ascending: false }),
    client.from("disciplinary_records").select("id, player_id, team_id, card_type, reason, cost_amount, created_at").order("created_at", { ascending: false }),
    client.from("match_events").select("id, match_id, minute, event_type, player:players!match_events_player_id_fkey(name), team:teams!match_events_team_id_fkey(name)").order("minute", { ascending: true }),
  ]);

  if (seasonsError || teamsError || roundsError || matchesError || feesError || movementsError || sanctionsError || eventsError) {
    return null;
  }

  const seasons = Array.isArray(seasonsData)
    ? seasonsData.map((entry) => ({
        id: String(entry.id),
        name: String(entry.name ?? "Temporada sin nombre"),
        yearStart: Number(entry.year_start ?? 2026),
        yearEnd: Number(entry.year_end ?? 2027),
        isActive: Boolean(entry.is_active),
      }))
    : defaultStore.seasons;

  const teams = Array.isArray(teamsData)
    ? teamsData.map((team) => {
        const teamPlayers = Array.isArray((team as { players?: unknown[] }).players)
          ? (team as { players?: Array<{ id?: string | number; name?: string; dorsal?: number | string; is_goalkeeper?: boolean }> }).players ?? []
          : [];

        return {
          id: String(team.id),
          name: String(team.name ?? "Equipo sin nombre"),
          shortName: String(team.short_name ?? "NUE"),
          short_name: String(team.short_name ?? "NUE"),
          stadiumName: String(team.stadium_name ?? "Tabira"),
          stadium_name: String(team.stadium_name ?? "Tabira"),
          seasonId: typeof team.season_id === "string" ? team.season_id : seasons[0]?.id ?? defaultStore.seasons[0].id,
          players: teamPlayers.map((player) => ({
            id: typeof player.id === "string" || typeof player.id === "number" ? String(player.id) : undefined,
            name: String(player.name ?? "Jugador sin nombre"),
            dorsal: Number(player.dorsal ?? 0),
            isGoalkeeper: player.is_goalkeeper === true,
            teamId: String(team.id),
            seasonId: typeof team.season_id === "string" ? team.season_id : seasons[0]?.id ?? defaultStore.seasons[0].id,
          })),
        };
      })
    : defaultStore.teams;

  const rounds = Array.isArray(roundsData)
    ? roundsData.map((entry) => ({
        id: String(entry.id),
        seasonId: typeof entry.season_id === "string" ? entry.season_id : seasons[0]?.id ?? defaultStore.seasons[0].id,
        title: String(entry.title ?? "Jornada"),
        roundNumber: Number(entry.round_number ?? 1),
        date: typeof entry.date === "string" ? entry.date : "2026-09-10",
        status: normalizeSupabaseStatus(entry.status, "upcoming") as "completed" | "in-progress" | "upcoming",
      }))
    : defaultStore.rounds;

  const goalScorersByMatch = new Map<string, Array<{ player: string; team: string; minute?: number }>>();
  for (const event of Array.isArray(eventsData) ? eventsData : []) {
    const matchId = String((event as { match_id?: string | number }).match_id ?? "");
    if (!matchId) {
      continue;
    }

    const scorerEntries = buildGoalScorersFromEvents([event as Record<string, unknown>]);
    if (scorerEntries.length === 0) {
      continue;
    }

    const previous = goalScorersByMatch.get(matchId) ?? [];
    goalScorersByMatch.set(matchId, [...previous, ...scorerEntries]);
  }

  const matches = Array.isArray(matchesData)
    ? matchesData.map((match, index) => {
        const homeGoals = normalizeSupabaseMoney(match.home_goals, 0);
        const awayGoals = normalizeSupabaseMoney(match.away_goals, 0);
        const homeName = typeof (match as { home_team?: { name?: string } }).home_team?.name === "string"
          ? (match as { home_team?: { name?: string } }).home_team?.name ?? ""
          : "";
        const awayName = typeof (match as { away_team?: { name?: string } }).away_team?.name === "string"
          ? (match as { away_team?: { name?: string } }).away_team?.name ?? ""
          : "";
        const matchId = String(match.id ?? `${index + 1}`);

        return {
          id: typeof match.id === "string" || typeof match.id === "number" ? Number(match.id) || index + 1 : index + 1,
          jornada: rounds.find((round) => round.id === String(match.round_id))?.title ?? `Jornada ${Number(match.round_id) || index + 1}`,
          date: typeof (match as { scheduled_at?: string }).scheduled_at === "string"
            ? new Date((match as { scheduled_at?: string }).scheduled_at as string).toISOString().slice(0, 10)
            : "2026-09-10",
          time: typeof (match as { scheduled_at?: string }).scheduled_at === "string"
            ? new Date((match as { scheduled_at?: string }).scheduled_at as string).toISOString().slice(11, 16)
            : "19:00",
          home: homeName || `Equipo ${index + 1}`,
          away: awayName || `Equipo ${index + 2}`,
          score: homeGoals === 0 && awayGoals === 0 && String(match.status ?? "") === "scheduled" ? "-" : `${homeGoals} - ${awayGoals}`,
          stadium: typeof match.stadium_name === "string" ? match.stadium_name : "Tabira",
          events: { home: "", away: "" },
          goalScorers: goalScorersByMatch.get(matchId) ?? [],
          seasonId: typeof match.season_id === "string" ? match.season_id : seasons[0]?.id ?? defaultStore.seasons[0].id,
          roundId: typeof match.round_id === "string" ? match.round_id : undefined,
          homeTeamId: typeof match.home_team_id === "string" ? match.home_team_id : undefined,
          awayTeamId: typeof match.away_team_id === "string" ? match.away_team_id : undefined,
          scheduledAt: typeof (match as { scheduled_at?: string }).scheduled_at === "string" ? (match as { scheduled_at?: string }).scheduled_at : undefined,
          stadiumName: typeof match.stadium_name === "string" ? match.stadium_name : "Tabira",
          status: String(match.status ?? "scheduled") as "scheduled" | "finished" | "in-progress" | "cancelled",
        };
      })
    : defaultStore.matches;

  const fees = Array.isArray(feesData)
    ? Object.fromEntries(feesData
        .map((entry) => [String((entry as { team_id?: string }).team_id ?? ""), normalizeSupabaseMoney((entry as { fee_amount?: number }).fee_amount, 0)])
        .filter(([key]) => String(key).length > 0))
    : defaultStore.finances.fees;

  const payments = Array.isArray(feesData)
    ? Object.fromEntries(feesData
        .map((entry) => [String((entry as { team_id?: string }).team_id ?? ""), normalizeSupabaseMoney((entry as { paid_amount?: number }).paid_amount, 0)])
        .filter(([key]) => String(key).length > 0))
    : defaultStore.finances.payments;

  const sanctions = Array.isArray(sanctionsData)
    ? sanctionsData.map((entry, index) => {
        const cardValue = (String((entry as { card_type?: string }).card_type ?? "Amarilla") as DisciplinaryRecord["card"]);
        const numericId = Number(entry.id ?? index + 1);

        return {
          id: Number.isFinite(numericId) ? numericId : index + 1,
          player: teams.find((team) => team.id === String((entry as { player_id?: string }).player_id))?.players[0]?.name ?? "Jugador",
          team: teams.find((team) => team.id === String((entry as { team_id?: string }).team_id))?.name ?? "Equipo",
          card: cardValue,
          card_type: cardValue,
          matches: 1,
          remaining: 1,
          reason: String((entry as { reason?: string }).reason ?? "Registrada desde Supabase"),
          costAmount: normalizeSupabaseMoney((entry as { cost_amount?: number }).cost_amount, 0),
          cost_amount: normalizeSupabaseMoney((entry as { cost_amount?: number }).cost_amount, 0),
        } satisfies DisciplinaryRecord;
      })
    : defaultStore.sanctions;

  const expenses = Array.isArray(movementsData)
    ? movementsData.map((entry, index) => {
        const movementType = String(entry.movement_type ?? "expense") === "income" ? "cobro" : "gasto";
        const numericId = Number(entry.id ?? index + 1);

        return {
          id: Number.isFinite(numericId) ? numericId : index + 1,
          concept: String(entry.concept ?? "Movimiento"),
          amount: normalizeSupabaseMoney(entry.amount, 0),
          type: movementType as FinancialMovement["type"],
          kind: "otro" as const,
          category: "Supabase" as const,
          entity: typeof entry.team_id === "string" ? teams.find((team) => team.id === entry.team_id)?.name ?? "Equipo" : "Liga",
          paid: normalizeSupabaseMoney(entry.amount, 0),
          pending: 0,
          date: typeof entry.created_at === "string" ? entry.created_at.slice(0, 10) : undefined,
          status: "pagado" as const,
        } satisfies FinancialMovement;
      })
    : defaultStore.finances.expenses;

  const calendar = Array.isArray(roundsData)
    ? rounds
        .map((round) => {
          const roundMatches = (Array.isArray(matchesData) ? matchesData : [])
            .filter((match) => String((match as { round_id?: string }).round_id ?? "") === String(round.id))
            .map((match, index) => {
              const homeTeam = typeof (match as { home_team?: { name?: string } }).home_team?.name === "string"
                ? (match as { home_team?: { name?: string } }).home_team?.name ?? ""
                : "";
              const awayTeam = typeof (match as { away_team?: { name?: string } }).away_team?.name === "string"
                ? (match as { away_team?: { name?: string } }).away_team?.name ?? ""
                : "";
              const scheduledAt = typeof (match as { scheduled_at?: string }).scheduled_at === "string"
                ? new Date((match as { scheduled_at?: string }).scheduled_at as string)
                : null;
              const homeGoals = normalizeSupabaseMoney((match as { home_goals?: number }).home_goals, 0);
              const awayGoals = normalizeSupabaseMoney((match as { away_goals?: number }).away_goals, 0);

              return {
                time: scheduledAt ? scheduledAt.toISOString().slice(11, 16) : `19:${String((index % 2) + 1).padStart(2, "0")}`,
                home: homeTeam || `Equipo ${index + 1}`,
                away: awayTeam || `Equipo ${index + 2}`,
                stadium: typeof (match as { stadium_name?: string }).stadium_name === "string" ? (match as { stadium_name?: string }).stadium_name : "Tabira",
                result: homeGoals === 0 && awayGoals === 0 && String((match as { status?: string }).status ?? "") === "scheduled" ? "-" : `${homeGoals} - ${awayGoals}`,
              };
            })
            .sort((a, b) => a.time.localeCompare(b.time));

          return {
            id: Number(round.roundNumber) || 1,
            title: round.title,
            date: round.date,
            status: round.status,
            matches: roundMatches,
            descansan: [],
          };
        })
        .sort((a, b) => a.id - b.id)
    : defaultStore.calendar;

  return {
    seasons,
    teams,
    rounds,
    matches,
    calendar,
    sanctions,
    finances: {
      fees,
      payments,
      expenses,
      costs: defaultStore.finances.costs,
      points: defaultStore.finances.points,
      yellowCardResetRoundId: undefined,
    },
  };
}

export function getStorePath() {
  return process.env.LEAGUE_STORE_PATH ?? path.join(process.cwd(), "data", "league-store.json");
}

export function getBackupDirectory() {
  return path.join(path.dirname(getStorePath()), "backups");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

export function repairMojibake(value: string): string {
  let repaired = value;
  for (let attempt = 0; attempt < 3 && /Ã|Â|â|ï¿|�/.test(repaired); attempt += 1) {
    const candidate = Buffer.from(repaired, "latin1").toString("utf8");
    if (!candidate || candidate.includes("�") || candidate === repaired) {
      break;
    }
    repaired = candidate;
  }
  return repaired;
}

function normalizePlayerNameForSeed(teamName: string, playerName: string, dorsal: number | string): string {
  const seedTeam = seedTeams.find((team) => team.name === teamName);
  const normalizedDorsal = String(dorsal).trim();
  const seedPlayer = seedTeam?.players.find((player) => String(player.dorsal).trim() === normalizedDorsal);
  return seedPlayer?.name ?? playerName;
}

function normalizeTeam(value: unknown): TeamRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = normalizeString(value.name, "Equipo sin nombre");
  const shortName = normalizeString(value.shortName, normalizeString(value.short_name, "NUE"));
  const primaryColor = typeof value.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(value.primaryColor)
    ? value.primaryColor
    : undefined;
  const shieldImage = typeof value.shieldImage === "string" ? value.shieldImage : undefined;
  const stadiumName = normalizeString(value.stadiumName, normalizeString(value.stadium_name, "Tabira"));
  const seasonId = typeof value.seasonId === "string" ? value.seasonId : undefined;
  const players = Array.isArray(value.players)
    ? value.players
        .map((player) => {
          if (!isRecord(player)) {
            return null;
          }

          const playerName = normalizeString(player.name, "Jugador sin nombre");
          const dorsal = isFiniteNumber(player.dorsal)
            ? player.dorsal
            : typeof player.dorsal === "string"
              ? Number(player.dorsal) || 0
              : 0;
          const canonicalPlayerName = normalizePlayerNameForSeed(name, playerName, dorsal);
          return {
            id: typeof player.id === "string" ? player.id : undefined,
            name: canonicalPlayerName,
            dorsal,
            teamId: typeof player.teamId === "string" ? player.teamId : undefined,
            seasonId: typeof player.seasonId === "string" ? player.seasonId : seasonId,
            teamName: name,
            isGoalkeeper: player.isGoalkeeper === true,
          };
        })
        .filter((player): player is NonNullable<typeof player> => player !== null)
    : [];

  return {
    id: normalizeString(value.id, `team-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    name,
    shortName: shortName.toUpperCase(),
    short_name: shortName.toUpperCase(),
    primaryColor,
    shieldImage,
    seasonId,
    stadiumName,
    stadium_name: stadiumName,
    players,
  };
}

function normalizePlayer(value: unknown): Team["players"][number] | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = normalizeString(value.name, "Jugador sin nombre");
  const dorsal = isFiniteNumber(value.dorsal) || typeof value.dorsal === "string" ? value.dorsal : 0;

  return {
    name,
    dorsal,
  };
}

function normalizeRound(value: unknown): RoundRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const status = value.status === "completed" || value.status === "in-progress" || value.status === "upcoming"
    ? value.status
    : "upcoming";

  return {
    id: normalizeString(value.id, `round-${Date.now()}`),
    seasonId: normalizeString(value.seasonId, defaultStore.seasons[0].id),
    title: normalizeString(value.title, `Jornada ${Number(value.roundNumber ?? value.round_number ?? 1)}`),
    roundNumber: Number(value.roundNumber ?? value.round_number ?? 1) || 1,
    date: normalizeString(value.date, "2026-09-10"),
    status,
  };
}

function normalizeCalendarRound(value: unknown): CalendarRound | null {
  if (!isRecord(value)) {
    return null;
  }

  const status = value.status === "completed" || value.status === "in-progress" || value.status === "upcoming"
    ? value.status
    : "upcoming";

  const roundId = Number(value.id);

  return {
    id: Number.isFinite(roundId) ? roundId : Date.now(),
    title: normalizeString(value.title, "Jornada"),
    date: normalizeString(value.date, "2026-09-10"),
    status,
    matches: Array.isArray(value.matches) ? value.matches.map((entry) => ({
      time: normalizeString((isRecord(entry) ? entry.time : undefined), "16:00"),
      home: normalizeString(isRecord(entry) ? entry.home : undefined, "Equipo local"),
      away: normalizeString(isRecord(entry) ? entry.away : undefined, "Equipo visitante"),
      stadium: normalizeString(isRecord(entry) ? entry.stadium : undefined, "Tabira"),
      result: typeof isRecord(entry) ? entry.result : undefined,
    })) : [],
    descansan: Array.isArray(value.descansan) ? value.descansan.map((entry) => normalizeString(entry, "Equipo libre")) : [],
  };
}

function normalizeMatch(value: unknown): MatchRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawHome = typeof value.home === "string" ? value.home.trim() : typeof value.homeTeamName === "string" ? value.homeTeamName.trim() : "";
  const rawAway = typeof value.away === "string" ? value.away.trim() : typeof value.awayTeamName === "string" ? value.awayTeamName.trim() : "";

  if (!rawHome || !rawAway) {
    return null;
  }

  const homeName = normalizeString(value.home, normalizeString(value.homeTeamName, rawHome));
  const awayName = normalizeString(value.away, normalizeString(value.awayTeamName, rawAway));
  const homeGoals = Number(value.homeGoals ?? value.home_goals ?? 0) || 0;
  const awayGoals = Number(value.awayGoals ?? value.away_goals ?? 0) || 0;
  const score = typeof value.score === "string" ? value.score : `${homeGoals} - ${awayGoals}`;
  const rawGoalScorers = Array.isArray(value.goalScorers)
    ? value.goalScorers
    : isRecord(value.goalScorers)
      ? [value.goalScorers]
      : [];
  const goalScorers = rawGoalScorers.length > 0
    ? rawGoalScorers
        .filter((entry): entry is Record<string, unknown> => isRecord(entry))
        .map((entry) => ({
          player: normalizeString(entry.player, ""),
          team: normalizeString(entry.team, ""),
          minute: Number.isFinite(Number(entry.minute)) ? Number(entry.minute) : undefined,
        }))
        .filter((entry) => entry.player.length > 0 && entry.team.length > 0)
    : [];

  return {
    id: typeof value.id === "number" || typeof value.id === "string" ? Number(value.id) || Date.now() : Date.now(),
    jornada: normalizeString(value.jornada, "Jornada 1"),
    date: normalizeString(value.date, "2026-09-10"),
    time: normalizeString(value.time, normalizeString(value.scheduledAt, "16:00")),
    home: homeName,
    away: awayName,
    score,
    shootoutScore: typeof value.shootoutScore === "string" ? value.shootoutScore : undefined,
    winner: typeof value.winner === "string" ? value.winner : undefined,
    stadium: normalizeString(value.stadium, normalizeString(value.stadiumName, "Tabira")),
    events: isRecord(value.events)
      ? {
          home: normalizeString(value.events.home, ""),
          away: normalizeString(value.events.away, ""),
        }
      : { home: "", away: "" },
    goalScorers,
    seasonId: typeof value.seasonId === "string" ? value.seasonId : defaultStore.seasons[0].id,
    roundId: typeof value.roundId === "string" ? value.roundId : undefined,
    homeTeamId: typeof value.homeTeamId === "string" ? value.homeTeamId : undefined,
    awayTeamId: typeof value.awayTeamId === "string" ? value.awayTeamId : undefined,
    scheduledAt: typeof value.scheduledAt === "string" ? value.scheduledAt : undefined,
    stadiumName: normalizeString(value.stadiumName, "Tabira"),
    status: value.status === "scheduled" || value.status === "finished" || value.status === "in-progress" || value.status === "cancelled"
      ? value.status
      : score === "-" ? "scheduled" : "finished",
  };
}

function normalizeSeasons(value: unknown): SeasonRecord[] {
  if (!Array.isArray(value) || value.length === 0) {
    return defaultStore.seasons;
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const yearStart = Number(entry.yearStart ?? entry.year_start ?? 2026);
      const yearEnd = Number(entry.yearEnd ?? entry.year_end ?? yearStart + 1);
      const name = normalizeString(entry.name, "Temporada sin nombre");

      return {
        id: normalizeString(entry.id, `season-${Date.now()}-${Math.random().toString(16).slice(2)}`),
        name,
        yearStart,
        yearEnd,
        isActive: Boolean(entry.isActive ?? entry.is_active ?? false),
      };
    })
    .filter((season): season is SeasonRecord => season !== null);
}

function validateSeasonIntegrity(seasons: SeasonRecord[], teams: TeamRecord[]): void {
  if (seasons.length === 0) {
    throw new Error("Debe existir al menos una temporada activa para la liga.");
  }

  const activeSeason = seasons.find((season) => season.isActive) ?? seasons[0];
  const activeSeasonId = activeSeason.id;

  const teamNames = new Map<string, string>();
  for (const team of teams) {
    const seasonId = team.seasonId ?? activeSeasonId;
    const key = `${seasonId}:${team.name.trim().toLowerCase()}`;
    if (teamNames.has(key)) {
      throw new Error(`El equipo "${team.name}" ya existe en la temporada activa.`);
    }
    teamNames.set(key, team.id);

    if (team.seasonId && team.seasonId !== activeSeasonId) {
      throw new Error(`El equipo "${team.name}" no pertenece a la temporada activa.`);
    }

    const playersByName = new Map<string, string>();
    for (const player of team.players) {
      const normalizedPlayerName = player.name.trim().toLowerCase();
      if (playersByName.has(normalizedPlayerName)) {
        throw new Error(`El jugador "${player.name}" ya existe duplicado en el equipo "${team.name}".`);
      }
      playersByName.set(normalizedPlayerName, player.name);

      const playerSeasonId = player.seasonId ?? seasonId;
      if (playerSeasonId !== seasonId) {
        throw new Error(`El jugador "${player.name}" no pertenece a la temporada del equipo "${team.name}".`);
      }
    }
  }
}

export function normalizeLeagueStore(value: unknown): LeagueStore {
  if (!isRecord(value)) {
    throw new Error("El payload de la liga debe ser un objeto válido.");
  }

  const seasons = normalizeSeasons(value.seasons);
  const activeSeason = seasons.find((season) => season.isActive) ?? seasons[0];
  const activeSeasonId = activeSeason?.id ?? defaultStore.seasons[0].id;

  const teams = Array.isArray(value.teams)
    ? value.teams.map((team) => normalizeTeam(team)).filter((team): team is TeamRecord => team !== null)
    : defaultStore.teams;

  const normalizedTeams = teams.map((team) => ({
    ...team,
    seasonId: typeof team.seasonId === "string" ? team.seasonId : activeSeasonId,
    players: team.players.map((player) => ({
      ...player,
      teamId: typeof player.teamId === "string" ? player.teamId : team.id,
      seasonId: typeof player.seasonId === "string" ? player.seasonId : activeSeasonId,
    })),
  }));

  validateSeasonIntegrity(seasons, normalizedTeams);

  const normalizedMatches = Array.isArray(value.matches)
    ? value.matches
        .map((match) => normalizeMatch(match))
        .filter((match): match is MatchRecord => match !== null)
    : [];

  const matches = normalizedMatches.length > 0
    ? normalizedMatches.map((match) => ({
        ...match,
        goalScorers: (match.goalScorers ?? []).map((scorer) => {
          const team = normalizedTeams.find((candidate) => candidate.name === scorer.team);
          const repairedName = repairMojibake(scorer.player).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          const comparablePlayers = team?.players.filter((player) => repairMojibake(player.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === repairedName) ?? [];
          const firstName = repairedName.split(/\s+/)[0];
          const firstNameMatches = team?.players.filter((player) => repairMojibake(player.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/\s+/)[0] === firstName) ?? [];
          const registeredPlayer = comparablePlayers[0] ?? (firstNameMatches.length === 1 ? firstNameMatches[0] : undefined);
          return registeredPlayer ? { ...scorer, player: registeredPlayer.name } : scorer;
        }),
      }))
    : defaultStore.matches;
  const rounds = Array.isArray(value.rounds)
    ? value.rounds.map((round) => normalizeRound(round)).filter((round): round is RoundRecord => round !== null)
    : defaultStore.rounds;
  const calendar = Array.isArray(value.calendar) && value.calendar.length > 0 ? value.calendar as CalendarRound[] : defaultStore.calendar;
  const sanctions = Array.isArray(value.sanctions) ? value.sanctions as DisciplinaryRecord[] : defaultStore.sanctions;

  if (!isRecord(value.finances)) {
    throw new Error("El payload debe incluir el bloque finances.");
  }

  const finances = value.finances;
  const fees = isRecord(finances.fees) ? finances.fees : defaultStore.finances.fees;
  const payments = isRecord(finances.payments) ? finances.payments : defaultStore.finances.payments;
  const expenses = Array.isArray(finances.expenses) ? finances.expenses : defaultStore.finances.expenses;
  const costs = isRecord(finances.costs) ? finances.costs : defaultStore.finances.costs;
  const points = isRecord(finances.points) ? finances.points : { yellow: 2, doubleYellow: 4, red: 5, other: 0 };

  return {
    seasons,
    teams: normalizedTeams,
    rounds,
    matches,
    calendar,
    sanctions,
    finances: {
      fees: Object.fromEntries(Object.entries(fees).map(([key, amount]) => [key, Number(amount) || 0])),
      payments: Object.fromEntries(Object.entries(payments).map(([key, amount]) => [key, Number(amount) || 0])),
      expenses: expenses.map((entry) => {
        if (!isRecord(entry)) {
          return { id: Date.now(), concept: "Movimiento sin nombre", amount: 0, type: "gasto" as const };
        }

        const amount = Number(entry.amount) || 0;
        const paid = Number(entry.paid) || 0;
        const pending = Number(entry.pending) || Math.max(amount - paid, 0);

        return {
          id: Number(entry.id) || Date.now(),
          concept: normalizeString(entry.concept, "Movimiento sin nombre"),
          amount,
          type: entry.type === "cobro" ? "cobro" : "gasto",
          kind: entry.kind === "cuota" || entry.kind === "patrocinio" || entry.kind === "premio" || entry.kind === "otro" ? entry.kind : undefined,
          category: typeof entry.category === "string" ? entry.category : undefined,
          entity: typeof entry.entity === "string" ? entry.entity : undefined,
          paid,
          pending,
          date: typeof entry.date === "string" ? entry.date : undefined,
          status: entry.status === "planificado" || entry.status === "pendiente" || entry.status === "pagado"
            ? entry.status
            : undefined,
          previousPaid: Number.isFinite(Number(entry.previousPaid)) ? Number(entry.previousPaid) : undefined,
          settlementOnly: entry.settlementOnly === true,
        };
      }),
      costs: {
        yellow: Number(costs.yellow) || 0,
        doubleYellow: Number(costs.doubleYellow) || 0,
        red: Number(costs.red) || 0,
        other: Number(costs.other) || 0,
      },
      points: {
        yellow: Number(points.yellow) || 0,
        doubleYellow: Number(points.doubleYellow) || 0,
        red: Number(points.red) || 0,
        other: Number(points.other) || 0,
      },
      yellowCardResetRoundId: Number(finances.yellowCardResetRoundId) || undefined,
    },
  };
}

export function validateLeagueStore(value: unknown): value is LeagueStore {
  try {
    normalizeLeagueStore(value);
    return true;
  } catch {
    return false;
  }
}

export function validateLeagueStorePayload(value: unknown): LeagueStore {
  return normalizeLeagueStore(value);
}

export async function createStoreBackup(): Promise<string | null> {
  const filePath = getStorePath();

  try {
    await fs.access(filePath);
  } catch {
    return null;
  }

  const backupDirectory = getBackupDirectory();
  await fs.mkdir(backupDirectory, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDirectory, `league-store-${timestamp}.json`);
  const original = await fs.readFile(filePath, "utf8");
  await fs.writeFile(backupPath, original, "utf8");

  return backupPath;
}

function storeLooksCorrupted(candidate: unknown): boolean {
  if (!isRecord(candidate)) {
    return true;
  }

  const matches = Array.isArray(candidate.matches) ? candidate.matches : [];
  const sanctions = Array.isArray(candidate.sanctions) ? candidate.sanctions : [];

  const hasBrokenMatches = matches.some((match) => !isRecord(match) || typeof match.home !== "string" || typeof match.away !== "string");
  const hasBrokenSanctions = sanctions.some((record) => !isRecord(record) || typeof record.player !== "string" || typeof record.team !== "string");

  return hasBrokenMatches || hasBrokenSanctions;
}

export async function ensureStoreFile(): Promise<LeagueStore> {
  const filePath = getStorePath();
  const directory = path.dirname(filePath);

  await fs.mkdir(directory, { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(defaultStore, null, 2), "utf8");
  }

  const raw = await fs.readFile(filePath, "utf8");
  const parsed = raw ? (JSON.parse(raw) as unknown) : defaultStore;

  if (!validateLeagueStore(parsed) || storeLooksCorrupted(parsed)) {
    await fs.writeFile(filePath, JSON.stringify(defaultStore, null, 2), "utf8");
    return defaultStore;
  }

  return normalizeLeagueStore(parsed);
}

export async function readLeagueStore(): Promise<LeagueStore> {
  if (!hasSupabaseConfig) {
    throw new Error("No hay configuración de Supabase. La app está configurada para leer solo desde Supabase.");
  }

  const supabaseStore = await readSupabaseLeagueStore();
  if (!supabaseStore) {
    throw new Error("No se pudo leer la liga desde Supabase.");
  }

  return supabaseStore;
}

async function syncLeagueStoreToSupabase(nextStore: LeagueStore) {
  const client = getSupabaseWriteClient();
  if (!client || !hasSupabaseWriteConfig) {
    return;
  }

  const syncRows = buildSupabaseSyncRows(nextStore);
  if (!syncRows.seasons.length) {
    return;
  }

  const { error: seasonsError } = await client.from("seasons").upsert(syncRows.seasons, { onConflict: "id" });
  if (seasonsError) {
    throw new Error(`No se pudo guardar la temporada en Supabase: ${seasonsError.message}`);
  }

  const { error: teamsError } = await client.from("teams").upsert(syncRows.teams, { onConflict: "id" });
  if (teamsError) {
    throw new Error(`No se pudo guardar los equipos en Supabase: ${teamsError.message}`);
  }

  const { error: playersError } = await client.from("players").upsert(syncRows.players, { onConflict: "id" });
  if (playersError) {
    throw new Error(`No se pudo guardar la plantilla en Supabase: ${playersError.message}`);
  }

  const { error: roundsError } = await client.from("rounds").upsert(syncRows.rounds, { onConflict: "id" });
  if (roundsError) {
    throw new Error(`No se pudo guardar las jornadas en Supabase: ${roundsError.message}`);
  }

  const { error: matchesError } = await client.from("matches").upsert(syncRows.matches, { onConflict: "id" });
  if (matchesError) {
    throw new Error(`No se pudo guardar los partidos en Supabase: ${matchesError.message}`);
  }

  const { error: eventsError } = await client.from("match_events").upsert(syncRows.match_events, { onConflict: "id" });
  if (eventsError) {
    throw new Error(`No se pudo guardar los goles en Supabase: ${eventsError.message}`);
  }

  const { error: sanctionsError } = await client.from("disciplinary_records").upsert(syncRows.disciplinary_records, { onConflict: "id" });
  if (sanctionsError) {
    throw new Error(`No se pudo guardar las sanciones en Supabase: ${sanctionsError.message}`);
  }

  const { error: feesError } = await client.from("team_fees").upsert(syncRows.team_fees, { onConflict: "id" });
  if (feesError) {
    throw new Error(`No se pudo guardar las cuotas en Supabase: ${feesError.message}`);
  }

  const { error: movementsError } = await client.from("financial_movements").upsert(syncRows.financial_movements, { onConflict: "id" });
  if (movementsError) {
    throw new Error(`No se pudo guardar los movimientos en Supabase: ${movementsError.message}`);
  }
}

export async function writeLeagueStore(nextStore: LeagueStore): Promise<LeagueStore> {
  if (!hasSupabaseWriteConfig) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY. La app está configurada para escribir solo en Supabase.");
  }

  if (!validateLeagueStore(nextStore)) {
    throw new Error("La estructura del store no es válida antes de guardarse.");
  }

  await syncLeagueStoreToSupabase(nextStore);
  return nextStore;
}

export async function getTeams() {
  const store = await readLeagueStore();
  return store.teams;
}

export async function getPlayersByTeam(teamIdOrName: string) {
  const store = await readLeagueStore();
  const team = store.teams.find(
    (item) => item.id === teamIdOrName || item.name.toLowerCase() === teamIdOrName.toLowerCase()
  );
  return team?.players ?? [];
}

export async function createTeam(payload: Partial<Team>) {
  const store = await readLeagueStore();

  const team: Team = {
    id: payload.id ?? crypto.randomUUID(),
    name: payload.name ?? "Nuevo equipo",
    shortName: payload.shortName ?? "NUE",
    players: payload.players ?? [],
  };

  store.teams = [...store.teams, team];
  await writeLeagueStore(store);
  return team;
}

export async function createPlayer(
  teamId: string,
  name: string,
  dorsal?: number | string,
  isGoalkeeper = false,
) {
  const store = await readLeagueStore();
  const teamIndex = store.teams.findIndex((team) => team.id === teamId || team.name === teamId);

  if (teamIndex < 0) {
    throw new Error("Equipo no encontrado");
  }

  const player = {
    id: crypto.randomUUID(),
    teamId: store.teams[teamIndex].id,
    seasonId: store.teams[teamIndex].seasonId ?? defaultStore.seasons[0].id,
    name,
    dorsal: dorsal ?? store.teams[teamIndex].players.length + 1,
    isGoalkeeper,
  };

  store.teams[teamIndex].players = [...store.teams[teamIndex].players, player];
  await writeLeagueStore(store);
  return player;
}

export async function createSanction(payload: Partial<DisciplinaryRecord>) {
  const store = await readLeagueStore();
  const sanction: DisciplinaryRecord = {
    id: payload.id ?? Date.now(),
    player: payload.player ?? "Jugado no definido",
    team: payload.team ?? "Equipo sin nombre",
    card: payload.card ?? "Amarilla",
    matches: payload.matches ?? 1,
    remaining: payload.remaining ?? 1,
    reason: payload.reason ?? "Registrada desde backend",
  };

  store.sanctions = [sanction, ...store.sanctions];
  await writeLeagueStore(store);
  return sanction;
}
