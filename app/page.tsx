"use client";

import Link from "next/link";
import Image from "next/image";
import { TeamIdentity, TeamShield } from "@/lib/team-identity";
import { teamColors } from "@/lib/league-data";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type GoalScorerSummary = {
  player: string;
  team: string;
  minute?: number;
};

type ScorerSummary = { name: string; team: string; goals: number; matches: number };
type ZamoraSummary = { name: string; team: string; goalsAgainst: number; matches: number; average: number };

type PublicLeagueState = {
  teams: Array<{ name: string; shortName?: string; primaryColor?: string; players?: Array<{ name: string; dorsal?: number | string }> }>;
  matches: Array<{ id: number; home: string; away: string; score: string; shootoutScore?: string; winner?: string; jornada: string; status?: "scheduled" | "finished" | "in-progress" | "cancelled"; goalScorers?: GoalScorerSummary[]; events?: { home: string; away: string } }>;
  calendar: Array<{ id: number; title: string; date: string; status: "completed" | "in-progress" | "upcoming"; matches: Array<{ home: string; away: string; time: string }>; descansan?: string[] }>;
  sanctions: Array<{ team: string; card: string; player: string; reason: string }>;
  scorers: ScorerSummary[];
  zamora: ZamoraSummary[];
};

const emptyLeague: PublicLeagueState = {
  teams: [],
  matches: [],
  calendar: [],
  sanctions: [],
  scorers: [],
  zamora: [],
};

export default function Home() {
  const [league, setLeague] = useState<PublicLeagueState>(emptyLeague);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const loadLeague = useCallback(async () => {
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/league", { cache: "no-store" });
      const payload = response.ok ? await response.json() : null;

      if (!payload?.data) {
        throw new Error("No hay datos disponibles en la liga.");
      }

      setLeague({
        teams: Array.isArray(payload.data.teams) ? payload.data.teams : [],
        matches: Array.isArray(payload.data.matches) ? payload.data.matches : [],
        calendar: Array.isArray(payload.data.calendar) ? payload.data.calendar : [],
        sanctions: Array.isArray(payload.data.sanctions) ? payload.data.sanctions : [],
        scorers: Array.isArray(payload.data.scorers) ? payload.data.scorers : [],
        zamora: Array.isArray(payload.data.zamora) ? payload.data.zamora : [],
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "No se pudo cargar la liga.";
      setError(message);
      setLeague(emptyLeague);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeague();
  }, [loadLeague]);

  useEffect(() => {
    const handleRefresh = () => {
      if (!loadingRef.current) {
        void loadLeague();
      }
    };

    const handleScroll = () => {
      const scrollReachedEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120;
      if (scrollReachedEnd) {
        handleRefresh();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleRefresh();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibility);

    if (typeof window !== "undefined" && "addEventListener" in window) {
      const appResumeHandler = () => handleRefresh();
      window.addEventListener("resume", appResumeHandler);
      return () => {
        window.removeEventListener("scroll", handleScroll);
        window.removeEventListener("focus", handleRefresh);
        window.removeEventListener("resume", appResumeHandler);
        document.removeEventListener("visibilitychange", handleVisibility);
      };
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadLeague]);

  const orderedCalendar = useMemo(() => [...league.calendar].sort((a, b) => a.id - b.id), [league.calendar]);

  const currentRound = useMemo(() => {
    const roundInProgress = orderedCalendar.find((round) => round.status === "in-progress" && round.matches.some((fixture) =>
      league.matches.some((match) => match.jornada === round.title && match.home === fixture.home && match.away === fixture.away && match.score && match.score !== "-")
    ));
    return roundInProgress ?? orderedCalendar.find((round) => round.status !== "completed");
  }, [league.matches, orderedCalendar]);

  const currentRoundMatches = useMemo(() => currentRound?.matches.map((fixture) => ({
    ...fixture,
    result: (() => {
      const result = league.matches.find((match) => match.jornada === currentRound.title && match.home === fixture.home && match.away === fixture.away);
      if (!result || !result.score || result.score === "-" || result.winner) {
        return result;
      }

      if (result.status !== "finished") {
        return result;
      }

      const [homeGoals, awayGoals] = result.score.split("-").map((value) => Number(value.trim()));
      let winner: string | undefined;
      if (homeGoals > awayGoals) {
        winner = result.home;
      } else if (awayGoals > homeGoals) {
        winner = result.away;
      } else if (result.shootoutScore) {
        const [homeShootout, awayShootout] = result.shootoutScore.split("-").map((value) => Number(value.trim()));
        winner = homeShootout > awayShootout ? result.home : awayShootout > homeShootout ? result.away : undefined;
      }

      return { ...result, winner };
    })(),
  })) ?? [], [currentRound, league.matches]);

  const currentRoundHasResults = currentRoundMatches.some((fixture) => fixture.result?.score && fixture.result.score !== "-");
  const currentRoundStatusLabel = currentRound?.status === "in-progress"
    ? "Jornada en curso"
    : currentRoundHasResults ? "Jornada actual" : "Próxima jornada";
  const teamColorByName = useMemo(() => Object.fromEntries(league.teams.map((team) => [team.name, team.primaryColor])), [league.teams]);

  const sanctionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    league.teams.forEach((team) => {
      counts[team.name] = 0;
    });
    league.sanctions.forEach((record) => {
      counts[record.team] = (counts[record.team] ?? 0) + 1;
    });
    return counts;
  }, [league.sanctions, league.teams]);

  const fairPlayTeam = useMemo(() => {
    if (!league.teams.length) {
      return "Kings Durango";
    }

    return [...league.teams].sort((a, b) => {
      const diff = (sanctionCounts[a.name] ?? 0) - (sanctionCounts[b.name] ?? 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    })[0]?.name ?? "Kings Durango";
  }, [league.teams, sanctionCounts]);

  const topScorer = useMemo(() => {
    return league.scorers[0] ?? { name: "Sin datos", team: "-", goals: 0, matches: 0 };
  }, [league.scorers]);

  const zamoraLeader = useMemo(() => {
    return league.zamora[0] ?? { name: "Sin datos", team: "-", average: 0, goalsAgainst: 0, matches: 0 };
  }, [league.zamora]);

  const formatVisibleDate = (value?: string) => {
    if (!value) {
      return "Sin fecha";
    }

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const day = date.getDate();
    const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return `${day} ${monthNames[date.getMonth()]}`;
  };

  const kpiTeamColor = (teamName: string) => teamColorByName[teamName] ?? teamColors[teamName]?.primary ?? "#117d5f";

  const homepageStandings = useMemo(() => {
    const buildTable = (matches: PublicLeagueState["matches"]) => {
      const table = league.teams.map((team) => ({
        team: team.name,
        played: 0,
        wins: 0,
        eg: 0,
        ep: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      }));

      matches.filter((match) => match.score && match.score !== "-").forEach((match) => {
        const [homeGoals, awayGoals] = match.score.split("-").map((value) => Number(value.trim()) || 0);
        const home = table.find((entry) => entry.team === match.home);
        const away = table.find((entry) => entry.team === match.away);
        if (!home || !away) return;

        home.played += 1;
        away.played += 1;
        home.goalsFor += homeGoals;
        home.goalsAgainst += awayGoals;
        away.goalsFor += awayGoals;
        away.goalsAgainst += homeGoals;

        if (homeGoals > awayGoals) {
          home.wins += 1;
          home.points += 3;
          away.losses += 1;
        } else if (awayGoals > homeGoals) {
          away.wins += 1;
          away.points += 3;
          home.losses += 1;
        } else {
          const shootout = match.shootoutScore?.split("-").map((value) => Number(value.trim())) ?? [];
          const homeWon = shootout.length === 2 && shootout[0] !== shootout[1] ? shootout[0] > shootout[1] : true;
          if (homeWon) {
            home.eg += 1;
            away.ep += 1;
            home.points += 2;
            away.points += 1;
          } else {
            away.eg += 1;
            home.ep += 1;
            away.points += 2;
            home.points += 1;
          }
        }
      });

      return table
        .map((entry) => ({ ...entry, goalDifference: entry.goalsFor - entry.goalsAgainst }))
        .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team));
    };

    const currentTable = buildTable(league.matches);
    const lastCompletedId = [...league.calendar]
      .filter((round) => round.status === "completed")
      .sort((a, b) => b.id - a.id)[0]?.id;
    const lastCompletedTitle = league.calendar.find((round) => round.id === lastCompletedId)?.title;
    const previousTable = lastCompletedTitle
      ? buildTable(league.matches.filter((match) => match.jornada !== lastCompletedTitle))
      : currentTable;
    const previousPosition = new Map(previousTable.map((entry, index) => [entry.team, index + 1]));

    return currentTable.map((entry, index) => ({
      ...entry,
      positionDelta: (previousPosition.get(entry.team) ?? index + 1) - (index + 1),
    }));
  }, [league.matches, league.teams]);

  const lastCompletedRound = useMemo(
    () => [...league.calendar].filter((round) => round.status === "completed").sort((a, b) => b.id - a.id)[0],
    [league.calendar]
  );
  const lastCompletedMatches = useMemo(
    () => lastCompletedRound ? league.matches.filter((match) => match.jornada === lastCompletedRound.title) : [],
    [lastCompletedRound, league.matches]
  );

  const resolveSupabaseAssetUrl = (fileName: string) => {
    if (!fileName) {
      return "";
    }

    if (fileName.startsWith("http://") || fileName.startsWith("https://") || fileName.startsWith("data:")) {
      return fileName;
    }

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!baseUrl) {
      return `/${encodeURIComponent(fileName)}`;
    }

    return `${baseUrl}/storage/v1/object/public/league-assets/${encodeURIComponent(fileName)}`;
  };

  if (error && !loading) {
    return (
      <main className="landing-shell">
        <section className="content-card empty-state error" role="alert">
          <h1>Datos no disponibles</h1>
          <p>{error}</p>
          <button type="button" className="button button-secondary" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="landing-shell">
      <section className="hero">
        <div className="hero-brand-image">
          <span className="hero-season-label">Temporada 2026/2027</span>
          <Image
            src={resolveSupabaseAssetUrl("Todos.png")}
            alt="Equipos de Kings League Durango"
            width={768}
            height={1024}
            priority
            unoptimized
          />
        </div>

        <Link
          href={currentRound?.title ? `/jornadas?jornada=${encodeURIComponent(currentRound.title)}` : "/jornadas"}
          className="hero-ticket hero-round-ticket"
          aria-label={currentRound?.title ? `Ver ${currentRound.title}` : "Ver jornadas"}
        >
          <div className="hero-ticket-heading">
            <span className="ticket-label">{currentRoundStatusLabel}</span>
            <small style={{ fontSize: 16, letterSpacing: 0.4, color: "#d9e2df", fontWeight: 700 }}>{formatVisibleDate(currentRound?.date)}</small>
          </div>
          <strong>{currentRound?.title ?? "Sin jornada"}</strong>
          {currentRound?.status === "in-progress" ? (
            <div style={{
              marginTop: 10,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              alignSelf: "flex-start",
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid rgba(245, 158, 11, 0.35)",
              background: "rgba(245, 158, 11, 0.12)",
              color: "#f4d78d",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.7,
              textTransform: "uppercase",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f4d78d", display: "inline-block" }} />
              En curso
            </div>
          ) : null}
          <div className="hero-fixture-list">
            {currentRoundMatches.length > 0 ? currentRoundMatches.map((fixture) => {
              const isMatchInProgress = fixture.result?.status === "in-progress" || fixture.result?.status === "scheduled";
              return (
                <div key={`${fixture.home}-${fixture.away}`} className="hero-fixture-row">
                  <span>{fixture.time}</span>
                  <b className={fixture.result?.winner === fixture.home ? "hero-winning-team" : undefined} style={fixture.result?.winner === fixture.home ? { "--team-color": teamColorByName[fixture.home] } as React.CSSProperties : undefined}><TeamIdentity name={fixture.home} compact /></b>
                  <em style={isMatchInProgress ? { color: "#f4d78d", fontWeight: 900 } : undefined}>{fixture.result?.score && fixture.result.score !== "-" ? fixture.result.score : "-"}</em>
                  <b className={fixture.result?.winner === fixture.away ? "hero-winning-team" : undefined} style={fixture.result?.winner === fixture.away ? { "--team-color": teamColorByName[fixture.away] } as React.CSSProperties : undefined}><TeamIdentity name={fixture.away} compact /></b>
                </div>
              );
            }) : <small>Sin partidos definidos</small>}
          </div>
          {currentRound?.descansan?.length ? (
            <div className="hero-resting"><span>Descansan</span>{currentRound.descansan.join(" · ")}</div>
          ) : null}
        </Link>
      </section>

      {loading && <p className="empty-state">Cargando datos desde la API…</p>}
      {error && <p className="empty-state error">{error}</p>}

      {!loading && !error && (
        <>
          <section className="stats-grid homepage-kpi-grid">
            <Link href="/clasificacion" className="stat-card highlight kpi-card" aria-label="Ver clasificación de la liga" style={{ "--kpi-team-color": kpiTeamColor(homepageStandings[0]?.team ?? "") } as React.CSSProperties}>
              <div className="kpi-copy"><span className="kpi-label">Líder liga</span><strong>{homepageStandings[0]?.team ?? "Sin datos"}</strong><small>{homepageStandings[0] ? `${homepageStandings[0].points} puntos` : "Clasificación pendiente"}</small></div>
              <TeamShield name={homepageStandings[0]?.team ?? ""} className="kpi-shield" size={72} />
            </Link>
            <Link href="/goleadores" className="stat-card highlight kpi-card" aria-label="Ver clasificación de goleadores" style={{ "--kpi-team-color": kpiTeamColor(topScorer.team) } as React.CSSProperties}>
              <div className="kpi-copy"><span className="kpi-label">Pitxitxi</span><strong>{topScorer.name}</strong><small>{topScorer.team}</small></div>
              <TeamShield name={topScorer.team} className="kpi-shield" size={72} />
            </Link>
            <Link href="/zamora" className="stat-card highlight kpi-card" aria-label="Ver clasificación de porteros Zamora" style={{ "--kpi-team-color": kpiTeamColor(zamoraLeader.team) } as React.CSSProperties}>
              <div className="kpi-copy"><span className="kpi-label">Zamora</span><strong>{zamoraLeader.name}</strong><small>{zamoraLeader.team}</small></div>
              <TeamShield name={zamoraLeader.team} className="kpi-shield" size={72} />
            </Link>
            <Link href="/sanciones" className="stat-card highlight kpi-card" aria-label="Ver clasificación Fair Play" style={{ "--kpi-team-color": kpiTeamColor(fairPlayTeam) } as React.CSSProperties}>
              <div className="kpi-copy"><span className="kpi-label">Fair Play</span><strong>{fairPlayTeam}</strong><small>{sanctionCounts[fairPlayTeam] ?? 0} puntos</small></div>
              <TeamShield name={fairPlayTeam} className="kpi-shield" size={72} />
            </Link>
          </section>

          <section className="content-grid">
            <div className="content-card home-panel">
              <div className="section-header"><h2>Clasificación</h2><Link href="/clasificacion">Ver tabla</Link></div>
              <div className="home-standings">
                <div className="home-standing-row home-standing-heading"><span># Equipo</span><span>PJ</span><span>Pts</span></div>
                {homepageStandings.length > 0 ? homepageStandings.map((entry, index) => (
                  <div key={entry.team} className={`home-standing-row ${index < 6 ? "group-champions" : "group-hoyo"}`}>
                    <span><b>{index + 1}</b> <TeamIdentity name={entry.team} compact />{entry.positionDelta !== 0 ? <span className={`trend-badge ${entry.positionDelta > 0 ? "up" : "down"}`} aria-label={entry.positionDelta > 0 ? "Sube posiciones" : "Baja posiciones"}>{entry.positionDelta > 0 ? "▲" : "▼"}</span> : <span className="home-standing-neutral" aria-label="Sin cambios">•</span>}</span>
                    <span>{entry.played}</span>
                    <strong>{entry.points}</strong>
                  </div>
                )) : <div className="empty-state">Sin equipos</div>}
              </div>
            </div>

            <div className="content-card home-panel">
              <div className="section-header">
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <h2>Jornada {lastCompletedRound?.id ?? ""} · Últimos resultados</h2>
                  {lastCompletedRound?.date ? (
                    <small style={{ color: "#a9b9b5", fontWeight: 700, letterSpacing: 0.3 }}>{formatVisibleDate(lastCompletedRound.date)}</small>
                  ) : null}
                </div>
                <Link href="/jornadas">Ver jornada</Link>
              </div>
              <ul className="match-list compact">
                {lastCompletedMatches.length > 0 ? lastCompletedMatches.map((match) => <li key={match.id} className="home-result-row"><span><b><TeamIdentity name={match.home} compact /></b><strong>{match.score || "-"}</strong><b><TeamIdentity name={match.away} compact /></b></span><small>Finalizado</small></li>) : <li><span>Sin resultados</span><small>--</small></li>}
              </ul>
            </div>
          </section>

        </>
      )}
    </main>
  );
}
