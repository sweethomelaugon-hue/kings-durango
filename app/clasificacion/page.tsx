"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getTeamPalette } from "@/lib/league-data";
import { TeamIdentity } from "@/lib/team-identity";
import { getPlayerGoalSummary } from "@/lib/player-goal-balls";

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
  goalScorers?: Array<{ player: string; team: string }>;
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

function sortPlayersByDorsal<T extends { name: string; dorsal?: number | string }>(players: T[]) {
  return [...players].sort((a, b) => {
    const dorsalA = String(a.dorsal ?? "").trim();
    const dorsalB = String(b.dorsal ?? "").trim();
    const numberA = Number(dorsalA);
    const numberB = Number(dorsalB);
    const hasDorsalA = dorsalA !== "" && Number.isFinite(numberA);
    const hasDorsalB = dorsalB !== "" && Number.isFinite(numberB);
    if (hasDorsalA && hasDorsalB && numberA !== numberB) return numberA - numberB;
    if (hasDorsalA !== hasDorsalB) return hasDorsalA ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

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
  const [isMobileHeaderFixed, setIsMobileHeaderFixed] = useState(false);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [calendar, setCalendar] = useState<CalendarRow[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mobileHeaderRef = useRef<HTMLDivElement>(null);
  const mobileHeaderTopRef = useRef<number | null>(null);
  const mobileHeaderMetricsRef = useRef({ left: 0, width: 0, top: 0 });

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

  useEffect(() => {
    const updateMobileHeader = () => {
      const header = mobileHeaderRef.current;
      if (!header || window.innerWidth > 640) {
        return;
      }

      if (mobileHeaderTopRef.current === null || !isMobileHeaderFixed) {
        const bounds = header.getBoundingClientRect();
        const panel = header.closest<HTMLElement>(".table-wrap");
        const panelBounds = panel?.getBoundingClientRect();
        mobileHeaderTopRef.current = bounds.top + window.scrollY;
        const topbar = document.querySelector<HTMLElement>(".topbar");
        mobileHeaderMetricsRef.current = {
          left: panelBounds?.left ?? bounds.left,
          width: panelBounds?.width ?? bounds.width,
          top: topbar?.getBoundingClientRect().bottom ?? 0,
        };
      }

      const shouldFix = window.scrollY > (mobileHeaderTopRef.current ?? 0);
      if (shouldFix !== isMobileHeaderFixed) {
        setIsMobileHeaderFixed(shouldFix);
      }
    };

    updateMobileHeader();
    window.addEventListener("scroll", updateMobileHeader, { passive: true });
    window.addEventListener("resize", updateMobileHeader);
    return () => {
      window.removeEventListener("scroll", updateMobileHeader);
      window.removeEventListener("resize", updateMobileHeader);
    };
  }, [isMobileHeaderFixed]);

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
  const selectedRoster = selectedTeam ? sortPlayersByDorsal(teamRoster[selectedTeam] ?? []) : [];

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
              <>
                <div
                  ref={mobileHeaderRef}
                  className={`standings-mobile-sticky-header ${isMobileHeaderFixed ? "is-fixed" : ""}`}
                  style={isMobileHeaderFixed ? {
                    left: mobileHeaderMetricsRef.current.left,
                    width: mobileHeaderMetricsRef.current.width,
                    top: mobileHeaderMetricsRef.current.top,
                  } : undefined}
                  aria-hidden="true"
                >
                  <span>Equipo</span><span>PJ</span><span>V</span><span>EV</span><span>ED</span><span>D</span><span>DG</span><strong>PTS</strong>
                </div>
                {isMobileHeaderFixed ? <div className="standings-mobile-header-spacer" aria-hidden="true" /> : null}
                <table className="league-table standings-table">
                <thead>
                  <tr>
                    <th><span className="desktop-column-heading">Pos</span></th>
                    <th>Equipo</th>
                    <th>PJ</th>
                    <th><span className="desktop-column-heading">G</span><span className="mobile-column-heading">V</span></th>
                    <th><span className="desktop-column-heading">EG</span><span className="mobile-column-heading">EV</span></th>
                    <th><span className="desktop-column-heading">EP</span><span className="mobile-column-heading">ED</span></th>
                    <th><span className="desktop-column-heading">P</span><span className="mobile-column-heading">D</span></th>
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
                    const isLeagueDivider = team.position === 7;

                    return (
                      <tr
                        key={team.team}
                        className={`team-row-clickable ${team.position && team.position <= 6 ? "group-champions" : "group-hoyo"} ${isLeagueDivider ? "league-divider-row" : ""}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Ver jugadores de ${team.team}`}
                        onClick={() => setSelectedTeam(team.team)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedTeam(team.team);
                          }
                        }}
                      >
                        <td data-label="Pos"><span className="position-with-change"><span className="position-number">{team.position}</span><span className={`trend-badge ${positionChanges.get(team.team) ? (positionChanges.get(team.team)! > 0 ? "up" : "down") : "neutral"}`} aria-label={positionChanges.get(team.team) ? (positionChanges.get(team.team)! > 0 ? "Sube posiciones" : "Baja posiciones") : "Sin cambios"}>{positionChanges.get(team.team) ? (positionChanges.get(team.team)! > 0 ? "↑" : "↓") : "•"}</span></span></td>
                        <td className="team-name-cell" data-label="Equipo">
                          <div className="team-cell team-detail-trigger" style={{ "--team-color": configuredColor, color: "#edf3f1" } as React.CSSProperties}>
                            <TeamIdentity name={team.team} className="team-name-label" compact />
                          </div>
                          <span className="mobile-team-name">{team.team}</span>
                        </td>
                        <td className="mobile-standing-stat" data-label="PJ">{team.played}</td>
                        <td className="mobile-standing-stat" data-label="V">{team.wins}</td>
                        <td className="mobile-standing-stat" data-label="EV">{team.eg}</td>
                        <td className="mobile-standing-stat" data-label="ED">{team.ep}</td>
                        <td className="mobile-standing-stat" data-label="D">{team.losses}</td>
                        <td className="mobile-standing-stat" data-label="DG">{team.goalDifference > 0 ? `+${team.goalDifference}` : String(team.goalDifference)}</td>
                        <td className="mobile-standing-stat mobile-standing-points" data-label="PTS">{team.points}</td>
                        <td data-label="PJ">{team.played}</td>
                        <td data-label="G">{team.wins}</td>
                        <td data-label="EG">{team.eg + team.ep}</td>
                        <td data-label="EP">{team.ep}</td>
                        <td data-label="P">{team.losses}</td>
                        <td data-label="GF">{team.goalsFor}</td>
                        <td data-label="GC">{team.goalsAgainst}</td>
                        <td data-label="DG">{team.goalDifference}</td>
                        <td data-label="Pts"><strong className="points-pill">{team.points}</strong></td>
                        <td data-label="Últimos 5"><div className="form-box">{team.form.map((result: string, index: number) => <span key={`${team.team}-${index}`} className={`badge badge-${result.toLowerCase()}`}>{result}</span>)}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </>
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
                  {selectedRoster.length > 0 ? selectedRoster.map((player) => {
                    const goalSummary = getPlayerGoalSummary(matches, selectedTeam ?? "", player.name);
                    return <div key={`${selectedTeam}-${player.name}`} className="team-player-row"><span className="player-dorsal">{player.dorsal}</span><span className="team-player-name">{player.name}{player.isGoalkeeper ? <span className="goalkeeper-mark" title="Portero" aria-label="Portero">🧤</span> : null}{goalSummary.goals > 0 ? <span className="goal-ranking" aria-label={`${goalSummary.rank ? `Puesto ${goalSummary.rank}, ` : ""}${goalSummary.goals} goles`}>{goalSummary.rank && goalSummary.rank <= 3 ? <span className={`goal-medal goal-medal-${goalSummary.rank}`}>{goalSummary.rank}</span> : null}<span className="goal-ball">⚽</span><span className="goal-count">{goalSummary.goals}</span></span> : null}</span></div>;
                  }) : <p className="team-empty-state">No hay jugadores disponibles.</p>}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
