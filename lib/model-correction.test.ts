import test from "node:test";
import assert from "node:assert/strict";

import { normalizeLeagueStore, validateLeagueStore, validateLeagueStorePayload } from "@/lib/league-store";
import {
  normalizeSupabaseTeamRow,
  normalizeSupabasePlayerRow,
  normalizeSupabaseMatchRow,
  normalizeSupabaseRoundRow,
  normalizeSupabaseSanctionRow,
} from "@/lib/supabase";

test("normalizeLeagueStore normaliza campos del modelo y conserva la estructura", () => {
  const store = {
    teams: [
      {
        id: "team-1",
        name: "Equipo A",
        short_name: "EQA",
        stadium_name: "Tabira",
        players: [{ name: "Luis", dorsal: "9" }],
      },
    ],
    matches: [{ id: 1, jornada: "J1", date: "2026-09-09", time: "19:00", home: "Equipo A", away: "Equipo B", score: "2 - 1", stadium: "Tabira", events: { home: "", away: "" } }],
    calendar: [{ id: 1, title: "Jornada 1", date: "2026-09-09", status: "upcoming", matches: [], descansan: [] }],
    sanctions: [{ id: 1, player: "Luis", team: "Equipo A", card: "Amarilla", matches: 1, remaining: 1, reason: "Falta" }],
    finances: {
      fees: { "Equipo A": "250" },
      payments: { "Equipo A": "120" },
      expenses: [{ id: 1, concept: "Balones", amount: 150, type: "gasto" }],
      costs: { yellow: "30", doubleYellow: "60", red: "80", other: "120" },
    },
  };

  const normalized = normalizeLeagueStore(store);

  assert.equal(normalized.teams[0].shortName, "EQA");
  assert.equal(normalized.teams[0].short_name, "EQA");
  assert.equal(normalized.teams[0].players[0].dorsal, "9");
  assert.equal(normalized.finances.fees["Equipo A"], 250);
  assert.equal(normalized.finances.costs.yellow, 30);
});

test("validateLeagueStore rechaza un payload sin finances", () => {
  assert.equal(validateLeagueStore({ teams: [] }), false);
});

test("validateLeagueStorePayload acepta payload completo", () => {
  const payload = {
    teams: [{ id: "team-1", name: "Equipo A", shortName: "EQA", players: [{ name: "Luis", dorsal: 9 }] }],
    matches: [{ id: 1, jornada: "J1", date: "2026-09-09", time: "19:00", home: "Equipo A", away: "Equipo B", score: "2 - 1", stadium: "Tabira", events: { home: "", away: "" } }],
    calendar: [{ id: 1, title: "Jornada 1", date: "2026-09-09", status: "upcoming", matches: [], descansan: [] }],
    sanctions: [{ id: 1, player: "Luis", team: "Equipo A", card: "Amarilla", matches: 1, remaining: 1, reason: "Falta" }],
    finances: {
      fees: { "Equipo A": 250 },
      payments: { "Equipo A": 120 },
      expenses: [{ id: 1, concept: "Balones", amount: 150, type: "gasto" }],
      costs: { yellow: 30, doubleYellow: 60, red: 80, other: 120 },
    },
  };

  const result = validateLeagueStorePayload(payload);
  assert.equal(result.teams[0].name, "Equipo A");
  assert.equal(result.finances.costs.red, 80);
});

test("normalizeSupabase helpers map an SQL row to the app model", () => {
  const team = normalizeSupabaseTeamRow({
    id: "t-1",
    name: "Equipo A",
    short_name: "EQA",
    stadium_name: "Tabira",
    players: [{ name: "Luis", dorsal: 9 }],
  });

  const player = normalizeSupabasePlayerRow({
    name: "Luis",
    dorsal: 9,
    teams: { name: "Equipo A" },
  });

  const match = normalizeSupabaseMatchRow({
    id: 1,
    jornada: "J1",
    date: "2026-09-09",
    time: "19:00",
    home: "Equipo A",
    away: "Equipo B",
    score: "2 - 1",
    stadium: "Tabira",
    status: "scheduled",
    home_events: "",
    away_events: "",
  });

  const round = normalizeSupabaseRoundRow({
    id: 1,
    title: "Jornada 1",
    date: "2026-09-09",
    status: "upcoming",
    round_number: 1,
  });

  const sanction = normalizeSupabaseSanctionRow({
    id: 1,
    player: "Luis",
    team: "Equipo A",
    card_type: "Amarilla",
    matches: 1,
    remaining: 1,
    reason: "Falta",
  });

  assert.equal(team.name, "Equipo A");
  assert.equal(player.team, "Equipo A");
  assert.equal(match.home, "Equipo A");
  assert.equal(round.title, "Jornada 1");
  assert.equal(sanction.card, "Amarilla");
});
