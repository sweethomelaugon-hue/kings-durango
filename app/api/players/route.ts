import { NextResponse } from "next/server";

import { getSupabaseClient, getSupabaseWriteClient, hasSupabaseConfig, hasSupabaseWriteConfig, normalizeSupabasePlayerRow } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const team = searchParams.get("team") ?? "";
  const db = getSupabaseClient();

  if (!hasSupabaseConfig || !db) {
    return NextResponse.json({ error: "Supabase no está configurado para leer jugadores." }, { status: 500 });
  }

  const { data, error } = await db
    .from("players")
    .select("name, dorsal, team_id, is_goalkeeper, teams(name)")
    .order("name");

  if (error) {
    return NextResponse.json({ error: `No se pudieron leer los jugadores de Supabase: ${error.message}` }, { status: 500 });
  }

  const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  const normalizedRows = rows.map((row) => normalizeSupabasePlayerRow(row));

  if (!team) {
    return NextResponse.json({ data: normalizedRows });
  }

  const filtered = normalizedRows.filter((row) => row.team.toLowerCase() === team.toLowerCase());
  return NextResponse.json({ data: filtered });
}

export async function POST(request: Request) {
  const payload = await request.json();

  if (!payload?.teamId || !payload?.name) {
    return NextResponse.json({ error: "Faltan teamId o nombre del jugador" }, { status: 400 });
  }

  const db = getSupabaseWriteClient();

  if (!hasSupabaseWriteConfig || !db) {
    return NextResponse.json({ error: "Supabase no está configurado para escribir jugadores." }, { status: 500 });
  }

  const playerRow = {
    id: payload.id,
    team_id: payload.teamId,
    name: payload.name,
    dorsal: payload.dorsal ?? 0,
    is_goalkeeper: Boolean(payload.isGoalkeeper ?? payload.is_goalkeeper ?? false),
  };

  const { data, error } = await db
    .from("players")
    .upsert(playerRow, { onConflict: "id" })
    .select("id, name, dorsal, team_id, is_goalkeeper, teams(name)")
    .single();

  if (error) {
    return NextResponse.json({ error: `No se pudo guardar en Supabase: ${error.message}` }, { status: 500 });
  }

  const normalizedRow = data as Record<string, unknown>;
  return NextResponse.json({ data: normalizeSupabasePlayerRow(normalizedRow) }, { status: 201 });
}
