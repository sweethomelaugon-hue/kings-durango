import test from "node:test";
import assert from "node:assert/strict";

import { teamColors } from "@/lib/league-data";
import { buildGoalScorersFromEvents, buildSupabaseSyncRows, validateLeagueStore, validateLeagueStorePayload } from "@/lib/league-store";

test("buildGoalScorersFromEvents convierte eventos de gol del match_events en goleadores", () => {
  const events = [
    { event_type: "goal", player: { name: "Aner Azpitarte Leaniz" }, team: { name: "Aston Birras" }, minute: 12 },
    { event_type: "goal", player: { name: "Aner Azpitarte Leaniz" }, team: { name: "Aston Birras" }, minute: 77 },
    { event_type: "own_goal", player: { name: "Leo" }, team: { name: "Kalekantoi" }, minute: 35 },
  ];

  assert.deepEqual(buildGoalScorersFromEvents(events), [
    { player: "Aner Azpitarte Leaniz", team: "Aston Birras", minute: 12 },
    { player: "Aner Azpitarte Leaniz", team: "Aston Birras", minute: 77 },
    { player: "Leo", team: "Kalekantoi", minute: 35 },
  ]);
});

test("validateLeagueStorePayload conserva los resultados y goleadores del partido", () => {
  const payload = {
    seasons: [{ id: "season-2026", name: "Temporada 2026", yearStart: 2026, yearEnd: 2027, isActive: true }],
    teams: [{
      id: "team-1",
      name: "Aston Birras",
      shortName: "AST",
      seasonId: "season-2026",
      stadiumName: "Tabira",
      players: [{ id: "player-1", name: "Aner Azpitarte Leaniz", dorsal: 1, teamId: "team-1", seasonId: "season-2026" }],
    }],
    matches: [{
      id: 1,
      jornada: "Jornada 1",
      date: "2026-09-10",
      time: "16:00",
      home: "Aston Birras",
      away: "Kalekantoi",
      score: "2 - 1",
      stadium: "Tabira",
      events: { home: "", away: "" },
      goalScorers: [{ player: "Aner Azpitarte Leaniz", team: "Aston Birras", minute: 12 }],
    }],
    calendar: [{
      id: 1,
      title: "Jornada 1",
      date: "2026-09-10",
      status: "upcoming",
      matches: [{ time: "16:00", home: "Aston Birras", away: "Kalekantoi", stadium: "Tabira" }],
      descansan: [],
    }],
    sanctions: [],
    finances: {
      fees: { "Aston Birras": 250 },
      payments: { "Aston Birras": 120 },
      expenses: [],
      costs: { yellow: 30, doubleYellow: 60, red: 80, other: 120 },
    },
  };

  const normalized = validateLeagueStorePayload(payload);

  assert.equal(normalized.matches[0].home, "Aston Birras");
  assert.equal(normalized.matches[0].away, "Kalekantoi");
  assert.equal(normalized.matches[0].score, "2 - 1");
  assert.deepEqual(normalized.matches[0].goalScorers, [{ player: "Aner Azpitarte Leaniz", team: "Aston Birras", minute: 12 }]);
});

test("validateLeagueStore acepta un store completo y válido", () => {
  const store = {
    teams: [
      { id: "team-1", name: "Equipo A", shortName: "EQA", players: [{ name: "Jugador 1", dorsal: 10 }] },
    ],
    matches: [{ id: 1, jornada: "J1", date: "2026-09-09", time: "19:00", home: "Equipo A", away: "Equipo B", score: "2 - 1", stadium: "Tabira", events: { home: "", away: "" } }],
    calendar: [{ id: 1, title: "Jornada 1", date: "2026-09-09", status: "upcoming", matches: [], descansan: [] }],
    sanctions: [{ id: 1, player: "Jugador 1", team: "Equipo A", card: "Amarilla", matches: 1, remaining: 1, reason: "Falta" }],
    finances: {
      fees: { "Equipo A": 250 },
      payments: { "Equipo A": 120 },
      expenses: [{ id: 1, concept: "Balones", amount: 50, type: "gasto" }],
      costs: { yellow: 30, doubleYellow: 60, red: 80, other: 120 },
    },
  };

  assert.equal(validateLeagueStore(store), true);
});

test("validateLeagueStorePayload normaliza valores numéricos y mantiene estructura del store", () => {
  const payload = {
    teams: [{ id: "team-1", name: "Equipo A", shortName: "EQA", players: [{ name: "Jugador 1", dorsal: 10 }] }],
    matches: [{ id: 1, jornada: "J1", date: "2026-09-09", time: "19:00", home: "Equipo A", away: "Equipo B", score: "2 - 1", stadium: "Tabira", events: { home: "", away: "" } }],
    calendar: [{ id: 1, title: "Jornada 1", date: "2026-09-09", status: "upcoming", matches: [], descansan: [] }],
    sanctions: [{ id: 1, player: "Jugador 1", team: "Equipo A", card: "Amarilla", matches: 1, remaining: 1, reason: "Falta" }],
    finances: {
      fees: { "Equipo A": "250" },
      payments: { "Equipo A": "120" },
      expenses: [{ id: 1, concept: "Balones", amount: 50, type: "gasto" }],
      costs: { yellow: "30", doubleYellow: "60", red: "80", other: "120" },
    },
  };

  const result = validateLeagueStorePayload(payload);

  assert.equal(result.finances.fees["Equipo A"], 250);
  assert.equal(result.finances.payments["Equipo A"], 120);
  assert.equal(result.finances.costs.yellow, 30);
  assert.equal(result.finances.costs.red, 80);
});

test("Rayo Forestal usa un color de marca alto contraste para destacar en la home", () => {
  assert.equal(teamColors["Rayo Forestal Internacional"].primary, "#22C55E");
  assert.equal(teamColors["Rayo Forestal Internacional"].secondary, "#DCFCE7");
  assert.equal(teamColors["Rayo Forestal Internacional"].accent, "#0F5E3A");
});

test("buildSupabaseSyncRows prepara las filas para sincronizar la liga en Supabase", () => {
  const store = {
    seasons: [{ id: "season-2026", name: "Temporada 2026", yearStart: 2026, yearEnd: 2027, isActive: true }],
    teams: [{
      id: "team-1",
      name: "Aston Birras",
      shortName: "AST",
      seasonId: "season-2026",
      stadiumName: "Tabira",
      players: [{ id: "player-1", name: "Aner Azpitarte Leaniz", dorsal: 1, teamId: "team-1", seasonId: "season-2026" }],
    }],
    rounds: [{ id: "round-1", seasonId: "season-2026", title: "Jornada 1", roundNumber: 1, date: "2026-09-10", status: "upcoming" }],
    matches: [{ id: 1, jornada: "Jornada 1", date: "2026-09-10", time: "19:00", home: "Aston Birras", away: "Kalekantoi", score: "1 - 0", stadium: "Tabira", events: { home: "", away: "" }, goalScorers: [{ player: "Aner Azpitarte Leaniz", team: "Aston Birras", minute: 12 }] }],
    calendar: [{ id: 1, title: "Jornada 1", date: "2026-09-10", status: "upcoming", matches: [], descansan: [] }],
    sanctions: [{ id: 1, player: "Aner Azpitarte Leaniz", team: "Aston Birras", card: "Amarilla", matches: 1, remaining: 1, reason: "Falta" }],
    finances: {
      fees: { "Aston Birras": 250 },
      payments: { "Aston Birras": 120 },
      expenses: [],
      costs: { yellow: 30, doubleYellow: 60, red: 80, other: 120 },
    },
  } as any;

  const rows = buildSupabaseSyncRows(store);

  assert.equal(rows.seasons[0].name, "Temporada 2026");
  assert.equal(rows.teams[0].name, "Aston Birras");
  assert.equal(rows.players[0].team_id, rows.teams[0].id);
  assert.equal(rows.matches[0].home_team_id, rows.teams[0].id);
  assert.equal(rows.team_fees[0].team_id, rows.teams[0].id);
  assert.equal(rows.match_events[0].player_id, rows.players[0].id);
  assert.equal(rows.disciplinary_records[0].player_id, rows.players[0].id);
});

test("validateLeagueStorePayload lanza error si falta el bloque finances", () => {
  assert.throws(() => {
    validateLeagueStorePayload({ teams: [] });
  }, /bloque finances/i);
});
