import { createClient } from "@supabase/supabase-js";

import { getEffectiveAdminToken } from "@/lib/auth";

export function getAdminAccessToken(): string | undefined {
  const candidateKeys = [
    "ADMIN_ACCESS_TOKEN",
    "ADMIN_TOKEN",
    "NEXT_PUBLIC_ADMIN_ACCESS_TOKEN",
  ];

  for (const key of candidateKeys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return getEffectiveAdminToken();
}

export function getRequestAdminToken(request: Request): string {
  const authorizationHeader = request.headers.get("authorization")?.trim() ?? "";
  if (authorizationHeader.toLowerCase().startsWith("bearer ")) {
    const token = authorizationHeader.slice(7).trim();
    if (token.length > 0) {
      return token;
    }
  }

  const xAdminToken = request.headers.get("x-admin-token")?.trim() ?? "";
  if (xAdminToken.length > 0) {
    return xAdminToken;
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)admin_token=([^;]+)/i);
  if (cookieMatch) {
    return decodeURIComponent(cookieMatch[1] ?? "").trim();
  }

  return "";
}

export function buildAdminHeaders(token?: string): Record<string, string> {
  const resolvedToken = (token ?? getAdminAccessToken() ?? "").trim();
  return resolvedToken.length > 0 ? { Authorization: `Bearer ${resolvedToken}` } : {};
}

export function isAdminAuthorized(request: Request): boolean {
  const expectedToken = getAdminAccessToken();
  if (!expectedToken) {
    return false;
  }

  const providedToken = getRequestAdminToken(request);
  return providedToken.length > 0 && providedToken === expectedToken;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publicSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? process.env.SUPABASE_ANON_KEY
  ?? process.env.SUPABASE_PUBLISHABLE_KEY
  ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const hasSupabaseConfig = Boolean(supabaseUrl && (publicSupabaseKey || serviceRoleKey));
export const hasSupabaseWriteConfig = Boolean(supabaseUrl && serviceRoleKey);

const supabaseConfig = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

export const supabase = hasSupabaseConfig && publicSupabaseKey
  ? createClient(supabaseUrl, publicSupabaseKey, supabaseConfig)
  : null;

export const supabaseAdmin = hasSupabaseWriteConfig && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      ...supabaseConfig,
      auth: {
        ...supabaseConfig.auth,
        persistSession: false,
      },
    })
  : null;

export function getSupabaseClient() {
  return supabase;
}

export function getSupabaseWriteClient() {
  return supabaseAdmin;
}

export function normalizeSupabaseMatchRow(row: Record<string, unknown>) {
  return {
    id: typeof row.id === "string" || typeof row.id === "number" ? String(row.id) : Date.now(),
    jornada: typeof row.jornada === "string" ? row.jornada : typeof row.round_title === "string" ? row.round_title : "Jornada 1",
    date: typeof row.date === "string" ? row.date : "2026-09-10",
    time: typeof row.time === "string" ? row.time : "19:00",
    home: typeof row.home === "string" ? row.home : "",
    away: typeof row.away === "string" ? row.away : "",
    score: typeof row.score === "string" ? row.score : "-",
    stadium: typeof row.stadium === "string" ? row.stadium : "Tabira",
    events: {
      home: typeof row.home_events === "string" ? row.home_events : "",
      away: typeof row.away_events === "string" ? row.away_events : "",
    },
    status: typeof row.status === "string" ? row.status : "scheduled",
  };
}

export function normalizeSupabaseRoundRow(row: Record<string, unknown>) {
  return {
    id: typeof row.id === "number" || typeof row.id === "string" ? row.id : Date.now(),
    title: typeof row.title === "string" ? row.title : typeof row.round_title === "string" ? row.round_title : "Jornada",
    date: typeof row.date === "string" ? row.date : "2026-09-10",
    status: typeof row.status === "string" ? row.status : "upcoming",
  };
}

export function normalizeSupabaseTeamRow(row: Record<string, unknown>) {
  const name = typeof row.name === "string" ? row.name : "";
  const shortName = typeof row.short_name === "string" ? row.short_name : name.slice(0, 3).toUpperCase();
  const playersList = Array.isArray((row as { players?: unknown[] }).players)
    ? (row as { players?: unknown[] }).players ?? []
    : [];

  return {
    id: typeof row.id === "string" || typeof row.id === "number" ? String(row.id) : `team-${Date.now()}`,
    name,
    shortName,
    short_name: shortName,
    stadiumName: typeof row.stadium_name === "string" ? row.stadium_name : "Tabira",
    stadium_name: typeof row.stadium_name === "string" ? row.stadium_name : "Tabira",
    players: playersList.map((player: unknown) => {
      if (typeof player === "object" && player !== null) {
        const entry = player as Record<string, unknown>;
        return {
          id: typeof entry.id === "string" || typeof entry.id === "number" ? String(entry.id) : undefined,
          name: typeof entry.name === "string" ? entry.name : "",
          dorsal: typeof entry.dorsal === "number" ? entry.dorsal : Number(entry.dorsal ?? 0),
          isGoalkeeper: entry.is_goalkeeper === true || entry.isGoalkeeper === true,
        };
      }
      return { name: String(player), dorsal: 0, isGoalkeeper: false };
    }),
  };
}

export function normalizeSupabasePlayerRow(row: Record<string, unknown>) {
  const teamRelation = typeof row.teams === "object" && row.teams !== null ? (row.teams as Record<string, unknown>) : null;
  const teamName = teamRelation && typeof teamRelation.name === "string"
    ? teamRelation.name
    : typeof row.team === "string"
      ? row.team
      : "";

  return {
    id: typeof row.id === "string" || typeof row.id === "number" ? String(row.id) : undefined,
    name: typeof row.name === "string" ? row.name : "",
    dorsal: typeof row.dorsal === "number" ? row.dorsal : Number(row.dorsal ?? 0),
    isGoalkeeper: row.is_goalkeeper === true || row.isGoalkeeper === true,
    team: teamName,
    team_id: typeof row.team_id === "string" || typeof row.team_id === "number" ? String(row.team_id) : undefined,
  };
}

export function normalizeSupabaseSanctionRow(row: Record<string, unknown>) {
  return {
    id: typeof row.id === "string" || typeof row.id === "number" ? String(row.id) : Date.now(),
    player: typeof row.player === "string" ? row.player : "",
    team: typeof row.team === "string" ? row.team : "",
    card: typeof row.card_type === "string" ? row.card_type : "Amarilla",
    card_type: typeof row.card_type === "string" ? row.card_type : "Amarilla",
    matches: typeof row.matches === "number" ? row.matches : 1,
    remaining: typeof row.remaining === "number" ? row.remaining : 1,
    reason: typeof row.reason === "string" ? row.reason : "Registrada desde admin",
    costAmount: typeof row.cost_amount === "number" ? row.cost_amount : 0,
    cost_amount: typeof row.cost_amount === "number" ? row.cost_amount : 0,
  };
}
