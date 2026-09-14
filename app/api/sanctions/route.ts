import { NextResponse } from "next/server";

import { getSupabaseClient, getSupabaseWriteClient, hasSupabaseConfig, hasSupabaseWriteConfig, normalizeSupabaseSanctionRow } from "@/lib/supabase";

export async function GET() {
  const db = getSupabaseClient();

  if (!hasSupabaseConfig || !db) {
    return NextResponse.json({ error: "Supabase no está configurado para leer sanciones." }, { status: 500 });
  }

  const { data, error } = await db
    .from("disciplinary_records")
    .select("id, player, team, card_type, matches, remaining, reason")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: `No se pudieron leer las sanciones de Supabase: ${error.message}` }, { status: 500 });
  }

  const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  return NextResponse.json({ data: rows.map((row) => normalizeSupabaseSanctionRow(row)) });
}

export async function POST(request: Request) {
  const payload = await request.json();

  if (!payload?.player || !payload?.team) {
    return NextResponse.json({ error: "Faltan jugador o equipo" }, { status: 400 });
  }

  const db = getSupabaseWriteClient();

  if (!hasSupabaseWriteConfig || !db) {
    return NextResponse.json({ error: "Supabase no está configurado para escribir sanciones." }, { status: 500 });
  }

  const { data, error } = await db
    .from("disciplinary_records")
    .insert({
      player: payload.player,
      team: payload.team,
      card_type: payload.card ?? "Amarilla",
      matches: payload.matches ?? 1,
      remaining: payload.remaining ?? 1,
      reason: payload.reason ?? "Registrada desde admin",
    })
    .select("id, player, team, card_type, matches, remaining, reason")
    .single();

  if (error) {
    return NextResponse.json({ error: `No se pudo guardar en Supabase: ${error.message}` }, { status: 500 });
  }

  const normalizedRow = data as Record<string, unknown>;
  return NextResponse.json({ data: normalizeSupabaseSanctionRow(normalizedRow) }, { status: 201 });
}
