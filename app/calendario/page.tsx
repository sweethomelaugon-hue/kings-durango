"use client";

import Link from "next/link";
import { TeamIdentity } from "@/lib/team-identity";
import { useEffect, useMemo, useState } from "react";

type CalendarRound = {
  id: number;
  title: string;
  date: string;
  status: "completed" | "in-progress" | "upcoming";
  matches: Array<{ time: string; home: string; away: string; stadium?: string; result?: string; }>;
  descansan: string[];
};

export default function CalendarioPage() {
  const [showCompleted, setShowCompleted] = useState(true);
  const [calendar, setCalendar] = useState<CalendarRound[]>([]);
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

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Competiciones</p>
          <h1>Calendario Kings 2026/27</h1>
        </div>
        <div className="calendar-tools">
          <button type="button" className="button button-secondary" onClick={() => setShowCompleted((value) => !value)}>{showCompleted ? "Ocultar finalizadas" : "Mostrar finalizadas"}</button>
          <Link href="/" className="button button-secondary">Volver al inicio</Link>
        </div>
      </header>

      {loading && <p className="empty-state">Cargando calendario…</p>}
      {error && <p className="empty-state error">{error}</p>}

      {!loading && !error && (
        <section className="calendar-list">
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
        </section>
      )}
    </main>
  );
}
