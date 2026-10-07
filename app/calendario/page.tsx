"use client";

import Link from "next/link";
import { TeamIdentity } from "@/lib/team-identity";
import { LeagueInformationButton } from "@/components/LeagueInformationButton";
import { useEffect, useMemo, useState } from "react";
import { phaseTwoEvents, phaseTwoRounds, type PhaseTwoGroup } from "@/lib/phase-two-calendar";

type CalendarRound = {
  id: number;
  title: string;
  date: string;
  status: "completed" | "in-progress" | "upcoming";
  matches: Array<{ time: string; home: string; away: string; stadium?: string; result?: string; }>;
  descansan: string[];
};

type StandingRow = { team: string; position?: number };

const phaseGroupLabels: Record<PhaseTwoGroup, string> = {
  champions: "Champions",
  hoyo: "Hoyo",
};

function formatPhaseDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

export default function CalendarioPage() {
  const [showCompleted, setShowCompleted] = useState(true);
  const [calendarPhase, setCalendarPhase] = useState<"fase1" | "fase2">("fase1");
  const [calendar, setCalendar] = useState<CalendarRound[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCalendar() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/league", { cache: "no-store" });
        const payload = response.ok ? await response.json() : null;

        if (!active) {
          return;
        }

        if (!payload?.data) {
          throw new Error("No se pudo cargar el calendario.");
        }

        setCalendar(Array.isArray(payload.data.calendar) ? payload.data.calendar : []);
        setStandings(Array.isArray(payload.data.standings) ? payload.data.standings : []);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "No se pudo cargar el calendario.";
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCalendar();

    return () => {
      active = false;
    };
  }, []);

  const orderedCalendar = useMemo(
    () => [...calendar]
      .filter((round) => showCompleted || round.status !== "completed")
      .sort((a, b) => a.id - b.id),
    [calendar, showCompleted]
  );
  const teamAtPosition = useMemo(() => {
    const orderedStandings = [...standings].sort((first, second) =>
      (first.position ?? Number.MAX_SAFE_INTEGER) - (second.position ?? Number.MAX_SAFE_INTEGER)
    );
    return new Map(orderedStandings.map((entry, index) => [entry.position ?? index + 1, entry.team]));
  }, [standings]);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Competiciones</p>
          <h1>Calendario Kings 2026/27</h1>
        </div>
        <div className="calendar-tools">
          <LeagueInformationButton section="calendario" />
          <button type="button" className="button button-secondary" onClick={() => setShowCompleted((value) => !value)}>{showCompleted ? "Ocultar finalizadas" : "Mostrar finalizadas"}</button>
          <Link href="/" className="button button-secondary">Volver al inicio</Link>
        </div>
      </header>

      {loading && <p className="empty-state">Cargando calendario…</p>}
      {error && <p className="empty-state error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="calendar-phase-switch" role="tablist" aria-label="Fase del calendario">
            <button type="button" role="tab" aria-selected={calendarPhase === "fase1"} className={`calendar-phase-tab ${calendarPhase === "fase1" ? "active" : ""}`} onClick={() => setCalendarPhase("fase1")}>Fase 1</button>
            <button type="button" role="tab" aria-selected={calendarPhase === "fase2"} className={`calendar-phase-tab ${calendarPhase === "fase2" ? "active" : ""}`} onClick={() => setCalendarPhase("fase2")}>Fase 2</button>
          </div>

          {calendarPhase === "fase1" ? <section className="calendar-list">
            {orderedCalendar.length > 0 ? orderedCalendar.map((round) => (
              <article key={round.id} className={`content-card round-card round-status-${round.status}`}>
                <div className="section-header compact-round-header">
                  <div className="round-title-wrap">
                    <h2>{round.title}</h2>
                    <span className={`status-pill ${round.status}`}>{round.status === "in-progress" ? "En curso" : round.status === "completed" ? "Finalizada" : "Próxima"}</span>
                  </div>
                  <span className="round-date">{round.date}</span>
                </div>
                <div className="slot-summary">
                  <span className="slot-summary-label">Juegan por horario</span>
                  <div className="slot-summary-list">
                    {round.matches.map((match, index) => (
                      <div key={`${round.id}-slot-${index}`} className="slot-summary-item"><span className="slot-hour">{match.time}</span><span className="slot-fixture"><strong><TeamIdentity name={match.home} compact /></strong><span className="slot-versus">vs</span><strong><TeamIdentity name={match.away} compact /></strong></span></div>
                    ))}
                  </div>
                </div>
                {round.descansan.length > 0 && (
                  <div className="resting-list"><span className="rest-label">Descansan</span><div className="rest-tags">{round.descansan.map((name) => <span key={`${round.id}-${name}`} className="rest-tag"><TeamIdentity name={name} compact /></span>)}</div></div>
                )}
              </article>
            )) : <p className="empty-state">Todavía no hay jornadas en el calendario.</p>}
          </section> : null}

          {calendarPhase === "fase2" ? <section className="phase-two-calendar" aria-labelledby="phase-two-heading">
            <header className="phase-two-heading">
              <div>
                <p className="eyebrow">Segunda fase · 2027</p>
                <h2 id="phase-two-heading">Calendario de fase 2</h2>
                <p>Los números de equipo corresponden a la posición de cierre de la fase regular. Los nombres reflejan la clasificación actual.</p>
              </div>
              <div className="phase-two-legend" aria-label="Grupos de fase 2">
                <span className="phase-group-tag hoyo"><i aria-hidden="true" />Hoyo · puestos 7–12</span>
                <span className="phase-group-tag champions"><i aria-hidden="true" />Champions · puestos 1–6</span>
              </div>
            </header>

            <div className="phase-two-rounds">
              {phaseTwoRounds.map((round) => (
                <article key={round.title} className="phase-two-round content-card">
                  <header className="phase-two-round-heading">
                    <h3>{round.title}</h3>
                    <time dateTime={round.date}>{formatPhaseDate(round.date)}</time>
                  </header>
                  <div className="phase-two-fixtures">
                    {round.fixtures.map((match) => (
                      <div key={`${round.title}-${match.time}-${match.homePosition}`} className={`phase-two-fixture ${match.group}`}>
                        <time className="phase-two-time" dateTime={`${round.date}T${match.time}`}>{match.time}</time>
                        <span className="phase-two-team">
                          <small>Puesto {match.homePosition}</small>
                          <strong>{teamAtPosition.get(match.homePosition) ?? `Equipo ${match.homePosition}`}</strong>
                        </span>
                        <span className="phase-two-versus">vs</span>
                        <span className="phase-two-team away">
                          <small>Puesto {match.awayPosition}</small>
                          <strong>{teamAtPosition.get(match.awayPosition) ?? `Equipo ${match.awayPosition}`}</strong>
                        </span>
                        <span className={`phase-group-mini ${match.group}`}>{phaseGroupLabels[match.group]}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <article className="phase-two-repechage content-card">
              <header className="phase-two-round-heading">
                <div>
                  <p className="eyebrow">Acceso a playoffs</p>
                  <h3>{phaseTwoEvents.repechage.title}</h3>
                </div>
                <time dateTime={phaseTwoEvents.repechage.date}>{formatPhaseDate(phaseTwoEvents.repechage.date)}</time>
              </header>
              <div className="phase-two-event-fixtures">
                {phaseTwoEvents.repechage.fixtures.map((match) => (
                  <div className="phase-two-event-fixture" key={match.time}>
                    <time>{match.time}</time>
                    <strong>{match.description}</strong>
                  </div>
                ))}
              </div>
              <p className="phase-two-note">{phaseTwoEvents.repechage.note}</p>
            </article>

            <section className="phase-two-bracket-card content-card" aria-labelledby="phase-two-bracket-heading">
              <header className="phase-two-bracket-header">
                <div>
                  <p className="eyebrow">Eliminatorias</p>
                  <h3 id="phase-two-bracket-heading">Cuadro de playoffs</h3>
                  <p className="phase-two-bracket-entrants">8 plazas · 4 Champions · 2 ganadores de repesca · 2 Hoyo</p>
                </div>
                <span className="phase-two-draw-note">Cruces pendientes de sorteo</span>
              </header>

              <div className="phase-two-bracket-scroll">
                <div className="phase-two-bracket">
                  <section className="bracket-stage bracket-quarterfinals" aria-label="Cuartos de final">
                    <header className="bracket-stage-heading">
                      <h4>{phaseTwoEvents.playoffs[0].title}</h4>
                      <time dateTime={phaseTwoEvents.playoffs[0].date}>{formatPhaseDate(phaseTwoEvents.playoffs[0].date)}</time>
                    </header>
                    <div className="bracket-match-stack quarterfinal-stack">
                      {phaseTwoEvents.playoffs[0].matches.map((match, index) => (
                        <article className="bracket-match" key={match.label}>
                          <header><span>{match.label}</span><time>{match.time}</time></header>
                          <div className="bracket-slot"><span>Plaza {index * 2 + 1}</span><strong>Pendiente de sorteo</strong></div>
                          <div className="bracket-slot"><span>Plaza {index * 2 + 2}</span><strong>Pendiente de sorteo</strong></div>
                        </article>
                      ))}
                    </div>
                  </section>

                  <div className="bracket-advance-arrows quarterfinal-arrows" aria-hidden="true">
                    <span>↘</span><span>↗</span><span>↘</span><span>↗</span>
                  </div>

                  <section className="bracket-stage bracket-semifinals" aria-label="Semifinales">
                    <header className="bracket-stage-heading">
                      <h4>{phaseTwoEvents.playoffs[1].title}</h4>
                      <time dateTime={phaseTwoEvents.playoffs[1].date}>{formatPhaseDate(phaseTwoEvents.playoffs[1].date)}</time>
                    </header>
                    <div className="bracket-match-stack semifinal-stack">
                      {phaseTwoEvents.playoffs[1].matches.map((match, index) => {
                        const firstQuarter = index * 2 + 1;
                        const secondQuarter = firstQuarter + 1;
                        return (
                          <article className="bracket-match" key={match.label}>
                            <header><span>{match.label}</span><time>{match.time}</time></header>
                            <div className="bracket-slot"><span>Ganador</span><strong>Partido {firstQuarter}</strong></div>
                            <div className="bracket-slot"><span>Ganador</span><strong>Partido {secondQuarter}</strong></div>
                          </article>
                        );
                      })}
                    </div>
                  </section>

                  <div className="bracket-advance-arrows final-arrow" aria-hidden="true"><span>⟶</span></div>

                  <section className="bracket-stage bracket-final" aria-label="Final">
                    <header className="bracket-stage-heading">
                      <h4>{phaseTwoEvents.playoffs[2].title}</h4>
                      <time dateTime={phaseTwoEvents.playoffs[2].date}>{formatPhaseDate(phaseTwoEvents.playoffs[2].date)}</time>
                    </header>
                    <div className="bracket-match-stack final-stack">
                      {phaseTwoEvents.playoffs[2].matches.map((match) => (
                        <article className="bracket-match bracket-match-final" key={match.label}>
                          <header><span>{match.label}</span><time>{match.time}</time></header>
                          <div className="bracket-slot"><span>Ganador Partido 5</span><strong>Pendiente</strong></div>
                          <div className="bracket-slot"><span>Ganador Partido 6</span><strong>Pendiente</strong></div>
                          <span className="bracket-trophy" aria-hidden="true">🏆</span>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </section>
          </section> : null}
        </>
      )}
    </main>
  );
}
