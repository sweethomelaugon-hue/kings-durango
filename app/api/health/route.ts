import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "liga-pueblo-api",
    hasSupabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  });
}
