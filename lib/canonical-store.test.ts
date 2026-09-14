import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { readCanonicalLeagueStore, resolveCanonicalStoreMode, writeCanonicalLeagueStore } from "@/lib/canonical-store";
import type { LeagueStore } from "@/lib/league-store";

test("resolveCanonicalStoreMode usa Supabase cuando está configurado", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";

  try {
    assert.equal(resolveCanonicalStoreMode(), "supabase");
  } finally {
    if (previousUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    }

    if (previousAnon === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
    }
  }
});

test("writeCanonicalLeagueStore persiste el mismo payload en JSON local y se puede leer de nuevo", async () => {
  const previousPath = process.env.LEAGUE_STORE_PATH;
  const tempPath = path.join(process.cwd(), "data", "canonical-store.test.json");
  process.env.LEAGUE_STORE_PATH = tempPath;

  const store: LeagueStore = {
    seasons: [{ id: "season-1", name: "Temporada 2026", yearStart: 2026, yearEnd: 2027, isActive: true }],
    teams: [{
      id: "team-1",
      name: "Aston Birras",
      shortName: "AST",
      seasonId: "season-1",
      stadiumName: "Tabira",
      players: [{ id: "player-1", teamId: "team-1", seasonId: "season-1", name: "Aitor", dorsal: 9 }],
    }],
    rounds: [{ id: "round-1", seasonId: "season-1", title: "Jornada 1", roundNumber: 1, date: "2026-09-06", status: "in-progress" }],
    matches: [{
      id: 1,
      jornada: "Jornada 1",
      date: "2026-09-06",
      time: "18:00",
      home: "Aston Birras",
      away: "Kalekantoi",
      score: "1 - 0",
      stadium: "Tabira",
      events: { home: "Gol de Aitor", away: "" },
      goalScorers: [{ player: "Aitor", team: "Aston Birras", minute: 31 }],
      seasonId: "season-1",
      roundId: "round-1",
    }],
    calendar: [{ id: 1, title: "Jornada 1", date: "2026-09-06", status: "in-progress", matches: [], descansan: [] }],
    sanctions: [{ id: 1, player: "Aitor", team: "Aston Birras", card: "Amarilla", matches: 1, remaining: 1, reason: "Falta táctica" }],
    finances: {
      fees: { "Aston Birras": 250 },
      payments: { "Aston Birras": 120 },
      expenses: [{ id: 1, concept: "Balones", amount: 120, type: "gasto" }],
      costs: { yellow: 30, doubleYellow: 60, red: 80, other: 120 },
    },
  };

  try {
    await writeCanonicalLeagueStore(store);
    const persisted = await readCanonicalLeagueStore();
    assert.deepEqual(persisted, store);
  } finally {
    if (previousPath === undefined) {
      delete process.env.LEAGUE_STORE_PATH;
    } else {
      process.env.LEAGUE_STORE_PATH = previousPath;
    }
  }
});
