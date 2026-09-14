import { promises as fs } from "fs";
import path from "path";

import { getStorePath, validateLeagueStorePayload, type LeagueStore } from "@/lib/league-store";

export type CanonicalStoreMode = "json" | "supabase";

export function resolveCanonicalStoreMode(): CanonicalStoreMode {
  const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY
    )
  );

  return hasSupabaseConfig ? "supabase" : "json";
}

export async function readCanonicalLeagueStore(): Promise<LeagueStore> {
  const storePath = getStorePath();
  const raw = await fs.readFile(storePath, "utf8").catch(() => JSON.stringify({
    seasons: [],
    teams: [],
    rounds: [],
    matches: [],
    calendar: [],
    sanctions: [],
    finances: {
      fees: {},
      payments: {},
      expenses: [],
      costs: { yellow: 30, doubleYellow: 60, red: 80, other: 120 },
    },
  }));

  const parsed = JSON.parse(raw) as unknown;
  return validateLeagueStorePayload(parsed);
}

export async function writeCanonicalLeagueStore(store: LeagueStore): Promise<LeagueStore> {
  const resolvedStore = validateLeagueStorePayload(store);
  const storePath = getStorePath();
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(resolvedStore, null, 2), "utf8");
  return resolvedStore;
}
