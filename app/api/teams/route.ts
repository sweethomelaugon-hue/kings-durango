import { NextResponse } from "next/server";

import { getSupabaseClient, getSupabaseWriteClient, hasSupabaseConfig, hasSupabaseWriteConfig, normalizeSupabaseTeamRow } from "@/lib/supabase";

export async function GET() {
  const db = getSupabaseClient();

  if (!hasSupabaseConfig || !db) {
    return NextResponse.json({ error: "Supabase no está configurado para leer equipos." }, { status: 500 });
  }

  const { data, error } = await db
    .from("teams")
    .select("id, name, short_name, players:players(id, name, dorsal, is_goalkeeper)")
    .order("name");

  if (error) {
    return NextResponse.json({ error: `No se pudieron leer los equipos de Supabase: ${error.message}` }, { status: 500 });
  }

  const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  return NextResponse.json({ data: rows.map((row) => normalizeSupabaseTeamRow(row)) });
}

export async function POST(request: Request) {
  const payload = await request.json();

  if (!payload?.name) {
    return NextResponse.json({ error: "Falta el nombre del equipo" }, { status: 400 });
  }

  const db = getSupabaseWriteClient();

  if (!hasSupabaseWriteConfig || !db) {
    return NextResponse.json({ error: "Supabase no está configurado para escribir equipos." }, { status: 500 });
  }

  const { data, error } = await db
    .from("teams")
    .insert({
      name: payload.name,
      short_name: payload.shortName ?? payload.name.slice(0, 3).toUpperCase(),
      stadium_name: payload.stadiumName ?? "Tabira",
    })
    .select("id, name, short_name")
    .single();

  if (error) {
    return NextResponse.json({ error: `No se pudo guardar en Supabase: ${error.message}` }, { status: 500 });
  }

  const normalizedRow = data as Record<string, unknown>;
  return NextResponse.json({ data: normalizeSupabaseTeamRow(normalizedRow) }, { status: 201 });
}
