"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { teamColors } from "@/lib/league-data";
import { TeamIdentity } from "@/lib/team-identity";

type LeagueMatch = {
  id: number;
  jornada: string;
  date: string;
  time: string;
  home: string;
  away: string;
  score: string;
  status?: "scheduled" | "finished" | "in-progress" | "cancelled";
  shootoutScore?: string;
  winner?: string;
  stadium: string;
  events: { home: string; away: string };
  goalScorers?: Array<{ player: string; team: string; minute?: number }>;
};

type LeagueRound = {
  id: number;
  title: string;
  date: string;
  status: "completed" | "in-progress" | "upcoming";
  matches: Array<{ time: string; home: string; away: string; stadium?: string; result?: string; }>;
  descansan: string[];
};

type LeagueTeam = {
  name: string;
  primaryColor?: string;
};

export default function JornadasPage() {
  const searchParams = useSearchParams();
  const requestedRound = searchParams.get("jornada");
  const [calendar, setCalendar] = useState<LeagueRound[]>([]);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLeague() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/league", { cache: "no-store" });
        const payload = response.ok ? await response.json() : null;

        if (!active) {
          return;
        }

        if (!payload?.data) {
          throw new Error("No hay resultados de jornada disponibles.");
        }

        setCalendar(Array.isArray(payload.data.calendar) ? payload.data.calendar : []);
        setMatches(Array.isArray(payload.data.matches) ? payload.data.matches : []);
        setTeams(Array.isArray(payload.data.teams) ? payload.data.teams : []);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "No se pudo cargar la jornada.";
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadLeague();

    return () => {
      active = false;
    };
  }, []);

  const visibleRounds = useMemo(() => {
    const roundsByDate = [...calendar].sort((a, b) => a.id - b.id);
    const finalizedRounds = roundsByDate.filter((round) => round.status === "completed");
    const pendingRounds = roundsByDate.filter((round) => round.status !== "completed");
    const currentRound = pendingRounds.find((round) => round.status === "in-progress")
      ?? pendingRounds.find((round) =>
        matches.some((match) => match.jornada === round.title && match.score && match.score !== "-")
      );
    const nextRound = pendingRounds.find((round) => round === currentRound || !matches.some(
      (match) => match.jornada === round.title && match.score && match.score !== "-"
    ));
    const activeOrNextRound = currentRound ?? nextRound;

    return activeOrNextRound
      ? [...finalizedRounds, activeOrNextRound].sort((a, b) => a.id - b.id)
      : finalizedRounds;
  }, [calendar, matches]);

  const orderedRounds = useMemo(
    () => visibleRounds.map((round) => {
      return round;
    }),
    [visibleRounds]
  );

  const [selectedRound, setSelectedRound] = useState<string>("");

  useEffect(() => {
    if (!orderedRounds.length) {
      setSelectedRound("");
      return;
    }
    const nextSelected = orderedRounds.find((round) => round.title === requestedRound)?.title
      ?? orderedRounds.find((round) => round.status === "in-progress")?.title
      ?? orderedRounds.find((round) => round.status === "upcoming")?.title
      ?? orderedRounds[orderedRounds.length - 1].title;
    setSelectedRound((currentValue) => (orderedRounds.some((round) => round.title === currentValue) ? currentValue : nextSelected));
  }, [orderedRounds, requestedRound]);

  const activeMatches = useMemo(() => matches.filter((match) => match.jornada === selectedRound), [matches, selectedRound]);
  const teamColorByName = useMemo(() => Object.fromEntries(teams.map((team) => [team.name, team.primaryColor])), [teams]);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Competiciones</p>
          <h1>Resultados por jornada</h1>
        </div>
        <Link href="/" className="button button-secondary">Volver al inicio</Link>
      </header>

      {loading && <p className="empty-state">Cargando resultados…</p>}
      {error && <p className="empty-state error">{error}</p>}

      {!loading && !error && (
        <section className="content-card">
          {orderedRounds.length > 0 ? (
            <>
              <div className="tabs">
                {orderedRounds.map((round) => (
                  <button key={round.id} type="button" className={`tab ${selectedRound === round.title ? "active" : ""}`} onClick={() => setSelectedRound(round.title)}>
                    {round.title}
                    <span className={`status-pill ${round.status}`}>
                      {round.status === "in-progress" ? "En curso" : round.status === "upcoming" ? "Próxima" : "Finalizada"}
                    </span>
                  </button>
                ))}
              </div>

              <div className="round-summary">
                <strong>{selectedRound}</strong>
                <span>{orderedRounds.find((round) => round.title === selectedRound)?.date ?? "Jornada"}</span>
              </div>

              <div className="match-list">
                {activeMatches.length > 0 ? activeMatches.map((match) => {
                  const hasScore = Boolean(match.score && match.score !== "-");
                  const isFinished = match.status === "finished" || (!match.status && hasScore);
                  const statusLabel = match.status === "in-progress" ? "En curso" : isFinished ? "Finalizado" : "Por disputar";
                  const winner = match.winner ?? (match.score && (() => {
                    const [homeGoals, awayGoals] = match.score.split("-").map((part) => Number(part.trim()));
                    if (homeGoals === awayGoals && match.shootoutScore) {
                      const [homeShootout, awayShootout] = match.shootoutScore.split("-").map((part) => Number(part.trim()));
                      if (homeShootout > awayShootout) return match.home;
                      if (awayShootout > homeShootout) return match.away;
                    }
                    if (homeGoals === awayGoals) return "Empate";
                    return homeGoals > awayGoals ? match.home : match.away;
                  })());
                  const scorerCounts = (team: string) => Object.entries(
                    (match.goalScorers ?? [])
                      .filter((entry) => entry.team === team)
                      .reduce<Record<string, number>>((counts, entry) => {
                        counts[entry.player] = (counts[entry.player] ?? 0) + 1;
                        return counts;
                      }, {})
                  );
                  const homeScorers = scorerCounts(match.home);
                  const awayScorers = scorerCounts(match.away);
                  const homeIsWinner = isFinished && winner === match.home;
                  const awayIsWinner = isFinished && winner === match.away;
                  return (
                    <article key={match.id} className={`match-item ${hasScore ? "match-item-played" : "match-item-upcoming"}`}>
                      <div className="match-meta"><span>{match.jornada}</span><span>{match.time ?? "Horario pendiente"}</span></div>
                      <div className="match-teams">
                        <div className="team-side">
                          <strong className={homeIsWinner ? "team-winner" : undefined} style={homeIsWinner ? { "--team-color": teamColorByName[match.home] || teamColors[match.home]?.primary } as React.CSSProperties : undefined}><TeamIdentity name={match.home} compact /></strong>
                          {homeScorers.length > 0 && (
                            <span className="team-scorers">{homeScorers.map(([player, goals]) => <span key={player} className="scorer-chip">{player}{goals > 1 ? ` ×${goals}` : ""}</span>)}</span>
                          )}
                        </div>
                        <div className="match-score">{hasScore ? <><span>{match.score}</span>{match.shootoutScore && <small className="shootout-score">(Penaltis {match.shootoutScore})</small>}</> : <span className="match-time-badge">{match.time}</span>}</div>
                        <div className="team-side team-side-away">
                          <strong className={awayIsWinner ? "team-winner" : undefined} style={awayIsWinner ? { "--team-color": teamColorByName[match.away] || teamColors[match.away]?.primary } as React.CSSProperties : undefined}><TeamIdentity name={match.away} compact /></strong>
                          {awayScorers.length > 0 && (
                            <span className="team-scorers">{awayScorers.map(([player, goals]) => <span key={player} className="scorer-chip">{player}{goals > 1 ? ` ×${goals}` : ""}</span>)}</span>
                          )}
                        </div>
                      </div>
                      {isFinished && winner && winner !== "Empate" && <div className="shootout-winner">Ganador · {winner}{match.shootoutScore ? " · Penaltis" : ""}</div>}
                      <div className="match-footer"><span>Estadio: {match.stadium}</span><span className={isFinished ? "match-status-finished" : undefined}>{statusLabel}</span></div>
                    </article>
                  );
                }) : <p className="empty-state">No hay partidos para esta jornada.</p>}
              </div>
            </>
          ) : <p className="empty-state">Todavía no hay jornadas disponibles.</p>}
        </section>
      )}
    </main>
  );
}
