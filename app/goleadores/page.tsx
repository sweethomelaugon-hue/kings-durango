"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { teamColors } from "@/lib/league-data";
import { TeamIdentity, TeamShield } from "@/lib/team-identity";

type ScorerRow = {
  name: string;
  team: string;
  goals: number;
  matches: number;
  positionDelta?: number;
};

type TeamRow = { name: string; primaryColor?: string };

export default function GoleadoresPage() {
  const [scorers, setScorers] = useState<ScorerRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadScorers() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/league", { cache: "no-store" });
        const payload = response.ok ? await response.json() : null;

        if (!active) {
          return;
        }

        if (!payload?.data) {
          throw new Error("No se pudo cargar la clasificación de goleadores.");
        }

        const incoming = Array.isArray(payload.data.scorers) ? payload.data.scorers : [];
        setScorers(incoming);
        setTeams(Array.isArray(payload.data.teams) ? payload.data.teams : []);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "No se pudo cargar la estadística de goleadores.";
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadScorers();

    return () => {
      active = false;
    };
  }, []);

  const featured = useMemo(() => scorers[0], [scorers]);
  const teamPalette = featured ? teamColors[featured.team] ?? teamColors["Aston Birras"] : teamColors["Aston Birras"];
  const configuredFeaturedColor = featured ? teams.find((team) => team.name === featured.team)?.primaryColor ?? teamPalette.primary : teamPalette.primary;

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Estadísticas</p>
          <h1>Pitxitxi</h1>
        </div>
        <Link href="/" className="button button-secondary">Volver al inicio</Link>
      </header>

      {loading && <p className="empty-state">Cargando goleadores…</p>}
      {error && <p className="empty-state error">{error}</p>}

      {!loading && !error && (
        <>
          {featured ? (
            <section className="top-scorer-spotlight" style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${configuredFeaturedColor} 58%, #080b0d) 0%, color-mix(in srgb, ${teamPalette.accent} 52%, #080b0d) 100%)`
            }}>
              <div className="spotlight-copy">
                <span className="eyebrow">Pitxitxi</span>
                <h2>{featured.name}</h2>
                <p><TeamIdentity name={featured.team} compact /></p>
                <div className="spotlight-stats">
                  <strong>{featured.goals}</strong>
                  <span>goles</span>
                  <strong>{featured.matches}</strong>
                  <span>partidos</span>
                </div>
              </div>
              <TeamShield name={featured.team} className="spotlight-shield" size={112} />
            </section>
          ) : null}

          <section className="content-card stats-panel">
            <div className="section-header compact-header">
              <h2>Top 5</h2>
              <span>Temporada 2026/27</span>
            </div>

            <div className="stat-rank-list">
              {scorers.length > 0 ? scorers.slice(0, 5).map((player, index) => {
                const palette = teamColors[player.team] ?? teamColors["Aston Birras"];
                const configuredColor = teams.find((team) => team.name === player.team)?.primaryColor ?? palette.primary;
                return (
                  <div key={player.name} className="stat-rank-item">
                    <span className="position">#{index + 1}</span>
                    <div className="player-meta">
                      <strong>{player.name}</strong>
                      <TeamIdentity name={player.team} compact />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {player.positionDelta !== undefined && player.positionDelta !== 0 && (
                        <span className={`trend-badge ${player.positionDelta > 0 ? "up" : "down"}`} aria-label={player.positionDelta > 0 ? "Sube" : "Baja"}>
                          {player.positionDelta > 0 ? "▲" : "▼"}
                        </span>
                      )}
                      <div className="player-figure" style={{ borderColor: configuredColor }}>
                        {player.goals}
                      </div>
                    </div>
                  </div>
                );
              }) : <p className="empty-state">No hay goleadores registrados.</p>}
            </div>
          </section>

          <section className="content-card table-wrap">
            <div className="section-header compact-header">
              <h2>Todos los jugadores</h2>
              <span>{scorers.length} registros</span>
            </div>
            {scorers.length > 0 ? (
              <table className="league-table scorers-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Jugador</th>
                    <th>Equipo</th>
                    <th>Goles</th>
                    <th>Partidos</th>
                  </tr>
                </thead>
                <tbody>
                  {scorers.map((player, index) => (
                    <tr key={`${player.name}-${player.team}`}>
                      <td>{index + 1}</td>
                      <td>{player.name}</td>
                      <td>
                        <span className="team-tag" style={{ background: `${teams.find((team) => team.name === player.team)?.primaryColor ?? teamColors[player.team]?.primary ?? "#11845f"}1A`, color: teamColors[player.team]?.secondary ?? "#f5d77b" }}>
                          <TeamIdentity name={player.team} compact />
                        </span>
                      </td>
                      <td>{player.goals}</td>
                      <td>{player.matches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="empty-state">No hay registros.</p>}
          </section>
        </>
      )}
    </main>
  );
}
