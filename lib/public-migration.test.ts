import test from "node:test";
import assert from "node:assert/strict";

import { publicLeagueMigrationSeed } from "@/lib/league-data";
import { buildScorersFromMatches, buildStandingsFromMatches, buildZamoraFromMatches } from "@/app/api/league/route";
import { validateLeagueStorePayload } from "@/lib/league-store";
import { getRequestAdminToken, isAdminAuthorized } from "@/lib/supabase";

test("publicLeagueMigrationSeed conserva IDs estables y datos válidos del store público", () => {
  const normalized = validateLeagueStorePayload({
    ...publicLeagueMigrationSeed,
  });

  assert.equal(normalized.teams.length > 0, true);
  assert.equal(normalized.teams[0].id, "11111111-1111-1111-1111-111111111111");
  assert.equal(normalized.teams[0].name, "Aston Birras");
  assert.equal(normalized.finances.fees["Aston Birras"], 250);
});

test("publicLeagueMigrationSeed conserva el mismo conjunto de equipos en la migración", () => {
  const teamNames = publicLeagueMigrationSeed.teams.map((team) => team.name);
  assert.deepEqual(teamNames.includes("Aston Birras"), true);
  assert.deepEqual(teamNames.includes("Kalekantoi"), true);
  assert.deepEqual(teamNames.includes("Inter Panda"), true);
  assert.deepEqual(teamNames.includes("Pitxi FC"), true);
  assert.deepEqual(teamNames.includes("Zero Filtro"), true);
  assert.deepEqual(teamNames.includes("Tigres"), true);
});

test("validateLeagueStorePayload rechaza equipos duplicados en la misma temporada", () => {
  const payload = {
    seasons: [{ id: "season-1", name: "Temporada 2026", year_start: 2026, year_end: 2027, is_active: true }],
    teams: [
      { id: "team-1", seasonId: "season-1", name: "Aston Birras", shortName: "AST", stadiumName: "Tabira", players: [] },
      { id: "team-2", seasonId: "season-1", name: "Aston Birras", shortName: "ASB", stadiumName: "Tabira", players: [] },
    ],
    matches: [],
    calendar: [],
    sanctions: [],
    finances: { fees: {}, payments: {}, expenses: [], costs: { yellow: 30, doubleYellow: 60, red: 80, other: 120 } },
  };

  assert.throws(() => validateLeagueStorePayload(payload), /duplicado|ya existe/i);
});

test("validateLeagueStorePayload rechaza jugadores duplicados dentro del mismo equipo", () => {
  const payload = {
    seasons: [{ id: "season-1", name: "Temporada 2026", year_start: 2026, year_end: 2027, is_active: true }],
    teams: [{
      id: "team-1",
      seasonId: "season-1",
      name: "Aston Birras",
      shortName: "AST",
      stadiumName: "Tabira",
      players: [
        { id: "player-1", teamId: "team-1", seasonId: "season-1", name: "Aitor Test", dorsal: 10 },
        { id: "player-2", teamId: "team-1", seasonId: "season-1", name: "Aitor Test", dorsal: 11 },
      ],
    }],
    matches: [],
    calendar: [],
    sanctions: [],
    finances: { fees: {}, payments: {}, expenses: [], costs: { yellow: 30, doubleYellow: 60, red: 80, other: 120 } },
  };

  assert.throws(() => validateLeagueStorePayload(payload), /duplicado|ya existe/i);
});

test("validateLeagueStorePayload filtra la lista de jugadores por temporada activa", () => {
  const payload = {
    seasons: [
      { id: "season-1", name: "Temporada 2026", year_start: 2026, year_end: 2027, is_active: true },
      { id: "season-2", name: "Temporada 2027", year_start: 2027, year_end: 2028, is_active: false },
    ],
    teams: [
      { id: "team-1", seasonId: "season-1", name: "Aston Birras", shortName: "AST", stadiumName: "Tabira", players: [{ id: "player-1", teamId: "team-1", seasonId: "season-1", name: "Jugador activo", dorsal: 9 }] },
      { id: "team-2", seasonId: "season-2", name: "Kalekantoi", shortName: "KAL", stadiumName: "Tabira", players: [{ id: "player-2", teamId: "team-2", seasonId: "season-2", name: "Jugador antiguo", dorsal: 7 }] },
    ],
    matches: [],
    calendar: [],
    sanctions: [],
    finances: { fees: {}, payments: {}, expenses: [], costs: { yellow: 30, doubleYellow: 60, red: 80, other: 120 } },
  };

  const normalized = validateLeagueStorePayload(payload);
  const activeSeasonTeams = normalized.teams.filter((team) => team.seasonId === "season-1");

  assert.equal(activeSeasonTeams.length, 1);
  assert.equal(activeSeasonTeams[0].players[0].name, "Jugador activo");
});

test("validateLeagueStorePayload rechaza dos partidos con los mismos equipos dentro de la misma jornada", () => {
  const payload = {
    seasons: [{ id: "season-1", name: "Temporada 2026", year_start: 2026, year_end: 2027, is_active: true }],
    teams: [
      { id: "team-1", seasonId: "season-1", name: "Aston Birras", shortName: "AST", stadiumName: "Tabira", players: [] },
      { id: "team-2", seasonId: "season-1", name: "Kalekantoi", shortName: "KAL", stadiumName: "Tabira", players: [] },
    ],
    rounds: [
      { id: "round-1", seasonId: "season-1", title: "Jornada 1", date: "2026-09-10", status: "in-progress" },
    ],
    matches: [
      { id: "match-1", seasonId: "season-1", roundId: "round-1", homeTeamId: "team-1", awayTeamId: "team-2", scheduledAt: "2026-09-10T18:00:00Z", status: "scheduled" },
      { id: "match-2", seasonId: "season-1", roundId: "round-1", homeTeamId: "team-1", awayTeamId: "team-2", scheduledAt: "2026-09-11T18:00:00Z", status: "scheduled" },
    ],
    calendar: [],
    sanctions: [],
    finances: { fees: {}, payments: {}, expenses: [], costs: { yellow: 30, doubleYellow: 60, red: 80, other: 120 } },
  };

  assert.throws(() => validateLeagueStorePayload(payload), / mismos equipos|duplicado|misma jornada /i);
});

test("validateLeagueStorePayload calcula la jornada activa por status y mantiene calendario público consistente", () => {
  const payload = {
    seasons: [{ id: "season-1", name: "Temporada 2026", year_start: 2026, year_end: 2027, is_active: true }],
    teams: [
      { id: "team-1", seasonId: "season-1", name: "Aston Birras", shortName: "AST", stadiumName: "Tabira", players: [] },
      { id: "team-2", seasonId: "season-1", name: "Kalekantoi", shortName: "KAL", stadiumName: "Tabira", players: [] },
    ],
    rounds: [
      { id: "round-1", seasonId: "season-1", title: "Jornada 1", date: "2026-09-10", status: "completed" },
      { id: "round-2", seasonId: "season-1", title: "Jornada 2", date: "2026-09-17", status: "in-progress" },
      { id: "round-3", seasonId: "season-1", title: "Jornada 3", date: "2026-09-24", status: "upcoming" },
    ],
    matches: [
      { id: "match-1", seasonId: "season-1", roundId: "round-1", homeTeamId: "team-1", awayTeamId: "team-2", scheduledAt: "2026-09-10T18:00:00Z", status: "finished" },
      { id: "match-2", seasonId: "season-1", roundId: "round-2", homeTeamId: "team-1", awayTeamId: "team-2", scheduledAt: "2026-09-17T18:00:00Z", status: "scheduled" },
    ],
    calendar: [
      { id: 1, title: "Jornada 1", date: "2026-09-10", status: "completed", matches: [], descansan: [] },
      { id: 2, title: "Jornada 2", date: "2026-09-17", status: "in-progress", matches: [], descansan: [] },
      { id: 3, title: "Jornada 3", date: "2026-09-24", status: "upcoming", matches: [], descansan: [] },
    ],
    sanctions: [],
    finances: { fees: {}, payments: {}, expenses: [], costs: { yellow: 30, doubleYellow: 60, red: 80, other: 120 } },
  };

  const normalized = validateLeagueStorePayload(payload);
  const activeRound = normalized.rounds.find((round) => round.status === "in-progress");
  const publicCalendar = normalized.calendar ?? [];

  assert.equal(activeRound?.title, "Jornada 2");
  assert.equal(publicCalendar.length, 3);
  assert.equal(publicCalendar[1].status, "in-progress");
});

test("validateLeagueStorePayload acepta resultados con goleadores asociados a jugadores válidos", () => {
  const payload = {
    seasons: [{ id: "season-1", name: "Temporada 2026", year_start: 2026, year_end: 2027, is_active: true }],
    teams: [
      { id: "team-1", seasonId: "season-1", name: "Aston Birras", shortName: "AST", stadiumName: "Tabira", players: [{ id: "player-1", teamId: "team-1", seasonId: "season-1", name: "Aito", dorsal: 9 }] },
      { id: "team-2", seasonId: "season-1", name: "Kalekantoi", shortName: "KAL", stadiumName: "Tabira", players: [{ id: "player-2", teamId: "team-2", seasonId: "season-1", name: "Mikel", dorsal: 10 }] },
    ],
    rounds: [{ id: "round-1", seasonId: "season-1", title: "Jornada 1", date: "2026-09-10", status: "in-progress" }],
    matches: [{
      id: "match-1",
      seasonId: "season-1",
      roundId: "round-1",
      homeTeamId: "team-1",
      awayTeamId: "team-2",
      score: "1 - 0",
      home: "Aston Birras",
      away: "Kalekantoi",
      goalScorers: [{ player: "Aito", team: "Aston Birras", minute: 23 }],
      stadium: "Tabira",
      scheduledAt: "2026-09-10T18:00:00Z",
      status: "finished",
    }],
    calendar: [{ id: 1, title: "Jornada 1", date: "2026-09-10", status: "in-progress", matches: [], descansan: [] }],
    sanctions: [],
    finances: { fees: {}, payments: {}, expenses: [], costs: { yellow: 30, doubleYellow: 60, red: 80, other: 120 } },
  };

  const normalized = validateLeagueStorePayload(payload);
  assert.equal(normalized.matches[0].score, "1 - 0");
  assert.equal(normalized.matches[0].goalScorers?.[0].player, "Aito");
});

test("validateLeagueStorePayload rechaza goleadores sin jugador o sin equipo", () => {
  const payload = {
    seasons: [{ id: "season-1", name: "Temporada 2026", year_start: 2026, year_end: 2027, is_active: true }],
    teams: [
      { id: "team-1", seasonId: "season-1", name: "Aston Birras", shortName: "AST", stadiumName: "Tabira", players: [{ id: "player-1", teamId: "team-1", seasonId: "season-1", name: "Aito", dorsal: 9 }] },
      { id: "team-2", seasonId: "season-1", name: "Kalekantoi", shortName: "KAL", stadiumName: "Tabira", players: [] },
    ],
    rounds: [{ id: "round-1", seasonId: "season-1", title: "Jornada 1", date: "2026-09-10", status: "in-progress" }],
    matches: [{
      id: "match-1",
      seasonId: "season-1",
      roundId: "round-1",
      homeTeamId: "team-1",
      awayTeamId: "team-2",
      score: "1 - 0",
      home: "Aston Birras",
      away: "Kalekantoi",
      goalScorers: [{ player: "", team: "Aston Birras", minute: 23 }],
      stadium: "Tabira",
      scheduledAt: "2026-09-10T18:00:00Z",
      status: "finished",
    }],
    calendar: [{ id: 1, title: "Jornada 1", date: "2026-09-10", status: "in-progress", matches: [], descansan: [] }],
    sanctions: [],
    finances: { fees: {}, payments: {}, expenses: [], costs: { yellow: 30, doubleYellow: 60, red: 80, other: 120 } },
  };

  assert.throws(() => validateLeagueStorePayload(payload), /goleador|equipo|jugador/i);
});

test("validateLeagueStorePayload conserva scores y sanciones con coste asociado", () => {
  const payload = {
    seasons: [{ id: "season-1", name: "Temporada 2026", year_start: 2026, year_end: 2027, is_active: true }],
    teams: [
      { id: "team-1", seasonId: "season-1", name: "Aston Birras", shortName: "AST", stadiumName: "Tabira", players: [{ id: "player-1", teamId: "team-1", seasonId: "season-1", name: "Aito", dorsal: 9 }] },
      { id: "team-2", seasonId: "season-1", name: "Kalekantoi", shortName: "KAL", stadiumName: "Tabira", players: [{ id: "player-2", teamId: "team-2", seasonId: "season-1", name: "Mikel", dorsal: 10 }] },
    ],
    matches: [{
      id: "match-1",
      seasonId: "season-1",
      roundId: "round-1",
      home: "Aston Birras",
      away: "Kalekantoi",
      score: "2 - 1",
      goalScorers: [{ player: "Aito", team: "Aston Birras", minute: 24 }],
      stadium: "Tabira",
      scheduledAt: "2026-09-10T18:00:00Z",
      status: "finished",
    }],
    calendar: [{ id: 1, title: "Jornada 1", date: "2026-09-10", status: "in-progress", matches: [], descansan: [] }],
    sanctions: [{ id: 1, player: "Aito", team: "Aston Birras", card: "Otra", reason: "Falta táctica", matches: 1, remaining: 1, costAmount: 120 }],
    finances: { fees: {}, payments: {}, expenses: [], costs: { yellow: 30, doubleYellow: 60, red: 80, other: 120 } },
  };

  const normalized = validateLeagueStorePayload(payload);
  assert.equal(normalized.matches[0].score, "2 - 1");
  assert.equal(normalized.sanctions[0].card, "Otra");
  assert.equal(normalized.sanctions[0].costAmount, 120);
});

test("isAdminAuthorized exige token válido para acceder a la API administrativa", () => {
  const originalToken = process.env.ADMIN_ACCESS_TOKEN;
  process.env.ADMIN_ACCESS_TOKEN = "kings-admin-token";

  const requestWithoutToken = new Request("http://localhost/api/league", { method: "POST", headers: { "Content-Type": "application/json" } });
  const requestWithToken = new Request("http://localhost/api/league", {
    method: "POST",
    headers: { authorization: "Bearer kings-admin-token", "Content-Type": "application/json" },
  });

  assert.equal(isAdminAuthorized(requestWithoutToken), false);
  assert.equal(getRequestAdminToken(requestWithToken), "kings-admin-token");
  assert.equal(isAdminAuthorized(requestWithToken), true);

  if (originalToken === undefined) {
    delete process.env.ADMIN_ACCESS_TOKEN;
  } else {
    process.env.ADMIN_ACCESS_TOKEN = originalToken;
  }
});

test("buildStandingsFromMatches calcula clasificación determinista desde partidos reales", () => {
  const teams = [
    { name: "Aston Birras" },
    { name: "Kalekantoi" },
    { name: "Inter Panda" },
  ];

  const matches = [
    { home: "Aston Birras", away: "Kalekantoi", score: "2 - 1" },
    { home: "Inter Panda", away: "Aston Birras", score: "0 - 0" },
    { home: "Kalekantoi", away: "Inter Panda", score: "3 - 2" },
  ];

  const standings = buildStandingsFromMatches(teams, matches);
  assert.equal(standings[0].team, "Aston Birras");
  assert.equal(standings[0].points, 7);
  assert.equal(standings[0].goalDifference, 3);
  assert.equal(standings[1].team, "Kalekantoi");
  assert.equal(standings[2].team, "Inter Panda");
});

test("buildStandingsFromMatches rechaza equipos duplicados en la misma tabla", () => {
  const teams = [
    { name: "Aston Birras" },
    { name: "aston birras" },
  ];

  const matches = [{ home: "Aston Birras", away: "Kalekantoi", score: "1 - 0" }];

  assert.throws(() => buildStandingsFromMatches(teams, matches), /duplicados|duplicado/i);
});

test("buildScorersFromMatches calcula goleadores reales por partido y equipo", () => {
  const teams = [
    { name: "Aston Birras", players: [{ name: "Aito" }, { name: "Iker" }] },
    { name: "Kalekantoi", players: [{ name: "Mikel" }] },
    { name: "Inter Panda", players: [{ name: "Leo" }] },
  ];

  const matches = [
    {
      home: "Aston Birras",
      away: "Kalekantoi",
      score: "3 - 1",
      goalScorers: [
        { player: "Aito", team: "Aston Birras", minute: 12 },
        { player: "Aito", team: "Aston Birras", minute: 77 },
        { player: "Mikel", team: "Kalekantoi", minute: 38 },
      ],
    },
    {
      home: "Inter Panda",
      away: "Aston Birras",
      score: "1 - 2",
      goalScorers: [
        { player: "Leo", team: "Inter Panda", minute: 58 },
        { player: "Aito", team: "Aston Birras", minute: 40 },
        { player: "Aito", team: "Aston Birras", minute: 71 },
      ],
    },
  ];

  const scorers = buildScorersFromMatches(teams, matches);
  assert.equal(scorers[0].name, "Aito");
  assert.equal(scorers[0].team, "Aston Birras");
  assert.equal(scorers[0].goals, 4);
  assert.equal(scorers[0].matches, 2);
  assert.equal(scorers[1].name, "Leo");
  assert.equal(scorers[1].goals, 1);
  assert.equal(scorers[2].name, "Mikel");
});

test("buildZamoraFromMatches calcula porterías a cero y promedio por equipo", () => {
  const teams = [
    { name: "Aston Birras", players: [{ name: "Aitor", dorsal: 1 }] },
    { name: "Kalekantoi", players: [{ name: "Ander", dorsal: 1 }] },
    { name: "Inter Panda", players: [{ name: "Alex", dorsal: 1 }] },
  ];

  const matches = [
    { home: "Aston Birras", away: "Kalekantoi", score: "2 - 0" },
    { home: "Kalekantoi", away: "Inter Panda", score: "1 - 1" },
    { home: "Inter Panda", away: "Aston Birras", score: "0 - 1" },
  ];

  const zamora = buildZamoraFromMatches(teams, matches);
  assert.equal(zamora[0].team, "Aston Birras");
  assert.equal(zamora[0].matches, 2);
  assert.equal(zamora[0].goalsAgainst, 1);
  assert.equal(zamora[0].cleanSheets, 1);
  assert.equal(zamora[0].average, 0.5);
  assert.equal(zamora[1].team, "Inter Panda");
  assert.equal(zamora[1].average, 1);
  assert.equal(zamora[2].team, "Kalekantoi");
});
