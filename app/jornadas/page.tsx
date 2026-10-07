"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { teamColors } from "@/lib/league-data";
import { TeamIdentity } from "@/lib/team-identity";
import { LeagueInformationButton } from "@/components/LeagueInformationButton";
import { phaseTwoRounds } from "@/lib/phase-two-calendar";

const phaseTwoStartDate = phaseTwoRounds[0]?.date ?? "2027-02-21";

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

type LeagueStanding = { team: string; position?: number };

function JornadasContent() {
  const searchParams = useSearchParams();
  const requestedRound = searchParams.get("jornada");
  const [calendar, setCalendar] = useState<LeagueRound[]>([]);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [phaseOneStandings, setPhaseOneStandings] = useState<LeagueStanding[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<"fase1" | "fase2">("fase1");
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
        setPhaseOneStandings(Array.isArray(payload.data.phaseStandings?.phase1) ? payload.data.phaseStandings.phase1 : []);
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

  const phaseTwoDisplayRounds = useMemo(() => {
    const registeredRounds = calendar.filter((round) => round.date >= phaseTwoStartDate);
    const teamAtPosition = new Map(phaseOneStandings.map((entry, index) => [entry.position ?? index + 1, entry.team]));
    const plannedRounds = phaseTwoRounds.map((round, roundIndex) => {
      const registeredRound = registeredRounds.find((candidate) => candidate.date === round.date)
        ?? registeredRounds.find((candidate) => candidate.title === round.title);
      if (registeredRound) {
        return registeredRound;
      }

      const fixtures = round.fixtures.map((fixture) => ({
        time: fixture.time,
        home: teamAtPosition.get(fixture.homePosition) ?? `Equipo ${fixture.homePosition}`,
        away: teamAtPosition.get(fixture.awayPosition) ?? `Equipo ${fixture.awayPosition}`,
      }));
      const roundMatches = matches.filter((match) => match.date === round.date);
      const findFixtureMatch = (fixture: (typeof fixtures)[number]) => roundMatches.find((match) =>
        match.home === fixture.home && match.away === fixture.away
      );
      const allFixturesFinished = fixtures.length > 0 && fixtures.every((fixture) => {
        const match = findFixtureMatch(fixture);
        return Boolean(match && (match.status === "finished" || (!match.status && match.score !== "-")));
      });
      const anyFixtureInProgress = fixtures.some((fixture) => findFixtureMatch(fixture)?.status === "in-progress");
      const usedTeams = new Set(fixtures.flatMap((fixture) => [fixture.home, fixture.away]));

      return {
        id: -(roundIndex + 1),
        title: round.title,
        date: round.date,
        status: allFixturesFinished ? "completed" as const : anyFixtureInProgress ? "in-progress" as const : "upcoming" as const,
        matches: fixtures,
        descansan: teams.map((team) => team.name).filter((teamName) => !usedTeams.has(teamName)),
      };
    });
    const registeredIds = new Set(plannedRounds
      .filter((round) => registeredRounds.some((registered) => registered.id === round.id))
      .map((round) => round.id));
    const extraRegisteredRounds = registeredRounds.filter((round) => !registeredIds.has(round.id));

    return [...plannedRounds, ...extraRegisteredRounds].sort((first, second) => first.date.localeCompare(second.date));
  }, [calendar, matches, phaseOneStandings, teams]);

  const phaseRounds = selectedPhase === "fase1"
    ? calendar.filter((round) => round.date < phaseTwoStartDate)
    : phaseTwoDisplayRounds;

  const visibleRounds = useMemo(() => {
    const roundsByDate = [...phaseRounds].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    const hasRoundResults = (round: LeagueRound) => round.matches.some((fixture) => matches.some((match) =>
      match.date === round.date && match.home === fixture.home && match.away === fixture.away && match.score && match.score !== "-"
    ));
    const finalizedRounds = roundsByDate.filter((round) => round.status === "completed");
    const pendingRounds = roundsByDate.filter((round) => round.status !== "completed");
    const currentRound = pendingRounds.find((round) => round.status === "in-progress")
      ?? pendingRounds.find(hasRoundResults);
    const nextRound = pendingRounds.find((round) => round === currentRound || !hasRoundResults(round));
    const activeOrNextRound = currentRound ?? nextRound;

    return activeOrNextRound
      ? [...finalizedRounds, activeOrNextRound].sort((a, b) => a.id - b.id)
      : finalizedRounds;
  }, [matches, phaseRounds]);

  const orderedRounds = useMemo(
    () => visibleRounds.map((round) => {
      return round;
    }),
    [visibleRounds]
  );

  const [selectedRound, setSelectedRound] = useState<string>("");
  const selectedRoundTitle = orderedRounds.some((round) => round.title === selectedRound)
    ? selectedRound
    : orderedRounds.find((round) => round.title === requestedRound)?.title
      ?? orderedRounds.find((round) => round.status === "in-progress")?.title
      ?? orderedRounds.find((round) => round.status === "upcoming")?.title
      ?? orderedRounds[orderedRounds.length - 1]?.title
      ?? "";
  const selectedRoundData = orderedRounds.find((round) => round.title === selectedRoundTitle);
  const activeMatches = useMemo(() => selectedRoundData
    ? matches.filter((match) => match.date === selectedRoundData.date && selectedRoundData.matches.some((fixture) =>
      fixture.home === match.home && fixture.away === match.away
    ))
    : [], [matches, selectedRoundData]);
  const teamColorByName = useMemo(() => Object.fromEntries(teams.map((team) => [team.name, team.primaryColor])), [teams]);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Competiciones</p>
          <h1>Resultados por jornada</h1>
        </div>
        <div className="page-header-actions">
          <LeagueInformationButton section="jornadas" />
          <Link href="/" className="button button-secondary">Volver al inicio</Link>
        </div>
      </header>

      {loading && <p className="empty-state">Cargando resultados…</p>}
      {error && <p className="empty-state error">{error}</p>}

      {!loading && !error && (
        <>
        <div className="calendar-phase-switch" role="tablist" aria-label="Fase de resultados">
          <button type="button" role="tab" aria-selected={selectedPhase === "fase1"} className={`calendar-phase-tab ${selectedPhase === "fase1" ? "active" : ""}`} onClick={() => setSelectedPhase("fase1")}>Fase 1</button>
          <button type="button" role="tab" aria-selected={selectedPhase === "fase2"} className={`calendar-phase-tab ${selectedPhase === "fase2" ? "active" : ""}`} onClick={() => setSelectedPhase("fase2")}>Fase 2</button>
        </div>
        <section className="content-card">
          {orderedRounds.length > 0 ? (
            <>
              <div className="tabs">
                {orderedRounds.map((round) => (
                  <button key={round.id} type="button" className={`tab ${selectedRoundTitle === round.title ? "active" : ""}`} onClick={() => setSelectedRound(round.title)}>
                    {round.title}
                    <span className={`status-pill ${round.status}`}>
                      {round.status === "in-progress" ? "En curso" : round.status === "upcoming" ? "Próxima" : "Finalizada"}
                    </span>
                  </button>
                ))}
              </div>

              <div className="round-summary">
                <strong>{selectedRoundTitle}</strong>
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
                        <div className="match-score">{hasScore ? <><span>{match.score}</span>{match.shootoutScore && <small className="shootout-score">({match.shootoutScore.replace(/\s+/g, "")})</small>}</> : <span className="match-time-badge">{match.time}</span>}</div>
                        <div className="team-side team-side-away">
                          <strong className={awayIsWinner ? "team-winner" : undefined} style={awayIsWinner ? { "--team-color": teamColorByName[match.away] || teamColors[match.away]?.primary } as React.CSSProperties : undefined}><TeamIdentity name={match.away} compact /></strong>
                          {awayScorers.length > 0 && (
                            <span className="team-scorers">{awayScorers.map(([player, goals]) => <span key={player} className="scorer-chip">{player}{goals > 1 ? ` ×${goals}` : ""}</span>)}</span>
                          )}
                        </div>
                      </div>
                      {isFinished && winner && winner !== "Empate" && <div className="shootout-winner" style={{ "--team-color": teamColorByName[winner] || teamColors[winner]?.primary } as React.CSSProperties}>Ganador · {winner}{match.shootoutScore ? " · Penaltis" : ""}</div>}
                      <div className="match-footer"><span>Estadio: {match.stadium}</span><span className={isFinished ? "match-status-finished" : undefined}>{statusLabel}</span></div>
                    </article>
                  );
                }) : <p className="empty-state">No hay partidos para esta jornada.</p>}
              </div>
            </>
          ) : <p className="empty-state">{selectedPhase === "fase2" ? "Todavía no hay jornadas de Fase 2 registradas." : "Todavía no hay jornadas disponibles."}</p>}
        </section>
        </>
      )}
    </main>
  );
}

export default function JornadasPage() {
  return (
    <Suspense fallback={<main className="page-shell"><p className="empty-state">Cargando resultados…</p></main>}>
      <JornadasContent />
    </Suspense>
  );
}
