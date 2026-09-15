import { NextResponse } from "next/server";

import { publicLeagueMigrationSeed } from "@/lib/league-data";
import { recalculateSuspensionRemaining } from "@/lib/discipline";
import { readLeagueStore, repairMojibake, validateLeagueStorePayload, writeLeagueStore } from "@/lib/league-store";
import { isAdminAuthorized } from "@/lib/supabase";

function isEmptyStore(store: unknown): boolean {
  if (!store || typeof store !== "object") {
    return true;
  }

  const candidate = store as {
    seasons?: unknown[];
    teams?: unknown[];
    matches?: unknown[];
    calendar?: unknown[];
    sanctions?: unknown[];
  };

  return !candidate.seasons?.length && !candidate.teams?.length && !candidate.matches?.length && !candidate.calendar?.length && !candidate.sanctions?.length;
}

async function ensurePublicSeed() {
  const current = await readLeagueStore();
  if (!isEmptyStore(current)) {
    return current;
  }

  const nextStore = validateLeagueStorePayload({
    ...current,
    ...publicLeagueMigrationSeed,
    seasons: Array.isArray(current.seasons) && current.seasons.length > 0 ? current.seasons : [{
      id: "season-2026",
      name: "Temporada 2026",
      yearStart: 2026,
      yearEnd: 2027,
      isActive: true,
    }],
  });

  return writeLeagueStore(nextStore);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type LeagueStanding = {
  team: string;
  played: number;
  wins: number;
  eg: number;
  ep: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string[];
  position?: number;
};

function normalizeGoalScore(rawValue: unknown): [number, number] {
  const score = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!score || score === "-") {
    return [0, 0];
  }

  const [homeValue, awayValue] = score.split(/[-:]/).map((part) => Number.parseInt(part.trim(), 10));
  if (Number.isNaN(homeValue) || Number.isNaN(awayValue)) {
    throw new Error("El resultado del partido debe seguir el formato '1 - 0'.");
  }

  return [homeValue, awayValue];
}

export function buildStandingsFromMatches(
  teams: Array<{ name: string }>,
  matches: Array<Record<string, unknown>>
): LeagueStanding[] {
  const uniqueTeams = new Set<string>();
  const storeTeams = teams
    .map((team) => typeof team?.name === "string" ? team.name.trim() : "")
    .filter((name) => {
      if (!name) {
        return false;
      }

      const key = name.toLowerCase();
      if (uniqueTeams.has(key)) {
        return false;
      }

      uniqueTeams.add(key);
      return true;
    });

  if (storeTeams.length !== teams.filter((team) => typeof team?.name === "string" && team.name.trim().length > 0).length) {
    throw new Error("No se permiten equipos duplicados en la clasificación.");
  }

  const table = storeTeams.map((team) => ({
    team,
    played: 0,
    wins: 0,
    eg: 0,
    ep: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: [] as string[],
  }));

  for (const match of matches) {
    if (!isObjectRecord(match)) {
      continue;
    }

    const score = typeof match.score === "string" ? match.score.trim() : "";
    if (!score || score === "-") {
      continue;
    }

    const [homeGoals, awayGoals] = normalizeGoalScore(score);
    const homeName = typeof match.home === "string" ? match.home.trim() : "";
    const awayName = typeof match.away === "string" ? match.away.trim() : "";

    if (!homeName || !awayName) {
      continue;
    }

    const homeTeam = table.find((team) => team.team === homeName);
    const awayTeam = table.find((team) => team.team === awayName);
    if (!homeTeam || !awayTeam) {
      continue;
    }

    homeTeam.played += 1;
    awayTeam.played += 1;
    homeTeam.goalsFor += homeGoals;
    homeTeam.goalsAgainst += awayGoals;
    awayTeam.goalsFor += awayGoals;
    awayTeam.goalsAgainst += homeGoals;

    if (homeGoals > awayGoals) {
      homeTeam.wins += 1;
      homeTeam.points += 3;
      awayTeam.losses += 1;
      homeTeam.form.push("G");
      awayTeam.form.push("P");
    } else if (awayGoals > homeGoals) {
      awayTeam.wins += 1;
      awayTeam.points += 3;
      homeTeam.losses += 1;
      homeTeam.form.push("P");
      awayTeam.form.push("G");
    } else {
      const shootoutScore = typeof match.shootoutScore === "string" ? match.shootoutScore.split("-").map((part) => Number.parseInt(part.trim(), 10)) : [];
      const homeShootout = shootoutScore[0];
      const awayShootout = shootoutScore[1];
      if (Number.isFinite(homeShootout) && Number.isFinite(awayShootout) && homeShootout !== awayShootout) {
        if (homeShootout > awayShootout) {
          homeTeam.eg += 1;
          homeTeam.points += 2;
          awayTeam.ep += 1;
          awayTeam.points += 1;
          homeTeam.form.push("EG");
          awayTeam.form.push("EP");
        } else {
          awayTeam.eg += 1;
          awayTeam.points += 2;
          homeTeam.ep += 1;
          homeTeam.points += 1;
          homeTeam.form.push("EP");
          awayTeam.form.push("EG");
        }
      } else {
        homeTeam.eg += 1;
        awayTeam.ep += 1;
        homeTeam.points += 2;
        awayTeam.points += 1;
        homeTeam.form.push("EG");
        awayTeam.form.push("EP");
      }
    }
  }

  return table
    .map((team) => ({
      ...team,
      goalDifference: team.goalsFor - team.goalsAgainst,
      form: team.form.slice(-5),
    }))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team))
    .map((team, index) => ({ ...team, position: index + 1 }));
}

export function buildScorersFromMatches(
  teams: Array<{ name: string; players?: Array<{ name: string }> }>,
  matches: Array<Record<string, unknown>>
) {
  const playerStats = new Map<string, { name: string; team: string; goals: number; matches: Set<number> }>();

  for (const team of teams) {
    const teamName = typeof team?.name === "string" ? team.name.trim() : "";
    if (!teamName || !Array.isArray(team.players)) {
      continue;
    }

    for (const player of team.players) {
      const playerName = typeof player?.name === "string" ? player.name.trim() : "";
      if (!playerName) {
        continue;
      }

      playerStats.set(`${teamName.toLowerCase()}::${playerName.toLowerCase()}`, {
        name: playerName,
        team: teamName,
        goals: 0,
        matches: new Set<number>(),
      });
    }
  }

  for (const [index, match] of matches.entries()) {
    if (!isObjectRecord(match)) {
      continue;
    }

    const entries = Array.isArray(match.goalScorers) ? match.goalScorers : [];
    for (const entry of entries) {
      if (!isObjectRecord(entry)) {
        continue;
      }

      const playerName = typeof entry.player === "string" ? entry.player.trim() : "";
      const teamName = typeof entry.team === "string" ? entry.team.trim() : "";
      if (!playerName || !teamName) {
        continue;
      }

      const key = `${teamName.toLowerCase()}::${playerName.toLowerCase()}`;
      const current = playerStats.get(key) ?? {
        name: playerName,
        team: teamName,
        goals: 0,
        matches: new Set<number>(),
      };

      current.goals += 1;
      current.matches.add(index);
      playerStats.set(key, current);
    }
  }

  return Array.from(playerStats.values())
    .filter((entry) => entry.goals > 0)
    .map((entry) => ({
      name: entry.name,
      team: entry.team,
      goals: entry.goals,
      matches: entry.matches.size,
    }))
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name) || a.team.localeCompare(b.team));
}

export function buildZamoraFromMatches(
  teams: Array<{ name: string; players?: Array<{ name: string; isGoalkeeper?: boolean }> }>,
  matches: Array<Record<string, unknown>>
) {
  const entries = new Map<string, { name: string; team: string; matches: number; goalsAgainst: number; cleanSheets: number }>();

  for (const team of teams) {
    const teamName = typeof team?.name === "string" ? team.name.trim() : "";
    if (!teamName) {
      continue;
    }

    const goalkeepers = (team.players ?? []).filter((player) => player.isGoalkeeper === true && player.name.trim());
    const goalkeeperName = goalkeepers.length > 0
      ? goalkeepers.map((player) => player.name.trim()).join(" · ")
      : teamName;
    entries.set(teamName.toLowerCase(), {
      name: goalkeeperName,
      team: teamName,
      matches: 0,
      goalsAgainst: 0,
      cleanSheets: 0,
    });
  }

  for (const match of matches) {
    if (!isObjectRecord(match)) {
      continue;
    }

    const score = typeof match.score === "string" ? match.score.trim() : "";
    if (!score || score === "-") {
      continue;
    }

    const [homeGoals, awayGoals] = normalizeGoalScore(score);
    const homeName = typeof match.home === "string" ? match.home.trim() : "";
    const awayName = typeof match.away === "string" ? match.away.trim() : "";

    if (!homeName || !awayName) {
      continue;
    }

    const homeKeeper = entries.get(homeName.toLowerCase());
    const awayKeeper = entries.get(awayName.toLowerCase());
    if (!homeKeeper || !awayKeeper) {
      continue;
    }

    homeKeeper.matches += 1;
    homeKeeper.goalsAgainst += awayGoals;
    if (awayGoals === 0) homeKeeper.cleanSheets += 1;
    awayKeeper.matches += 1;
    awayKeeper.goalsAgainst += homeGoals;
    if (homeGoals === 0) awayKeeper.cleanSheets += 1;
  }

  return Array.from(entries.values())
    .map((entry) => ({
      name: entry.name,
      team: entry.team,
      matches: entry.matches,
      goalsAgainst: entry.goalsAgainst,
      cleanSheets: entry.cleanSheets,
      average: entry.matches > 0 ? Number((entry.goalsAgainst / entry.matches).toFixed(2)) : 0,
    }))
    .filter((entry) => entry.matches > 0)
    .sort((a, b) => a.average - b.average || b.cleanSheets - a.cleanSheets || a.goalsAgainst - b.goalsAgainst || a.team.localeCompare(b.team));
}

function validateGoalScorers(store: Awaited<ReturnType<typeof readLeagueStore>>, match: Record<string, unknown>, matchIndex: number) {
  const teamNames = new Set(store.teams.map((team) => team.name));
  const entries = Array.isArray(match.goalScorers) ? match.goalScorers : [];

  for (const [index, entry] of entries.entries()) {
    if (!isObjectRecord(entry)) {
      throw new Error(`El goleador ${index + 1} del partido ${matchIndex + 1} no tiene un formato válido.`);
    }

    const playerName = typeof entry.player === "string" ? entry.player.trim() : "";
    const teamName = typeof entry.team === "string" ? entry.team.trim() : "";
    if (!playerName || !teamName) {
      throw new Error(`El goleador ${index + 1} del partido ${matchIndex + 1} debe incluir nombre y equipo.`);
    }

    const comparablePlayerName = repairMojibake(playerName).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const namedTeam = store.teams.find((candidate) => candidate.name === teamName);
    const team = namedTeam ?? store.teams.find((candidate) => candidate.players.some((player) =>
      repairMojibake(player.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === comparablePlayerName
    ));
    if (!teamNames.has(teamName) && !team) {
      throw new Error(`El goleador ${playerName} del partido ${matchIndex + 1} no pertenece a un equipo válido.`);
    }

    const comparablePlayers = team?.players.filter((player) => repairMojibake(player.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === comparablePlayerName) ?? [];
    const firstName = comparablePlayerName.split(/\s+/)[0];
    const firstNameMatches = team?.players.filter((player) => repairMojibake(player.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/\s+/)[0] === firstName) ?? [];
    const registeredPlayer = comparablePlayers.length > 0 || firstNameMatches.length === 1;
    if (!registeredPlayer) {
      throw new Error(`El jugador "${playerName}" del equipo "${teamName}" no existe en la plantilla.`);
    }

    if (!team) {
      continue;
    }

    // Historical scorers are allowed here. A full-store save can revisit old
    // matches after a later sanction was registered; the result editor still
    // validates newly entered scorers before sending them to this route.
  }
}

function normalizeGoalScorerTeamNames(
  store: Awaited<ReturnType<typeof readLeagueStore>>,
  matches: unknown[],
) {
  return matches.map((match) => {
    if (!isObjectRecord(match) || !Array.isArray(match.goalScorers)) {
      return match;
    }

    return {
      ...match,
      goalScorers: match.goalScorers.map((entry) => {
        if (!isObjectRecord(entry) || typeof entry.player !== "string") {
          return entry;
        }

        const comparablePlayerName = repairMojibake(entry.player).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const matchingTeams = store.teams.filter((team) => team.players.some((player) =>
          repairMojibake(player.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === comparablePlayerName
        ));
        const entryTeamName = typeof entry.team === "string" ? entry.team.trim() : "";
        const namedTeam = entryTeamName ? store.teams.find((team) => team.name === entryTeamName) : undefined;
        const resolvedTeam = namedTeam ?? (matchingTeams.length === 1 ? matchingTeams[0] : undefined);
        return resolvedTeam ? { ...entry, team: resolvedTeam.name } : entry;
      }),
    };
  });
}

export function validateDisciplinaryRecords(
  store: Awaited<ReturnType<typeof readLeagueStore>>,
  sanctions: unknown,
): Array<Record<string, unknown>> {
  const records = Array.isArray(sanctions) ? sanctions : [];
  const normalized: Array<Record<string, unknown>> = [];

  for (const [index, record] of records.entries()) {
    if (!isObjectRecord(record)) {
      throw new Error(`La sanción ${index + 1} no tiene un formato válido.`);
    }

    const playerName = typeof record.player === "string" ? record.player.trim() : "";
    const teamName = typeof record.team === "string" ? record.team.trim() : "";
    const rawCard = typeof record.card === "string" ? record.card.trim() : typeof record.cardType === "string" ? record.cardType.trim() : "";
    const reason = typeof record.reason === "string" ? record.reason.trim() : "";

    if (!playerName || !teamName) {
      throw new Error(`La sanción ${index + 1} debe incluir equipo y jugador.`);
    }

    const team = store.teams.find((candidate) => candidate.name === teamName);
    if (!team) {
      throw new Error(`El equipo "${teamName}" de la sanción ${index + 1} no existe.`);
    }

    const jornada = typeof record.jornada === "string" ? record.jornada.trim() : "";
    const sanctionRound = jornada ? store.calendar.find((round) => round.title === jornada) : undefined;
    if (jornada && (!sanctionRound || sanctionRound.status === "upcoming")) {
      throw new Error(`La sanción ${index + 1} solo puede pertenecer a una jornada finalizada o en curso.`);
    }

    const linkedMatch = jornada
      ? store.matches.find((match) =>
          match.jornada === jornada
          && (match.home === teamName || match.away === teamName)
          && Boolean(match.score && match.score !== "-"))
      : undefined;
    if (jornada && !linkedMatch) {
      throw new Error(`La sanción ${index + 1} solo puede registrarse cuando el partido de ${teamName} ya tiene resultado.`);
    }

    const player = team.players.find((candidate) => candidate.name.toLowerCase() === playerName.toLowerCase());
    if (!player) {
      console.warn(`Sanción ignorada por jugador inexistente: ${playerName} (${teamName})`);
      continue;
    }

    const allowedCards = ["Amarilla", "Doble amarilla", "Roja", "Otra"] as const;
    const card = allowedCards.includes(rawCard as (typeof allowedCards)[number]) ? rawCard : "Otra";
    if (!reason) {
      throw new Error(`La sanción de ${playerName} debe incluir un motivo.`);
    }

    const manualAmount = Number(record.pointsAmount ?? record.points ?? record.costAmount ?? record.cost_amount);
    const hasManualAmount = (card === "Otra" || /otros motivos/i.test(reason)) && Number.isFinite(manualAmount) && manualAmount >= 0;
    const existingMatches = Number(record.matches ?? 1) || 1;
    const remaining = Number(record.remaining ?? existingMatches) || existingMatches;
    const configuredPoints = Number(store.finances.points?.[card === "Amarilla" ? "yellow" : card === "Doble amarilla" ? "doubleYellow" : card === "Roja" ? "red" : "other"]) || 0;
    const points = hasManualAmount ? manualAmount : card === "Roja" && /antideportiv/i.test(reason) ? configuredPoints * 2 : configuredPoints;
    const sanctionAmount = points;

    normalized.push({
      ...record,
      id: typeof record.id === "number" || typeof record.id === "string" ? record.id : Date.now() + index,
      jornada: jornada || linkedMatch?.jornada,
      matchId: linkedMatch?.id ?? (typeof record.matchId === "string" || typeof record.matchId === "number" ? record.matchId : undefined),
      suspensionReason: typeof record.suspensionReason === "string" ? record.suspensionReason : undefined,
      suspensionMatches: Number(record.suspensionMatches ?? record.matches ?? 0) || 0,
      suspensionRemaining: Number(record.suspensionRemaining ?? record.suspensionMatches ?? record.matches ?? 0) || 0,
      player: playerName,
      team: teamName,
      playerId: typeof record.playerId === "string" ? record.playerId : typeof record.player_id === "string" ? record.player_id : player.id,
      teamId: typeof record.teamId === "string" ? record.teamId : typeof record.team_id === "string" ? record.team_id : team.id,
      card,
      card_type: card,
      matches: existingMatches,
      remaining,
      reason,
      points,
      pointsAmount: points,
      costAmount: sanctionAmount,
      cost_amount: sanctionAmount,
      paidAmount: Math.min(Number(record.paidAmount ?? record.paid_amount ?? 0) || 0, sanctionAmount),
      paid_amount: Math.min(Number(record.paidAmount ?? record.paid_amount ?? 0) || 0, sanctionAmount),
    });
  }

  return normalized;
}

export async function GET() {
  try {
    const store = await ensurePublicSeed();
    const standings = buildStandingsFromMatches(store.teams, store.matches as Array<Record<string, unknown>>);
    const scorers = buildScorersFromMatches(store.teams, store.matches as Array<Record<string, unknown>>);
    const zamora = buildZamoraFromMatches(store.teams, store.matches as Array<Record<string, unknown>>);
    return NextResponse.json({ data: { ...store, standings, scorers, zamora } }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer el store de la liga.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado. Debes proporcionar un token de administrador válido." }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const current = await ensurePublicSeed();
    const parsedPayload = isObjectRecord(payload) ? payload : {};

    const rawMatches = Array.isArray(parsedPayload.matches) ? parsedPayload.matches : current.matches;
    const validationStore = {
      ...current,
      teams: Array.isArray(parsedPayload.teams) ? validateLeagueStorePayload({ ...current, ...parsedPayload, teams: parsedPayload.teams }).teams : current.teams,
    };
    const matches = normalizeGoalScorerTeamNames(validationStore, rawMatches);
    for (const [index, match] of matches.entries()) {
      if (!isObjectRecord(match)) {
        continue;
      }

      const score = typeof match.score === "string" ? match.score.trim() : "";
      if (score && score !== "-") {
        const [homeValue, awayValue] = score.split("-").map((value) => Number.parseInt(value.trim(), 10));
        if (Number.isNaN(homeValue) || Number.isNaN(awayValue)) {
          throw new Error(`El resultado del partido ${index + 1} no tiene un formato válido.`);
        }
      }

      const shootoutScore = typeof match.shootoutScore === "string" ? match.shootoutScore.trim() : "";
      if (shootoutScore) {
        const [homeShootout, awayShootout] = shootoutScore.split("-").map((value) => Number.parseInt(value.trim(), 10));
        if (Number.isNaN(homeShootout) || Number.isNaN(awayShootout)) {
          throw new Error(`El desempate por penaltis del partido ${index + 1} no tiene un formato válido.`);
        }
      }

      validateGoalScorers(current, match, index);
    }

    const sanctions = Array.isArray(parsedPayload.sanctions) ? parsedPayload.sanctions : current.sanctions;
    const normalizedSanctions = validateDisciplinaryRecords(current, sanctions);

    const nextStore = validateLeagueStorePayload({
      ...current,
      ...parsedPayload,
      seasons: Array.isArray(parsedPayload.seasons) ? parsedPayload.seasons : current.seasons,
      teams: Array.isArray(parsedPayload.teams) ? parsedPayload.teams : current.teams,
      matches,
      calendar: Array.isArray(parsedPayload.calendar) ? parsedPayload.calendar : current.calendar,
      sanctions: normalizedSanctions,
      finances: isObjectRecord(parsedPayload.finances) ? {
        ...current.finances,
        ...parsedPayload.finances,
      } : current.finances,
    });
    nextStore.sanctions = recalculateSuspensionRemaining(nextStore.sanctions, nextStore.calendar);

    const standings = buildStandingsFromMatches(nextStore.teams, nextStore.matches as Array<Record<string, unknown>>);
    const scorers = buildScorersFromMatches(nextStore.teams, nextStore.matches as Array<Record<string, unknown>>);
    const zamora = buildZamoraFromMatches(nextStore.teams, nextStore.matches as Array<Record<string, unknown>>);
    const saved = await writeLeagueStore(nextStore);
    return NextResponse.json({ data: { ...saved, standings, scorers, zamora } }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar la información del admin";
    console.error("league store update failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
