import { NextResponse } from "next/server";

import { isLeagueInformationSection } from "@/lib/league-information";
import { getSupabaseClient, getSupabaseWriteClient, hasSupabaseConfig, hasSupabaseWriteConfig, isAdminAuthorized } from "@/lib/supabase";

export async function GET() {
  const client = getSupabaseClient();
  if (!hasSupabaseConfig || !client) {
    return NextResponse.json({ error: "La información de la liga no está disponible." }, { status: 503 });
  }

  const { data: activeSeason, error: seasonError } = await client
    .from("seasons")
    .select("id")
    .eq("is_active", true)
    .order("year_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (seasonError) {
    return NextResponse.json({ error: "No se pudo cargar la temporada activa." }, { status: 500 });
  }

  if (!activeSeason) {
    return NextResponse.json({ seasonId: null, data: [] });
  }

  const { data, error } = await client
    .from("league_section_information")
    .select("section_key, title, content")
    .eq("season_id", activeSeason.id);

  if (error) {
    return NextResponse.json({ error: "No se pudo cargar la información. Comprueba que se haya aplicado la migración de información de la liga." }, { status: 503 });
  }

  return NextResponse.json({
    seasonId: activeSeason.id,
    data: (data ?? []).map((row) => ({
      sectionKey: row.section_key,
      title: row.title,
      content: row.content,
    })),
  });
}

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado. Debes proporcionar un token de administración válido." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const sectionKey = payload?.sectionKey;
  const seasonId = typeof payload?.seasonId === "string" ? payload.seasonId.trim() : "";
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  const content = typeof payload?.content === "string" ? payload.content.trim() : "";

  if (!isLeagueInformationSection(sectionKey) || !seasonId || !title || title.length > 120 || content.length > 12000) {
    return NextResponse.json({ error: "Revisa el apartado, el título y el contenido (máximo 12.000 caracteres)." }, { status: 400 });
  }

  const client = getSupabaseWriteClient();
  if (!hasSupabaseWriteConfig || !client) {
    return NextResponse.json({ error: "Supabase no está configurado para guardar esta información." }, { status: 503 });
  }

  const { data: season, error: seasonError } = await client
    .from("seasons")
    .select("id")
    .eq("id", seasonId)
    .eq("is_active", true)
    .maybeSingle();

  if (seasonError || !season) {
    return NextResponse.json({ error: "La temporada seleccionada no está activa." }, { status: 400 });
  }

  const { data, error } = await client
    .from("league_section_information")
    .upsert({ season_id: seasonId, section_key: sectionKey, title, content }, { onConflict: "season_id,section_key" })
    .select("section_key, title, content")
    .single();

  if (error) {
    return NextResponse.json({ error: "No se pudo guardar. Comprueba que se haya aplicado la migración de información de la liga." }, { status: 503 });
  }

  return NextResponse.json({
    data: {
      sectionKey: data.section_key,
      title: data.title,
      content: data.content,
    },
  });
}