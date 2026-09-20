import crypto from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase";

type MatchLike = {
  id?: string | number;
  home?: string;
  away?: string;
  score?: string;
  jornada?: string;
};

type PushTokenRow = {
  token: string;
};

const bundleId = process.env.IOS_APP_BUNDLE_ID ?? "com.kingsdurango.app";
const apnsEnvironment = process.env.APNS_ENVIRONMENT === "sandbox" ? "sandbox" : "production";

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function getApnsJwt(): string | null {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const rawPrivateKey = process.env.APNS_PRIVATE_KEY?.trim();
  if (!keyId || !teamId || !rawPrivateKey) {
    return null;
  }

  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = base64Url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const signer = crypto.createSign("SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer.sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${base64Url(signature)}`;
}

function parseScore(score: string | undefined): [number, number] | null {
  if (!score || score.trim() === "-") {
    return null;
  }

  const parts = score.split("-").map((part) => Number.parseInt(part.trim(), 10));
  return parts.length === 2 && parts.every(Number.isFinite) ? [parts[0], parts[1]] : null;
}

function scoreChange(previous: MatchLike | undefined, next: MatchLike): { homeGoals: number; awayGoals: number } | null {
  const before = parseScore(previous?.score);
  const after = parseScore(next.score);
  if (!after) {
    return null;
  }

  const previousHome = before?.[0] ?? 0;
  const previousAway = before?.[1] ?? 0;
  const homeGoals = after[0] - previousHome;
  const awayGoals = after[1] - previousAway;
  return homeGoals > 0 || awayGoals > 0 ? { homeGoals, awayGoals } : null;
}

async function sendApnsAlert(token: string, title: string, body: string): Promise<void> {
  const jwt = getApnsJwt();
  if (!jwt) {
    return;
  }

  const host = apnsEnvironment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const response = await fetch(`https://${host}/3/device/${token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title, body },
        sound: "default",
      },
      kind: "match-score-update",
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`APNs respondió ${response.status}: ${message}`);
  }
}

export async function registerIosPushToken(token: string): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error("Supabase no está configurado para registrar dispositivos iOS.");
  }

  const { error } = await supabaseAdmin.from("ios_push_tokens").upsert({
    token,
    platform: "ios",
    bundle_id: bundleId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "token" });
  if (error) {
    throw new Error(`No se pudo registrar el dispositivo iOS: ${error.message}`);
  }
}

export async function notifyMatchScoreChanges(previousMatches: MatchLike[], nextMatches: MatchLike[]): Promise<void> {
  if (!supabaseAdmin || !getApnsJwt()) {
    return;
  }

  const { data, error } = await supabaseAdmin.from("ios_push_tokens").select("token");
  if (error) {
    console.error("No se pudieron cargar los dispositivos iOS", error);
    return;
  }

  const tokens = (data ?? []) as PushTokenRow[];
  const previousById = new Map(previousMatches.map((match) => [String(match.id), match]));
  const changes = nextMatches
    .map((match) => ({ match, change: scoreChange(previousById.get(String(match.id)), match) }))
    .filter((entry): entry is { match: MatchLike; change: { homeGoals: number; awayGoals: number } } => Boolean(entry.change));

  for (const { match, change } of changes) {
    const scorer = change.homeGoals > 0 ? match.home ?? "Local" : match.away ?? "Visitante";
    const score = match.score ?? "";
    const body = `${scorer} ha marcado. ${match.home ?? "Local"} ${score} ${match.away ?? "Visitante"}`;
    await Promise.allSettled(tokens.map(({ token }) => sendApnsAlert(token, `${match.jornada ?? "Partido"} · Gol`, body)));
  }
}
