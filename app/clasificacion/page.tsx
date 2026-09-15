"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getTeamPalette } from "@/lib/league-data";
import { TeamIdentity } from "@/lib/team-identity";

type TeamRow = {
  id?: string;
  name: string;
  shortName?: string;
  primaryColor?: string;
  players: Array<{ name: string; dorsal?: number | string; isGoalkeeper?: boolean }>;
};

type MatchRow = {
  id: number;
  home: string;
  away: string;
  score: string;
  shootoutScore?: string;
  jornada?: string;
};

type CalendarRow = { id: number; title: string; status: "completed" | "in-progress" | "upcoming" };

type StandingRow = {
  team: string;
  played: number;
  wins: number;
  eg: number;
  ep: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string[];
  position?: number;
};

function buildStandings(teams: TeamRow[], matches: MatchRow[]): StandingRow[] {
  const table = teams.map((team) => ({
    team: team.name,
    played: 0,
    wins: 0,
    eg: 0,
    ep: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: [] as string[],
  }));

  matches.filter((match) => match.score && match.score !== "-").forEach((match) => {
    const [homeGoals, awayGoals] = match.score.split("-").map((value: string) => Number(value.trim()) || 0);
    const home = table.find((team) => team.team === match.home);
    const away = table.find((team) => team.team === match.away);
    if (!home || !away) return;

    home.played += 1;
    away.played += 1;
    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;
    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;

    if (homeGoals > awayGoals) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
      home.form.push("G");
      away.form.push("P");
    } else if (awayGoals > homeGoals) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
      home.form.push("P");
      away.form.push("G");
    } else {
      const shootout = match.shootoutScore?.split("-").map((value) => Number(value.trim())) ?? [];
      const homeWonShootout = shootout.length === 2 && shootout[0] !== shootout[1] ? shootout[0] > shootout[1] : true;
      if (homeWonShootout) {
        home.eg += 1;
        away.ep += 1;
        home.points += 2;
        away.points += 1;
        home.form.push("EG");
        away.form.push("EP");
      } else {
        away.eg += 1;
        home.ep += 1;
        away.points += 2;
        home.points += 1;
        home.form.push("EP");
        away.form.push("EG");
      }
    }
  });

  return table
    .map((team) => ({
      ...team,
      goalDifference: team.goalsFor - team.goalsAgainst,
      form: team.form.slice(-5),
    }))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team))
    .map((team, index) => ({ ...team, position: index + 1 }));
}

export default function ClasificacionPage() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [calendar, setCalendar] = useState<CalendarRow[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
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
          throw new Error("No se pudo cargar la clasificación.");
        }

        const nextTeams = Array.isArray(payload.data.teams) ? payload.data.teams : [];
        const nextMatches = Array.isArray(payload.data.matches) ? payload.data.matches : [];
        const nextStandings = Array.isArray(payload.data.standings) && payload.data.standings.length > 0
          ? payload.data.standings
          : buildStandings(nextTeams, nextMatches);

        setTeams(nextTeams);
        setMatches(nextMatches);
        setCalendar(Array.isArray(payload.data.calendar) ? payload.data.calendar : []);
        setStandings(nextStandings);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Error cargando la clasificación.";
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

  const resolvedStandings = useMemo(() => standings.length > 0 ? standings : buildStandings(teams, matches), [matches, standings, teams]);
  const positionChanges = useMemo(() => {
    const lastCompletedRound = [...calendar].filter((round) => round.status === "completed").sort((a, b) => b.id - a.id)[0];
    if (!lastCompletedRound) {
      return new Map<string, number>();
    }

    const previousMatches = matches.filter((match) => match.jornada !== lastCompletedRound.title);
    if (!previousMatches.some((match) => match.score && match.score !== "-")) {
      return new Map<string, number>();
    }

    const previousStandings = buildStandings(teams, previousMatches);
    const previousPositions = new Map(previousStandings.map((team, index) => [team.team, team.position ?? index + 1]));
    return new Map(resolvedStandings.map((team, index) => [team.team, (previousPositions.get(team.team) ?? index + 1) - (team.position ?? index + 1)]));
  }, [calendar, matches, resolvedStandings, teams]);
  const teamRoster = useMemo(() => Object.fromEntries(teams.map((team) => [team.name, team.players])), [teams]);
  const selectedRoster = selectedTeam ? teamRoster[selectedTeam] ?? [] : [];

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tabla</p>
          <h1>Clasificación</h1>
        </div>
        <Link href="/" className="button button-secondary">Volver al inicio</Link>
      </header>

      {loading && <p className="empty-state">Cargando clasificación…</p>}
      {error && <p className="empty-state error">{error}</p>}

      {!loading && !error && (
        <>
          <section className="content-card table-wrap">
            {resolvedStandings.length > 0 ? (
              <table className="league-table standings-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Equipo</th>
                    <th>PJ</th>
                    <th>G</th>
                    <th>EG</th>
                    <th>EP</th>
                    <th>P</th>
                    <th>GF</th>
                    <th>GC</th>
                    <th>DG</th>
                    <th>Pts</th>
                    <th>Últimos 5</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedStandings.map((team) => {
                    const palette = getTeamPalette(team.team, teams.find((candidate) => candidate.name === team.team)?.primaryColor);
                    const configuredColor = palette.primary;
                    return (
                      <tr key={team.team}>
                        <td><span className="position-with-change"><span className="position-number">{team.position}</span><span className={`trend-badge ${positionChanges.get(team.team) ? (positionChanges.get(team.team)! > 0 ? "up" : "down") : "neutral"}`} aria-label={positionChanges.get(team.team) ? (positionChanges.get(team.team)! > 0 ? "Sube posiciones" : "Baja posiciones") : "Sin cambios"}>{positionChanges.get(team.team) ? (positionChanges.get(team.team)! > 0 ? "↑" : "↓") : "•"}</span></span></td>
                        <td className="team-name-cell">
                          <button type="button" className="team-cell team-detail-trigger" style={{ "--team-color": configuredColor, color: "#edf3f1" } as React.CSSProperties} onClick={() => setSelectedTeam(team.team)}>
                            <TeamIdentity name={team.team} className="team-name-label" compact />
                          </button>
                        </td>
                        <td>{team.played}</td>
                        <td>{team.wins}</td>
                        <td>{team.eg}</td>
                        <td>{team.ep}</td>
                        <td>{team.losses}</td>
                        <td>{team.goalsFor}</td>
                        <td>{team.goalsAgainst}</td>
                        <td>{team.goalDifference}</td>
                        <td><strong className="points-pill">{team.points}</strong></td>
                        <td><div className="form-box">{team.form.map((result: string, index: number) => <span key={`${team.team}-${index}`} className={`badge badge-${result.toLowerCase()}`}>{result}</span>)}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="empty-state">Todavía no hay resultados para generar la clasificación.</p>
            )}
          </section>

          {selectedTeam && (
            <div className="team-modal-backdrop" onClick={() => setSelectedTeam(null)}>
              <div className="team-modal" onClick={(event) => event.stopPropagation()}>
                <div className="team-modal-header">
                  <div><p className="eyebrow">Plantilla</p><h2>{selectedTeam}</h2></div>
                  <button type="button" className="team-modal-close" onClick={() => setSelectedTeam(null)} aria-label="Cerrar información del equipo">×</button>
                </div>
                <div className="team-modal-body">
                  {selectedRoster.length > 0 ? selectedRoster.map((player) => <div key={`${selectedTeam}-${player.name}`} className="team-player-row"><span className="player-dorsal">{player.dorsal}</span><span className="team-player-name">{player.name}{player.isGoalkeeper ? <span className="goalkeeper-mark" title="Portero" aria-label="Portero">🧤</span> : null}</span></div>) : <p className="team-empty-state">No hay jugadores disponibles.</p>}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
