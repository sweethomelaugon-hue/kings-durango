import { NextResponse } from "next/server";

import { registerIosPushToken } from "@/lib/ios-push";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { token?: unknown };
    const token = typeof payload.token === "string" ? payload.token.trim() : "";
    if (!/^[a-f0-9]{32,256}$/i.test(token)) {
      return NextResponse.json({ error: "Token iOS no válido." }, { status: 400 });
    }

    await registerIosPushToken(token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar el dispositivo iOS.";
    console.error("iOS push registration failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
