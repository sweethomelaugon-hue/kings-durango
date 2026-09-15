"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getTeamPalette, teamColors } from "@/lib/league-data";
import { TeamIdentity, TeamShield } from "@/lib/team-identity";

type ZamoraRow = {
  name: string;
  team: string;
  matches: number;
  goalsAgainst: number;
  cleanSheets: number;
  average: number;
  positionDelta?: number;
};

type TeamRow = { name: string; primaryColor?: string };

export default function ZamoraPage() {
  const [zamora, setZamora] = useState<ZamoraRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadZamora() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/league", { cache: "no-store" });
        const payload = response.ok ? await response.json() : null;

        if (!active) {
          return;
        }

        if (!payload?.data) {
          throw new Error("No se pudo cargar la clasificación de Zamora.");
        }

        const incoming = Array.isArray(payload.data.zamora) ? payload.data.zamora : [];
        setZamora(incoming);
        setTeams(Array.isArray(payload.data.teams) ? payload.data.teams : []);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "No se pudo cargar el ranking de Zamora.";
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadZamora();

    return () => {
      active = false;
    };
  }, []);

  const leader = useMemo(() => zamora[0], [zamora]);
  const leaderPalette = leader ? getTeamPalette(leader.team, teams.find((team) => team.name === leader.team)?.primaryColor) : getTeamPalette("Aston Birras");
  const configuredLeaderColor = leaderPalette.primary;

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Porteros</p>
          <h1>Ranking de Zamora</h1>
        </div>
        <Link href="/" className="button button-secondary">Volver al inicio</Link>
      </header>

      {loading && <p className="empty-state">Cargando Zamora…</p>}
      {error && <p className="empty-state error">{error}</p>}

      {!loading && !error && (
        <>
          {leader ? (
            <section className="top-scorer-spotlight" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${configuredLeaderColor} 58%, #080b0d), color-mix(in srgb, ${leaderPalette.accent ?? "#d7a83d"} 52%, #080b0d))` }}>
              <div className="spotlight-copy">
                <span className="eyebrow">ZAMORA</span>
                <h2>{leader.name}</h2>
                <p><TeamIdentity name={leader.team} compact /></p>
                <div className="spotlight-stats">
                  <strong>{leader.goalsAgainst}</strong>
                  <span>goles</span>
                  <strong>{leader.matches}</strong>
                  <span>partidos</span>
                </div>
              </div>
              <TeamShield name={leader.team} className="spotlight-shield" size={112} />
            </section>
          ) : null}

          <section className="content-card stats-panel">
            <div className="section-header compact-header">
              <h2>Top 5</h2>
              <span>Porteros</span>
            </div>

            <div className="stat-rank-list">
              {zamora.length > 0 ? zamora.slice(0, 5).map((keeper, index) => {
                const palette = getTeamPalette(keeper.team, teams.find((team) => team.name === keeper.team)?.primaryColor);
                const configuredColor = palette.primary;
                return (
                  <div key={keeper.name} className="stat-rank-item">
                    <span className="position">#{index + 1}</span>
                    <div className="player-meta">
                      <strong>{keeper.name}</strong>
                      <TeamIdentity name={keeper.team} compact />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {keeper.positionDelta !== undefined && keeper.positionDelta !== 0 && (
                        <span className={`trend-badge ${keeper.positionDelta > 0 ? "up" : "down"}`} aria-label={keeper.positionDelta > 0 ? "Sube" : "Baja"}>
                          {keeper.positionDelta > 0 ? "▲" : "▼"}
                        </span>
                      )}
                      <div className="player-figure" style={{ borderColor: configuredColor }}>
                        {keeper.average.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              }) : <p className="empty-state">No hay porteros registrados.</p>}
            </div>
          </section>

          <section className="content-card table-wrap">
            <div className="section-header compact-header">
              <h2>Clasificación completa</h2>
              <span>Datos por partido</span>
            </div>
            {zamora.length > 0 ? (
              <table className="league-table keepers-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Portero</th>
                    <th>Equipo</th>
                    <th>PJ</th>
                    <th>GC</th>
                    <th>CS</th>
                    <th>Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {zamora.map((keeper, index) => (
                    <tr key={`${keeper.name}-${keeper.team}`}>
                      <td>{index + 1}</td>
                      <td>{keeper.name}</td>
                      <td>
                        <span className="team-tag" style={{ background: `${getTeamPalette(keeper.team, teams.find((team) => team.name === keeper.team)?.primaryColor).primary}1A`, color: getTeamPalette(keeper.team, teams.find((team) => team.name === keeper.team)?.primaryColor).secondary }}>
                          <TeamIdentity name={keeper.team} compact />
                        </span>
                      </td>
                      <td>{keeper.matches}</td>
                      <td>{keeper.goalsAgainst}</td>
                      <td>{keeper.cleanSheets}</td>
                      <td>{keeper.average.toFixed(2)}</td>
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
