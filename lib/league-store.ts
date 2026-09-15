import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";

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
  kind?: "cuota" | "patrocinio" | "premio" | "sancion" | "otro";
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

export type MatchRecord = Omit<Match, "id"> & {
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

function normalizeSupabaseStatus(value: unknown, fallback: "completed" | "in-progress" | "upcoming" = "upcoming"): "completed" | "in-progress" | "upcoming" {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!candidate) {
    return fallback;
  }

  if (candidate === "in_progress" || candidate === "in-progress") {
    return "in-progress";
  }

  if (candidate === "finished" || candidate === "completed") {
    return "completed";
  }

  if (candidate === "scheduled" || candidate === "upcoming") {
    return "upcoming";
  }

  if (candidate === "cancelled" || candidate === "canceled") {
    return "upcoming";
  }

  return fallback;
}

function normalizeSupabaseMoney(value: unknown, fallback = 0): number {
  const numericValue = Number(value ?? fallback);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function deriveRoundStatusFromMatches(
  roundStatus: "completed" | "in-progress" | "upcoming",
  roundMatches: Array<{ status?: string; hasResult?: boolean }>
): "completed" | "in-progress" | "upcoming" {
  if (roundStatus === "in-progress" || roundStatus === "completed") {
    return roundStatus;
  }

  if (roundMatches.length === 0) {
    return roundStatus;
  }

  const statuses = roundMatches.map((match) => String(match.status ?? "scheduled").trim().toLowerCase());
  const completedMatches = roundMatches.filter((match) => match.hasResult === true || statusIsFinished(match.status)).length;
  if (completedMatches === roundMatches.length) {
    return "completed";
  }

  if (completedMatches > 0 || statuses.some((status) => status === "in-progress" || status === "in_progress")) {
    return "in-progress";
  }

  if (statuses.some((status) => status === "finished" || status === "completed")) {
    return "in-progress";
  }

  return "upcoming";
}

function statusIsFinished(status: string | undefined): boolean {
  const normalizedStatus = String(status ?? "").trim().toLowerCase();
  return normalizedStatus === "finished" || normalizedStatus === "completed";
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

  const toUuid = (value: unknown, namespace = "entity"): string => {
    const candidate = toIdString(value);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)) {
      return candidate;
    }

    const hash = createHash("sha256").update(`kings-durango:${namespace}:${candidate}`).digest("hex").slice(0, 32);
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${(parseInt(hash.slice(16, 18), 16) & 0x3f | 0x80).toString(16).padStart(2, "0")}${hash.slice(18, 20)}-${hash.slice(20)}`;
  };

  const teamIds = new Map<string, string>();
  const teamRows = store.teams.map((team) => {
    const resolvedId = toUuid(team.id, "team");
    teamIds.set(team.name.trim().toLowerCase(), resolvedId);
    return {
      id: resolvedId,
      season_id: team.seasonId ?? seasonId,
      name: team.name,
      short_name: team.shortName ?? team.short_name ?? team.name.slice(0, 3).toUpperCase(),
      stadium_name: team.stadiumName ?? team.stadium_name ?? "Tabira",
      primary_color: team.primaryColor ?? null,
      shield_image: team.shieldImage ?? null,
    };
  });

  const playerIds = new Map<string, string>();
  const playerRows = store.teams.flatMap((team) =>
    (team.players ?? []).map((player) => {
      const playerId = toUuid(player.id ?? `${team.id}:${player.name}`, "player");
      playerIds.set(`${team.name.trim().toLowerCase()}:${player.name.trim().toLowerCase()}`, playerId);
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
    id: toUuid(round.id, "round"),
    season_id: typeof round.seasonId === "string" ? round.seasonId : seasonId,
    title: typeof round.title === "string" ? round.title : `Jornada ${index + 1}`,
    round_number: Number(typeof round.roundNumber === "number" ? round.roundNumber : index + 1),
    date: typeof round.date === "string" ? round.date : "2026-09-10",
    status: typeof store.calendar.find((candidate) => candidate.title === round.title)?.status === "string"
      ? store.calendar.find((candidate) => candidate.title === round.title)?.status
      : typeof round.status === "string" ? round.status : "upcoming",
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
      id: toUuid(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(toIdString(match.id))
          ? match.id
          : `${seasonId}:${match.roundId ?? match.jornada ?? "round"}:${match.home}:${match.away}`,
        "match"
      ),
      season_id: match.seasonId ?? store.seasons[0]?.id ?? seasonId,
      round_id: roundId,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      scheduled_at: match.scheduledAt ?? `${match.date ?? "2026-09-10"}T${match.time ?? "19:00"}:00`,
      stadium_name: match.stadium ?? match.stadiumName ?? "Tabira",
      home_goals: Number(homeGoals ?? 0),
      away_goals: Number(awayGoals ?? 0),
      shootout_home_goals: match.shootoutScore ? Number(match.shootoutScore.split(/[-:]/)[0]?.trim()) : null,
      shootout_away_goals: match.shootoutScore ? Number(match.shootoutScore.split(/[-:]/)[1]?.trim()) : null,
      status: match.status ?? (match.score && match.score !== "-" ? "finished" : "scheduled"),
    };
  });

  const eventRows = store.matches.flatMap((match, matchIndex) =>
    (match.goalScorers ?? []).map((scorer, scorerIndex) => {
      const teamId = teamIds.get(String(scorer.team ?? "").trim().toLowerCase());
      const minute = Number(scorer.minute);
      const playerId = playerIds.get(`${String(scorer.team ?? "").trim().toLowerCase()}:${String(scorer.player ?? "").trim().toLowerCase()}`)
        ?? toUuid(`${scorer.team}:${scorer.player}`, "player");

      return {
        id: toUuid(`${matchRows[matchIndex]?.id ?? "match"}:${playerId}:${scorerIndex}`, "match-event"),
        match_id: String(matchRows[matchIndex]?.id ?? crypto.randomUUID()),
        player_id: playerId,
        team_id: teamId ?? crypto.randomUUID(),
        event_type: "goal",
        minute: Number.isInteger(minute) && minute >= 1 && minute <= 120 ? minute : null,
        notes: `Sincronizado desde admin (${match.home} vs ${match.away})`,
      };
    })
  );

  const sanctionRows = store.sanctions.map((sanction) => {
    const team = store.teams.find((candidate) => candidate.name.trim().toLowerCase() === String(sanction.team ?? "").trim().toLowerCase());
    const player = team?.players.find((candidate) => candidate.name.trim().toLowerCase() === String(sanction.player ?? "").trim().toLowerCase());

    return {
      id: toUuid(sanction.id, "sanction"),
      player_id: player
        ? playerIds.get(`${team?.name.trim().toLowerCase()}:${player.name.trim().toLowerCase()}`) ?? toUuid(`${team?.name}:${player.name}`, "player")
        : toUuid(`${sanction.team}:${sanction.player}`, "player"),
      team_id: team ? (teamIds.get(team.name.trim().toLowerCase()) ?? crypto.randomUUID()) : crypto.randomUUID(),
      match_id: sanction.matchId !== undefined ? toUuid(sanction.matchId, "match") : null,
      card_type: sanction.card ?? "Amarilla",
      reason: sanction.reason ?? "Registrada desde admin",
      suspension_matches: Number(sanction.suspensionMatches ?? sanction.matches ?? 0),
      suspension_remaining: Number(sanction.suspensionRemaining ?? sanction.suspensionMatches ?? sanction.matches ?? 0),
      points_amount: Number(sanction.points ?? sanction.pointsAmount ?? sanction.costAmount ?? sanction.cost_amount ?? 0),
      cost_amount: Number(sanction.points ?? sanction.pointsAmount ?? sanction.costAmount ?? sanction.cost_amount ?? 0),
      paid_amount: Number(sanction.paidAmount ?? sanction.paid_amount ?? 0),
    };
  });

  const feeRows = Object.entries(store.finances?.fees ?? {}).map(([teamName, amount]) => {
    const normalizedTeamKey = teamName.trim().toLowerCase();
    const team = store.teams.find((candidate) =>
      candidate.name.trim().toLowerCase() === normalizedTeamKey || String(candidate.id ?? "") === teamName.trim()
    );
    const teamId = team ? teamIds.get(team.name.trim().toLowerCase()) : undefined;

    if (!teamId) {
      return null;
    }

    return {
      id: crypto.randomUUID(),
      team_id: teamId,
      season_id: seasonId,
      fee_amount: Number(amount ?? 0),
      paid_amount: Number(store.finances?.payments?.[teamName] ?? 0),
      status: Number(store.finances?.payments?.[teamName] ?? 0) >= Number(amount ?? 0) ? "paid" : "pending",
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  const manualFinancialMovementRows = (store.finances?.expenses ?? [])
    .filter((entry) => entry.category !== "Sanción")
    .map((entry) => {
    const teamName = typeof entry.entity === "string" ? entry.entity.trim() : "";
    const teamId = teamName ? teamIds.get(teamName.trim().toLowerCase()) ?? null : null;

    return {
      id: toUuid(entry.id, "movement"),
      season_id: seasonId,
      team_id: teamId,
      concept: entry.concept ?? "Movimiento financiero",
      movement_type: entry.type === "cobro" ? "income" : "expense",
      amount: Number(entry.amount ?? 0),
      paid_amount: Number(entry.paid ?? 0),
      pending_amount: Number(entry.pending ?? Math.max(Number(entry.amount ?? 0) - Number(entry.paid ?? 0), 0)),
      movement_kind: entry.kind ?? "otro",
      category: entry.category ?? null,
      entity: entry.entity ?? null,
      movement_date: entry.date ?? null,
      status: entry.status ?? (Number(entry.paid ?? 0) >= Number(entry.amount ?? 0) ? "pagado" : "pendiente"),
      previous_paid: entry.previousPaid ?? null,
      settlement_only: entry.settlementOnly === true,
      notes: entry.category ? `${entry.category}` : undefined,
    };
  });

  const sanctionFinancialMovementRows = store.sanctions.map((sanction) => {
    const amount = Number(sanction.points ?? sanction.pointsAmount ?? sanction.costAmount ?? sanction.cost_amount ?? 0);
    const paid = Math.min(Number(sanction.paidAmount ?? sanction.paid_amount ?? 0), amount);
    const teamName = String(sanction.team ?? "").trim();
    const teamId = teamIds.get(teamName.toLowerCase()) ?? null;

    return {
      id: toUuid(sanction.id, "sanction-movement"),
      season_id: seasonId,
      team_id: teamId,
      concept: `Sanción · ${sanction.player ?? "Jugador"}`,
      movement_type: "income",
      amount,
      paid_amount: paid,
      pending_amount: Math.max(amount - paid, 0),
      movement_kind: "sancion",
      category: "Sanción",
      entity: teamName || null,
      movement_date: null,
      status: paid >= amount ? "pagado" : "pendiente",
      previous_paid: null,
      settlement_only: false,
      notes: `${sanction.card ?? "Sanción"} · ${sanction.reason ?? ""}`.trim(),
    };
  });

  const financialMovementRows = [...manualFinancialMovementRows, ...sanctionFinancialMovementRows];

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

  const sanctionsQuery = async () => {
    const withPoints = await client
      .from("disciplinary_records")
      .select("id, player_id, team_id, match_id, card_type, reason, suspension_matches, suspension_remaining, points_amount, cost_amount, paid_amount, created_at")
      .order("created_at", { ascending: false });

    if (!withPoints.error || !/points_amount|column/i.test(withPoints.error.message)) {
      return withPoints;
    }

    return client
      .from("disciplinary_records")
      .select("id, player_id, team_id, match_id, card_type, reason, cost_amount, created_at")
      .order("created_at", { ascending: false });
  };

  const movementsQuery = async () => {
    const detailed = await client
      .from("financial_movements")
      .select("id, concept, amount, movement_type, team_id, entity, notes, paid_amount, pending_amount, movement_kind, category, movement_date, status, previous_paid, settlement_only, created_at")
      .order("created_at", { ascending: false });

    if (!detailed.error || !/column|schema cache/i.test(detailed.error.message)) {
      return detailed;
    }

    return client
      .from("financial_movements")
      .select("id, concept, amount, movement_type, team_id, notes, created_at")
      .order("created_at", { ascending: false });
  };

  const [{ data: seasonsData, error: seasonsError }, { data: teamsData, error: teamsError }, { data: roundsData, error: roundsError }, { data: matchesData, error: matchesError }, { data: feesData, error: feesError }, { data: movementsData, error: movementsError }, { data: sanctionsData, error: sanctionsError }, { data: eventsData, error: eventsError }] = await Promise.all([
    client.from("seasons").select("id, name, year_start, year_end, is_active").order("year_start", { ascending: true }),
    client.from("teams").select("id, name, short_name, stadium_name, primary_color, shield_image, season_id, players:players(id, name, dorsal, is_goalkeeper)").order("name"),
    client.from("rounds").select("id, title, round_number, date, status, season_id").order("round_number", { ascending: true }),
    client.from("matches").select("id, season_id, round_id, home_team_id, away_team_id, scheduled_at, stadium_name, home_goals, away_goals, shootout_home_goals, shootout_away_goals, status, created_at, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)").order("scheduled_at", { ascending: true }),
    client.from("team_fees").select("team_id, fee_amount, paid_amount, status").order("team_id", { ascending: true }),
    movementsQuery(),
    sanctionsQuery(),
    client.from("match_events").select("id, match_id, minute, event_type, player:players!match_events_player_id_fkey(name), team:teams!match_events_team_id_fkey(name)").order("minute", { ascending: true }),
  ]);

  if (seasonsError || teamsError || roundsError || matchesError || feesError || movementsError || sanctionsError || eventsError) {
    console.error("No se pudo leer el store completo desde Supabase", {
      seasons: seasonsError?.message,
      teams: teamsError?.message,
      rounds: roundsError?.message,
      matches: matchesError?.message,
      fees: feesError?.message,
      movements: movementsError?.message,
      sanctions: sanctionsError?.message,
      events: eventsError?.message,
    });
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
          primaryColor: typeof team.primary_color === "string" ? team.primary_color : undefined,
          shieldImage: typeof team.shield_image === "string" ? team.shield_image : undefined,
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

  const uniqueMatchesData = Array.isArray(matchesData)
    ? Array.from(matchesData.reduce((unique, match) => {
        const key = `${String(match.round_id ?? "")}:${String(match.home_team_id ?? "")}:${String(match.away_team_id ?? "")}`;
        const current = unique.get(key);
        const currentHasResult = current && (Number(current.home_goals ?? 0) > 0 || Number(current.away_goals ?? 0) > 0 || String(current.status ?? "") !== "scheduled");
        const candidateHasResult = Number(match.home_goals ?? 0) > 0 || Number(match.away_goals ?? 0) > 0 || String(match.status ?? "") !== "scheduled";
        const currentCreatedAt = Date.parse(String(current?.created_at ?? "")) || 0;
        const candidateCreatedAt = Date.parse(String(match.created_at ?? "")) || 0;
        if (!current || (!currentHasResult && candidateHasResult) || (currentHasResult === candidateHasResult && candidateCreatedAt > currentCreatedAt)) {
          unique.set(key, match);
        }
        return unique;
      }, new Map<string, (typeof matchesData)[number]>()).values())
    : [];

  const rounds = Array.isArray(roundsData)
    ? roundsData.map((entry) => ({
        id: String(entry.id),
        seasonId: typeof entry.season_id === "string" ? entry.season_id : seasons[0]?.id ?? defaultStore.seasons[0].id,
        title: String(entry.title ?? "Jornada"),
        roundNumber: Number(entry.round_number ?? 1),
        date: typeof entry.date === "string" ? entry.date : "2026-09-10",
        status: normalizeSupabaseStatus(entry.status, "upcoming"),
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
    ? uniqueMatchesData.map((match, index) => {
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
          id: typeof match.id === "string" || typeof match.id === "number" ? String(match.id) : String(index + 1),
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
          shootoutScore: match.shootout_home_goals !== null && match.shootout_away_goals !== null
            ? `${match.shootout_home_goals} - ${match.shootout_away_goals}`
            : undefined,
          stadium: typeof match.stadium_name === "string" ? match.stadium_name : "Tabira",
          events: { home: "", away: "" },
          goalScorers: goalScorersByMatch.get(matchId) ?? [],
          seasonId: typeof match.season_id === "string" ? match.season_id : seasons[0]?.id ?? defaultStore.seasons[0].id,
          roundId: typeof match.round_id === "string" ? match.round_id : undefined,
          homeTeamId: typeof match.home_team_id === "string" ? match.home_team_id : undefined,
          awayTeamId: typeof match.away_team_id === "string" ? match.away_team_id : undefined,
          scheduledAt: typeof (match as { scheduled_at?: string }).scheduled_at === "string" ? (match as { scheduled_at?: string }).scheduled_at : undefined,
          stadiumName: typeof match.stadium_name === "string" ? match.stadium_name : "Tabira",
          status: String(match.status ?? "") === "finished"
            ? "finished"
            : String(match.status ?? "") === "in-progress"
              ? "in-progress"
              : String(match.status ?? "") === "cancelled"
                ? "cancelled"
                : homeGoals !== 0 || awayGoals !== 0
                  ? "finished"
                  : "scheduled" as "scheduled" | "finished" | "in-progress" | "cancelled",
        };
      })
    : defaultStore.matches;

  const fees = Array.isArray(feesData)
    ? Object.fromEntries(feesData
        .map((entry) => [
          teams.find((team) => team.id === String((entry as { team_id?: string }).team_id ?? ""))?.name ?? "",
          normalizeSupabaseMoney((entry as { fee_amount?: number }).fee_amount, 0),
        ])
        .filter(([key]) => String(key).length > 0))
    : defaultStore.finances.fees;

  const payments = Array.isArray(feesData)
    ? Object.fromEntries(feesData
        .map((entry) => [
          teams.find((team) => team.id === String((entry as { team_id?: string }).team_id ?? ""))?.name ?? "",
          normalizeSupabaseMoney((entry as { paid_amount?: number }).paid_amount, 0),
        ])
        .filter(([key]) => String(key).length > 0))
    : defaultStore.finances.payments;

  const sanctions = Array.isArray(sanctionsData)
    ? sanctionsData.map((entry, index) => {
        const cardValue = (String((entry as { card_type?: string }).card_type ?? "Amarilla") as DisciplinaryRecord["card"]);
        const numericId = Number(entry.id ?? index + 1);
        const team = teams.find((candidate) => candidate.id === String((entry as { team_id?: string }).team_id));
        const player = team?.players.find((candidate) => candidate.id === String((entry as { player_id?: string }).player_id));
        const linkedMatch = matches.find((match) => String(match.id) === String((entry as { match_id?: string | number }).match_id ?? ""));
        const reason = String((entry as { reason?: string }).reason ?? "Registrada desde Supabase");
        const configuredPoints = defaultStore.finances.points?.[
          cardValue === "Amarilla" ? "yellow" : cardValue === "Doble amarilla" ? "doubleYellow" : cardValue === "Roja" ? "red" : "other"
        ] ?? 0;
        const storedPoints = Number((entry as { points_amount?: number }).points_amount);
        const calculatedPoints = cardValue === "Roja" && /antideportiv/i.test(reason) ? configuredPoints * 2 : configuredPoints;
        const storedCost = Number((entry as { cost_amount?: number }).cost_amount);
        const points = storedPoints === 0 && Number.isFinite(storedCost) && storedCost !== 0
          ? storedCost
          : Number.isFinite(storedPoints) ? storedPoints : calculatedPoints;
        const suspensionMatches = cardValue === "Roja" && /^motivos deportivos$/i.test(reason) ? 1 : 0;
        const storedSuspensionMatches = Number((entry as { suspension_matches?: number }).suspension_matches);
        const storedSuspensionRemaining = Number((entry as { suspension_remaining?: number }).suspension_remaining);
        const resolvedSuspensionMatches = Number.isFinite(storedSuspensionMatches) ? storedSuspensionMatches : suspensionMatches;
        const resolvedSuspensionRemaining = Number.isFinite(storedSuspensionRemaining) ? storedSuspensionRemaining : resolvedSuspensionMatches;

        return {
          id: Number.isFinite(numericId) ? numericId : index + 1,
          matchId: typeof (entry as { match_id?: string | number }).match_id === "string" || typeof (entry as { match_id?: string | number }).match_id === "number"
            ? String((entry as { match_id?: string | number }).match_id)
            : undefined,
          jornada: linkedMatch?.jornada,
          player: player?.name ?? "Jugador",
          team: team?.name ?? "Equipo",
          card: cardValue,
          card_type: cardValue,
          matches: 1,
          remaining: 1,
          suspensionMatches: resolvedSuspensionMatches,
          suspensionRemaining: resolvedSuspensionRemaining,
          reason,
          points,
          pointsAmount: points,
          costAmount: points,
          cost_amount: points,
          paidAmount: Number((entry as { paid_amount?: number }).paid_amount ?? 0),
          paid_amount: Number((entry as { paid_amount?: number }).paid_amount ?? 0),
        } satisfies DisciplinaryRecord;
      })
    : defaultStore.sanctions;

  const expenses = Array.isArray(movementsData)
    ? movementsData.map((entry, index) => {
        const movementType = String(entry.movement_type ?? "expense") === "income" ? "cobro" : "gasto";
        const numericId = Number(entry.id ?? index + 1);
        const amount = normalizeSupabaseMoney(entry.amount, 0);
        const paid = normalizeSupabaseMoney((entry as { paid_amount?: number }).paid_amount, movementType === "gasto" ? 0 : amount);
        const pending = normalizeSupabaseMoney((entry as { pending_amount?: number }).pending_amount, Math.max(amount - paid, 0));
        const kind = ["cuota", "patrocinio", "premio", "sancion", "otro"].includes(String((entry as { movement_kind?: string }).movement_kind))
          ? String((entry as { movement_kind?: string }).movement_kind) as "cuota" | "patrocinio" | "premio" | "sancion" | "otro"
          : "otro";

        return {
          id: Number.isFinite(numericId) ? numericId : index + 1,
          concept: String(entry.concept ?? "Movimiento"),
          amount,
          type: movementType as FinancialMovement["type"],
          kind,
          category: typeof (entry as { category?: string }).category === "string" ? (entry as { category?: string }).category : typeof entry.notes === "string" ? entry.notes : undefined,
          entity: typeof (entry as { entity?: string }).entity === "string" ? (entry as { entity?: string }).entity : typeof entry.team_id === "string" ? teams.find((team) => team.id === entry.team_id)?.name ?? "Equipo" : "Liga",
          paid,
          pending,
          date: typeof (entry as { movement_date?: string }).movement_date === "string" ? (entry as { movement_date?: string }).movement_date : typeof entry.created_at === "string" ? entry.created_at.slice(0, 10) : undefined,
          status: ["planificado", "pendiente", "pagado"].includes(String((entry as { status?: string }).status)) ? String((entry as { status?: string }).status) as "planificado" | "pendiente" | "pagado" : paid >= amount ? "pagado" : "pendiente",
          previousPaid: Number.isFinite(Number((entry as { previous_paid?: number }).previous_paid)) ? Number((entry as { previous_paid?: number }).previous_paid) : undefined,
          settlementOnly: (entry as { settlement_only?: boolean }).settlement_only === true,
        } satisfies FinancialMovement;
      })
    : defaultStore.finances.expenses;

  const calendar = Array.isArray(roundsData)
    ? rounds.map((round) => ({
        ...round,
        status: deriveRoundStatusFromMatches(
          round.status,
          uniqueMatchesData
            .filter((match) => String((match as { round_id?: string }).round_id ?? "") === String(round.id))
            .map((match) => ({
              status: typeof (match as { status?: string }).status === "string" ? (match as { status?: string }).status : "scheduled",
              hasResult: Number((match as { home_goals?: number }).home_goals ?? 0) > 0
                || Number((match as { away_goals?: number }).away_goals ?? 0) > 0
                || statusIsFinished((match as { status?: string }).status),
            }))
        ),
      }))
        .map((round) => {
          const roundMatches = uniqueMatchesData
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

          const teamsPlaying = new Set(roundMatches.flatMap((match) => [match.home, match.away]));
          const restingTeams = teams
            .map((team) => team.name)
            .filter((teamName) => !teamsPlaying.has(teamName));

          return {
            id: Number(round.roundNumber) || 1,
            title: round.title,
            date: round.date,
            status: normalizeSupabaseStatus(round.status, "upcoming"),
            matches: roundMatches,
            descansan: restingTeams,
          };
        })
        .sort((a, b) => a.id - b.id)
    : defaultStore.calendar;

  return {
    seasons,
    teams,
    rounds: rounds.map((round) => ({
      ...round,
      status: deriveRoundStatusFromMatches(
        round.status,
        uniqueMatchesData
          .filter((match) => String((match as { round_id?: string }).round_id ?? "") === String(round.id))
          .map((match) => ({
            status: typeof (match as { status?: string }).status === "string" ? (match as { status?: string }).status : "scheduled",
            hasResult: Number((match as { home_goals?: number }).home_goals ?? 0) > 0
              || Number((match as { away_goals?: number }).away_goals ?? 0) > 0
              || statusIsFinished((match as { status?: string }).status),
          }))
      ),
    })),
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

  const status = normalizeSupabaseStatus(value.status, "upcoming");

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

  const status = normalizeSupabaseStatus(value.status, "upcoming");

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
  const matchId = typeof value.id === "number" && Number.isFinite(value.id)
    ? value.id
    : typeof value.id === "string" && value.id.trim()
      ? value.id
      : Date.now();
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
    id: matchId,
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
          kind: entry.kind === "cuota" || entry.kind === "patrocinio" || entry.kind === "premio" || entry.kind === "sancion" || entry.kind === "otro" ? entry.kind : undefined,
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
    throw new Error("La base de datos no está configurada. No se mostrarán datos locales.");
  }

  const supabaseStore = await readSupabaseLeagueStore();
  if (!supabaseStore) {
    throw new Error("No se pudo acceder a Supabase. No se mostrarán datos locales.");
  }

  return supabaseStore;
}

async function syncLeagueStoreToSupabase(nextStore: LeagueStore) {
  const client = getSupabaseWriteClient();
  if (!client || !hasSupabaseWriteConfig) {
    return;
  }

  const syncRows = buildSupabaseSyncRows(nextStore);
  const uniqueMatchRows = Array.from(new Map(syncRows.matches.map((row) => [
    `${row.season_id}:${row.round_id}:${row.home_team_id}:${row.away_team_id}`,
    row,
  ])).values());
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

  const { error: matchesError } = await client.from("matches").upsert(uniqueMatchRows, { onConflict: "id" });
  if (matchesError) {
    throw new Error(`No se pudo guardar los partidos en Supabase: ${matchesError.message}`);
  }

  const seasonIds = syncRows.seasons.map((row) => row.id);
  if (seasonIds.length > 0) {
    const { data: seasonMatchRows, error: seasonMatchesError } = await client
      .from("matches")
      .select("id")
      .in("season_id", seasonIds);
    if (seasonMatchesError) {
      throw new Error(`No se pudieron preparar los goles en Supabase: ${seasonMatchesError.message}`);
    }

    const seasonMatchIds = (seasonMatchRows ?? []).map((row) => row.id);
    const { error: deleteEventsError } = await client.from("match_events").delete().in("match_id", seasonMatchIds).eq("event_type", "goal");
    if (deleteEventsError) {
      throw new Error(`No se pudieron actualizar los goles en Supabase: ${deleteEventsError.message}`);
    }
  }

  if (syncRows.match_events.length > 0) {
    const { error: eventsError } = await client.from("match_events").insert(syncRows.match_events);
    if (eventsError) {
      throw new Error(`No se pudo guardar los goles en Supabase: ${eventsError.message}`);
    }
  }

  const teamIds = syncRows.teams.map((team) => team.id);
  if (teamIds.length > 0) {
    const { error: deleteSanctionsError } = await client
      .from("disciplinary_records")
      .delete()
      .in("team_id", teamIds);
    if (deleteSanctionsError) {
      throw new Error(`No se pudieron actualizar las sanciones en Supabase: ${deleteSanctionsError.message}`);
    }
  }

  if (syncRows.disciplinary_records.length > 0) {
    const { error: sanctionsError } = await client.from("disciplinary_records").insert(syncRows.disciplinary_records);
    if (sanctionsError) {
      throw new Error(`No se pudo guardar las sanciones en Supabase: ${sanctionsError.message}`);
    }
  }

  const { error: feesError } = await client.from("team_fees").upsert(syncRows.team_fees, { onConflict: "team_id,season_id" });
  if (feesError) {
    throw new Error(`No se pudo guardar las cuotas en Supabase: ${feesError.message}`);
  }

  const { error: deleteMovementsError } = await client
    .from("financial_movements")
    .delete()
    .eq("season_id", seasonIds[0]);
  if (deleteMovementsError) {
    throw new Error(`No se pudieron reemplazar los movimientos económicos en Supabase: ${deleteMovementsError.message}`);
  }

  const { error: movementsError } = syncRows.financial_movements.length > 0
    ? await client.from("financial_movements").insert(syncRows.financial_movements)
    : { error: null };
  if (movementsError) {
    throw new Error(`No se pudo guardar los movimientos en Supabase. Ejecuta database/migrate-financial-movement-details.sql en Supabase: ${movementsError.message}`);
  }
}

export async function writeLeagueStore(nextStore: LeagueStore): Promise<LeagueStore> {
  const resolvedStore = validateLeagueStorePayload(nextStore);

  if (hasSupabaseConfig && !hasSupabaseWriteConfig) {
    throw new Error("Supabase está configurado para lectura, pero falta una SUPABASE_SERVICE_ROLE_KEY válida para guardar cambios.");
  }

  if (!hasSupabaseWriteConfig) {
    throw new Error("La base de datos no está disponible para guardar cambios.");
  }

  await syncLeagueStoreToSupabase(resolvedStore);
  return resolvedStore;
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
