import test from "node:test";
import assert from "node:assert/strict";

import { getMovementConceptLabel, getMovementTypeLabel } from "@/lib/finance-movements";
import { teamColors } from "@/lib/league-data";
import { buildGoalScorersFromEvents, buildSupabaseSyncRows, clearResultsForRoundAndLater, validateLeagueStore, validateLeagueStorePayload } from "@/lib/league-store";

test("getMovementTypeLabel y getMovementConceptLabel usan el vocabulario del modelo financiero persistido", () => {
  assert.equal(getMovementTypeLabel("cobro"), "Abono");
  assert.equal(getMovementTypeLabel("gasto"), "Gasto");
  assert.equal(getMovementConceptLabel("sancion"), "sanción");
  assert.equal(getMovementConceptLabel("patrocinio"), "patrocinio");
  assert.equal(getMovementConceptLabel("otro"), "otros");
});

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

test("clearResultsForRoundAndLater borra resultados y goleadores desde la jornada elegida y las posteriores", () => {
  const calendar = [
    { id: 1, title: "Jornada 1", date: "2026-09-10", status: "completed", matches: [{ time: "19:00", home: "A", away: "B" }], descansan: [] },
    { id: 2, title: "Jornada 2", date: "2026-09-17", status: "completed", matches: [{ time: "19:00", home: "C", away: "D" }], descansan: [] },
    { id: 3, title: "Jornada 3", date: "2026-09-24", status: "completed", matches: [{ time: "19:00", home: "E", away: "F" }], descansan: [] },
    { id: 4, title: "Jornada 4", date: "2026-10-01", status: "completed", matches: [{ time: "19:00", home: "G", away: "H" }], descansan: [] },
  ];

  const matches = [
    { id: 1, jornada: "Jornada 1", date: "2026-09-10", time: "19:00", home: "A", away: "B", score: "1 - 0", status: "finished", goalScorers: [{ player: "Aitor", team: "A" }] },
    { id: 2, jornada: "Jornada 2", date: "2026-09-17", time: "19:00", home: "C", away: "D", score: "2 - 1", status: "finished", goalScorers: [{ player: "Beto", team: "C" }] },
    { id: 3, jornada: "Jornada 3", date: "2026-09-24", time: "19:00", home: "E", away: "F", score: "3 - 2", status: "finished", goalScorers: [{ player: "Carlos", team: "E" }] },
    { id: 4, jornada: "Jornada 4", date: "2026-10-01", time: "19:00", home: "G", away: "H", score: "0 - 0", status: "finished", goalScorers: [{ player: "Diego", team: "G" }], shootoutScore: "4 - 2" },
  ] as any;

  const next = clearResultsForRoundAndLater({ calendar, matches, targetRoundId: 3 });

  assert.equal(next.matches[0].score, "1 - 0");
  assert.equal(next.matches[1].score, "2 - 1");
  assert.equal(next.matches[2].score, "-");
  assert.deepEqual(next.matches[2].goalScorers, []);
  assert.equal(next.matches[3].score, "-");
  assert.deepEqual(next.matches[3].goalScorers, []);
  assert.equal(next.calendar[0].status, "completed");
  assert.equal(next.calendar[1].status, "completed");
  assert.equal(next.calendar[2].status, "upcoming");
  assert.equal(next.calendar[3].status, "upcoming");
});

test("validateLeagueStorePayload lanza error si falta el bloque finances", () => {
  assert.throws(() => {
    validateLeagueStorePayload({ teams: [] });
  }, /bloque finances/i);
});
