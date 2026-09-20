"use client";

import Link from "next/link";
import { TeamIdentity, TeamShield } from "@/lib/team-identity";
import { getPlayerGoalSummary } from "@/lib/player-goal-balls";
import { useEffect, useState } from "react";

type TeamRow = {
  id: string;
  name: string;
  shortName?: string;
  primaryColor?: string;
  shieldImage?: string;
  players: Array<{ name: string; dorsal?: number | string; isGoalkeeper?: boolean }>;
};

type MatchRow = { goalScorers?: Array<{ player: string; team: string }> };

function sortPlayersByDorsal(players: TeamRow["players"]) {
  return [...players].sort((left, right) => {
    const leftDorsal = Number(left.dorsal ?? Number.MAX_SAFE_INTEGER);
    const rightDorsal = Number(right.dorsal ?? Number.MAX_SAFE_INTEGER);
    if (leftDorsal !== rightDorsal) {
      return leftDorsal - rightDorsal;
    }
    return String(left.name).localeCompare(String(right.name));
  });
}

export default function EquiposPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTeams() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/league", { cache: "no-store" });
        const payload = response.ok ? await response.json() : null;

        if (!active) {
          return;
        }

        if (!payload?.data) {
          throw new Error("No hay equipos disponibles.");
        }

        setTeams(Array.isArray(payload.data.teams) ? payload.data.teams : []);
        setMatches(Array.isArray(payload.data.matches) ? payload.data.matches : []);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "No se pudo cargar la plantilla.";
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadTeams();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Liga</p>
          <h1>Equipos y plantillas</h1>
        </div>
        <Link href="/" className="button button-secondary">Volver al inicio</Link>
      </header>

      {loading && <p className="empty-state">Cargando equipos…</p>}
      {error && <p className="empty-state error">{error}</p>}

      {!loading && !error && (
        <section className="team-grid">
          {teams.length > 0 ? teams.map((team) => (
            <article key={team.id} className="team-card" style={{ "--team-color": team.primaryColor || "#117d5f" } as React.CSSProperties}>
              <div className="team-header">
                <div className="team-badge team-shield-badge"><TeamShield name={team.name} imageFile={team.shieldImage} size={64} /></div>
                <div>
                  <h2>{team.name}</h2>
                  <small>{team.players.length} jugadores</small>
                </div>
              </div>

              <ul className="players-list">
                {sortPlayersByDorsal(team.players).map((player) => (
                  <li key={`${team.id}-${player.name}`}>
                    <span>{player.name}{player.isGoalkeeper ? <span className="goalkeeper-mark" title="Portero" aria-label="Portero">🧤</span> : null}{(() => { const goalSummary = getPlayerGoalSummary(matches, team.name, player.name); return goalSummary.goals > 0 ? <span className="goal-ranking" aria-label={`${goalSummary.rank ? `Puesto ${goalSummary.rank}, ` : ""}${goalSummary.goals} goles`}>{goalSummary.rank && goalSummary.rank <= 3 ? <span className={`goal-medal goal-medal-${goalSummary.rank}`}>{goalSummary.rank}</span> : null}<span className="goal-ball">⚽</span><span className="goal-count">{goalSummary.goals}</span></span> : null; })()}</span>
                    <strong>#{player.dorsal ?? "-"}</strong>
                  </li>
                ))}
              </ul>
            </article>
          )) : <p className="empty-state">Todavía no hay equipos cargados.</p>}
        </section>
      )}
    </main>
  );
}
