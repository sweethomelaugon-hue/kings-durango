"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getTeamPalette } from "@/lib/league-data";
import { dedupeActiveDisciplineStatus, getDisciplineStatus, getNextTeamRound } from "@/lib/discipline";
import { TeamIdentity } from "@/lib/team-identity";
import { TeamShield } from "@/lib/team-identity";

type SanctionRow = {
  id: number;
  player: string;
  team: string;
  card: "Amarilla" | "Doble amarilla" | "Roja" | "Otra";
  matches: number;
  remaining: number;
  reason: string;
  jornada?: string;
  suspensionMatches?: number;
  suspensionRemaining?: number;
  suspensionRoundTitles?: string[];
  suspensionRounds?: Array<{ id: number; title: string; status: "completed" | "in-progress" | "upcoming" }>;
  isYellowAccumulationSuspension?: boolean;
  yellowCards?: number;
  points?: number;
  pointsAmount?: number;
  costAmount?: number;
  cost_amount?: number;
};

type TeamRow = { name: string; primaryColor?: string; shieldImage?: string };
type CalendarRound = {
  id: number;
  title: string;
  date: string;
  status: "completed" | "in-progress" | "upcoming";
  matches: Array<{ time: string; home: string; away: string; stadium?: string; result?: string }>;
  descansan: string[];
};

export default function SancionesPage() {
  const [sanctions, setSanctions] = useState<SanctionRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [calendar, setCalendar] = useState<CalendarRound[]>([]);
  const [yellowCardResetRoundId, setYellowCardResetRoundId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSanctions() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/league", { cache: "no-store" });
        const payload = response.ok ? await response.json() : null;

        if (!active) {
          return;
        }

        if (!payload?.data) {
          throw new Error("No se pudo cargar el expediente disciplinario.");
        }

        setSanctions(Array.isArray(payload.data.sanctions) ? payload.data.sanctions : []);
        setTeams(Array.isArray(payload.data.teams) ? payload.data.teams : []);
        setCalendar(Array.isArray(payload.data.calendar) ? payload.data.calendar : []);
        setYellowCardResetRoundId(payload.data.finances?.yellowCardResetRoundId);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "No se pudo cargar el detalle de sanciones.";
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSanctions();

    return () => {
      active = false;
    };
  }, []);

  const totalAmarillas = useMemo(() => sanctions.filter((item) => item.card === "Amarilla").length, [sanctions]);
  const totalDobles = useMemo(() => sanctions.filter((item) => item.card === "Doble amarilla").length, [sanctions]);
  const totalRojas = useMemo(() => sanctions.filter((item) => item.card === "Roja").length, [sanctions]);
  const totalOtras = useMemo(() => sanctions.filter((item) => item.card === "Otra").length, [sanctions]);
  const fairPlayRanking = useMemo(() => {
    const points = new Map<string, number>(teams.map((team) => [team.name, 0]));
    sanctions.forEach((item) => { points.set(item.team, (points.get(item.team) ?? 0) + Number(item.points ?? item.pointsAmount ?? 0)); });
    sanctions.forEach((item) => {
      if (!points.has(item.team)) {
        points.set(item.team, Number(item.points ?? item.pointsAmount ?? 0));
      }
    });
    return Array.from(points.entries()).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  }, [sanctions, teams]);
  const fairPlayLeader = fairPlayRanking[0];
  const fairPlayPalette = fairPlayLeader ? getTeamPalette(fairPlayLeader[0], teams.find((team) => team.name === fairPlayLeader[0])?.primaryColor) : getTeamPalette("Aston Birras");
  const fairPlayConfiguredColor = fairPlayPalette.primary;
  const currentRound = useMemo(
    () => calendar.find((round) => round.status === "in-progress")
      ?? calendar.find((round) => round.status === "upcoming")
      ?? [...calendar].filter((round) => round.status === "completed").sort((a, b) => b.id - a.id)[0],
    [calendar]
  );
  const activeSanctions = useMemo(() => {
    return currentRound
      ? dedupeActiveDisciplineStatus(getDisciplineStatus(sanctions, calendar, currentRound.id, yellowCardResetRoundId))
      : [];
  }, [calendar, currentRound, sanctions, yellowCardResetRoundId]);
  const accumulatedYellowCards = useMemo(() => {
    if (!currentRound) {
      return [];
    }

    const byPlayer = new Map<string, { player: string; team: string; yellowCards: number; suspensionRoundTitle?: string }>();
    getDisciplineStatus(sanctions, calendar, currentRound.id, yellowCardResetRoundId).forEach((record) => {
      if (record.yellowCards <= 0) {
        return;
      }

      const key = `${record.team.toLowerCase()}::${record.player.toLowerCase()}`;
      const current = byPlayer.get(key);
      if (!current || record.yellowCards > current.yellowCards) {
        byPlayer.set(key, {
          player: record.player,
          team: record.team,
          yellowCards: record.yellowCards,
          suspensionRoundTitle: record.yellowCards >= 3 ? getNextTeamRound(calendar, currentRound.id, record.team)?.title : undefined,
        });
      }
    });

    return Array.from(byPlayer.values()).sort((a, b) => b.yellowCards - a.yellowCards || a.player.localeCompare(b.player));
  }, [calendar, currentRound, sanctions, yellowCardResetRoundId]);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Disciplina</p>
          <h1>Sanciones y amonestaciones</h1>
        </div>
        <Link href="/" className="button button-secondary">Volver al inicio</Link>
      </header>

      {loading && <p className="empty-state">Cargando sanciones…</p>}
      {error && <p className="empty-state error">{error}</p>}

      {!loading && !error && (
        <>
          <section className="sanction-kpi-row">
            <div className="sanction-kpi-heading">
              <p className="eyebrow">Temporada 2026/27</p>
              <h2>Resumen disciplinario</h2>
              <span>{sanctions.length} registros · {activeSanctions.length} sanciones en curso</span>
            </div>
            <div className="sanction-summary">
              <div className="sanction-card"><span>Amarillas</span><strong>{totalAmarillas}</strong></div>
              <div className="sanction-card"><span>Doble amarilla</span><strong>{totalDobles}</strong></div>
              <div className="sanction-card"><span>Rojas</span><strong>{totalRojas}</strong></div>
              <div className="sanction-card"><span>Otras</span><strong>{totalOtras}</strong></div>
            </div>
          </section>

          {fairPlayLeader ? (
            <section className="top-scorer-spotlight fair-play-spotlight" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${fairPlayConfiguredColor} 58%, #080b0d), color-mix(in srgb, ${fairPlayPalette.accent} 52%, #080b0d))` }}>
              <div className="spotlight-copy">
                <span className="eyebrow">Fair Play · líder</span>
                <h2>{fairPlayLeader[0]}</h2>
                <p>El equipo con menos puntos disciplinarios</p>
                <div className="spotlight-stats">
                  <strong>{fairPlayLeader[1]}</strong>
                  <span>puntos</span>
                  <strong>{fairPlayRanking.length}</strong>
                  <span>equipos</span>
                </div>
              </div>
              <TeamShield name={fairPlayLeader[0]} className="spotlight-shield" size={112} />
            </section>
          ) : null}

          <section className="content-card stats-panel">
            <div className="section-header compact-header">
              <h2>Clasificación Fair Play</h2>
              <span>Menos puntos, mejor posición</span>
            </div>
            <div className="stat-rank-list">
              {fairPlayRanking.length > 0 ? fairPlayRanking.map(([team, points], index) => {
                const palette = getTeamPalette(team, teams.find((entry) => entry.name === team)?.primaryColor);
                const configuredColor = palette.primary;
                return (
                  <div key={team} className={`stat-rank-item ${index === 0 ? "fair-play-first" : ""}`}>
                    <span className="position">#{index + 1}</span>
                    <div className="player-meta">
                      <strong>{team}</strong>
                      <span>{index === 0 ? "Fair Play" : "Clasificación disciplinaria"}</span>
                    </div>
                    <div className="player-figure" style={{ borderColor: configuredColor }}>{points}</div>
                  </div>
                );
              }) : <p className="empty-state">No hay equipos registrados.</p>}
            </div>
          </section>

          <section className="content-card table-wrap active-sanctions-panel">
            <div className="section-header compact-header">
              <h2>Jugadores sancionados</h2>
              <span>{activeSanctions.length} en curso</span>
            </div>
            {activeSanctions.length > 0 ? (
              <table className="league-table sanctions-public-table">
                <thead>
                  <tr><th>Equipo</th><th>Jugador</th><th>Tipo de sanción</th><th>Partidos restantes</th><th>Jornadas sanción</th></tr>
                </thead>
                <tbody>
                  {activeSanctions.map((item) => (
                    <tr key={item.id}>
                      <td><span className="team-tag sanction-team-tag" style={{ background: `${getTeamPalette(item.team, teams.find((team) => team.name === item.team)?.primaryColor).primary}1A`, color: getTeamPalette(item.team, teams.find((team) => team.name === item.team)?.primaryColor).secondary }}><TeamIdentity name={item.team} className="sanction-team-identity" compact /></span></td>
                      <td><strong>{item.player}</strong></td>
                      <td><span className={`sanction-badge ${item.card.toLowerCase().replace(/ /g, "-")}`}>{item.isYellowAccumulationSuspension ? "3 amarillas" : item.card}</span></td>
                      <td>
                        <strong>
                          {item.suspensionRemaining}/{item.suspensionRounds?.length ?? item.suspensionMatches ?? 0}
                        </strong>
                      </td>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          {item.suspensionRounds?.map((round) => {
                            const completed = round.status === "completed";
                            return (
                              <span
                                key={round.id}
                                title={round.title}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  minWidth: 28,
                                  height: 28,
                                  padding: "0 7px",
                                  borderRadius: 999,
                                  background: completed ? "rgba(47, 201, 138, 0.16)" : "rgba(249, 115, 22, 0.16)",
                                  color: completed ? "#a9f0d0" : "#fdba74",
                                  fontWeight: 800,
                                }}
                              >
                                {round.id}
                              </span>
                            );
                          })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="empty-state">No hay jugadores con sanciones en curso.</p>}
          </section>

          <section className="content-card">
            <div className="section-header compact-header">
              <h2>Tarjetas acumuladas</h2>
              <span>{accumulatedYellowCards.length} jugadores</span>
            </div>
            <div className="team-points-list">
              {accumulatedYellowCards.length > 0 ? accumulatedYellowCards.map((record) => (
                <div key={`${record.team}-${record.player}`} className="team-points-row">
                  <span>
                    <strong style={{ color: getTeamPalette(record.team, teams.find((team) => team.name === record.team)?.primaryColor).primary }}>
                      {record.player}
                    </strong>
                    <small style={{ display: "block", color: "#b0bab8", marginTop: 3 }}>
                      <TeamIdentity
                        name={record.team}
                        imageFile={teams.find((team) => team.name === record.team)?.shieldImage}
                        compact
                      />
                    </small>
                    {record.yellowCards >= 3 ? (
                      <small style={{ display: "block", color: "#f4d78d", marginTop: 5 }}>
                        No podrá jugar{record.suspensionRoundTitle ? ` en ${record.suspensionRoundTitle}` : " en la próxima jornada de su equipo"}
                      </small>
                    ) : null}
                  </span>
                  <strong className={record.yellowCards === 3 ? "critical" : record.yellowCards === 2 ? "high" : "medium"}>{record.yellowCards}/3</strong>
                </div>
              )) : <p className="empty-state">No hay jugadores con amarillas acumuladas.</p>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
