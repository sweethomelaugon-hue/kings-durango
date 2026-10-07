"use client";

import { useEffect, useState } from "react";
import type { LeagueInformationRecord, LeagueInformationSection } from "@/lib/league-information";
import { leagueInformationSections } from "@/lib/league-information";

type InformationRow = LeagueInformationRecord;

type InformationSubsection = { title: string; paragraphs: string[]; bullets: string[] };
type InformationPhase = { title: string; paragraphs: string[]; bullets: string[]; subsections: InformationSubsection[] };

function parseInformationPhases(content: string): InformationPhase[] | null {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.some((line) => line.startsWith("## "))) {
    return null;
  }

  const phases: InformationPhase[] = [];
  let currentPhase: InformationPhase | null = null;
  let currentSubsection: InformationSubsection | null = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      currentPhase = { title: line.slice(3).trim(), paragraphs: [], bullets: [], subsections: [] };
      phases.push(currentPhase);
      currentSubsection = null;
    } else if (line.startsWith("### ")) {
      if (!currentPhase) {
        currentPhase = { title: "Información", paragraphs: [], bullets: [], subsections: [] };
        phases.push(currentPhase);
      }
      currentSubsection = { title: line.slice(4).trim(), paragraphs: [], bullets: [] };
      currentPhase.subsections.push(currentSubsection);
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      const bullet = line.slice(2).trim();
      if (currentSubsection) {
        currentSubsection.bullets.push(bullet);
      } else if (currentPhase) {
        currentPhase.bullets.push(bullet);
      }
    } else if (currentSubsection) {
      currentSubsection.paragraphs.push(line);
    } else if (currentPhase) {
      currentPhase.paragraphs.push(line);
    }
  }

  return phases.length > 0 ? phases : null;
}

function LeagueInformationContent({ content }: { content: string }) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const phases = lines.map((line) => {
    const match = line.match(/^[•*-]?\s*(Fase\s+\d+)\s*:\s*(.+)$/i);
    return match ? { label: match[1], criteria: match[2].split(",").map((item) => item.trim()).filter(Boolean) } : null;
  });

  if (phases.length > 0 && phases.every((phase) => phase !== null)) {
    return (
      <ol className="league-info-phases">
        {phases.map((phase, phaseIndex) => phase ? (
          <li className="league-info-phase" key={`${phase.label}-${phaseIndex}`}>
            <header className="league-info-phase-heading">
              <span className="league-info-phase-index">{String(phaseIndex + 1).padStart(2, "0")}</span>
              <h3>{phase.label}</h3>
            </header>
            <ol className="league-info-criteria">
              {phase.criteria.map((criterion, criterionIndex) => (
                <li key={`${criterion}-${criterionIndex}`}>
                  <span className="league-info-criterion-order">{criterionIndex + 1}</span>
                  <span>{criterion}</span>
                </li>
              ))}
            </ol>
          </li>
        ) : null)}
      </ol>
    );
  }

  const informationPhases = parseInformationPhases(content);
  if (informationPhases) {
    return (
      <div className="league-info-outline">
        {informationPhases.map((phase, phaseIndex) => (
          <article className={`league-info-outline-phase phase-${phaseIndex + 1}`} key={`${phase.title}-${phaseIndex}`}>
            <header className="league-info-outline-heading">
              <span>{String(phaseIndex + 1).padStart(2, "0")}</span>
              <h3>{phase.title}</h3>
            </header>
            {phase.paragraphs.map((paragraph, index) => <p className="league-info-outline-intro" key={index}>{paragraph}</p>)}
            {phase.bullets.length > 0 ? (
              <ul className="league-info-outline-list">
                {phase.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}
              </ul>
            ) : null}
            {phase.subsections.map((subsection, subsectionIndex) => (
              <section className="league-info-outline-topic" key={`${subsection.title}-${subsectionIndex}`}>
                <h4>{subsection.title}</h4>
                {subsection.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                {subsection.bullets.length > 0 ? (
                  <ul className="league-info-outline-list">
                    {subsection.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}
                  </ul>
                ) : null}
              </section>
            ))}
          </article>
        ))}
      </div>
    );
  }

  return <div className="league-info-copy">{content}</div>;
}

export function LeagueInformationButton({ section }: { section: LeagueInformationSection }) {
  const [isOpen, setIsOpen] = useState(false);
  const [information, setInformation] = useState<InformationRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/league-information", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "No se pudo cargar la información.");
        }
        return payload;
      })
      .then((payload) => {
        if (!active) {
          return;
        }
        const row = Array.isArray(payload?.data)
          ? payload.data.find((entry: InformationRow) => entry.sectionKey === section)
          : undefined;
        const defaultInformation = leagueInformationSections.find((entry) => entry.key === section);
        const hasSavedContent = typeof row?.content === "string" && row.content.trim().length > 0;
        setInformation(row && hasSavedContent ? {
          sectionKey: section,
          title: row.title,
          content: row.content,
        } : {
          sectionKey: section,
          title: defaultInformation?.title ?? "Información y normativa",
          content: defaultInformation && "content" in defaultInformation ? defaultInformation.content : "",
        });
      })
      .catch((fetchError: unknown) => {
        if (active) {
          const defaultInformation = leagueInformationSections.find((entry) => entry.key === section);
          if (defaultInformation && "content" in defaultInformation && defaultInformation.content) {
            setInformation({
              sectionKey: section,
              title: defaultInformation.title,
              content: defaultInformation.content,
            });
          } else {
            setError(fetchError instanceof Error ? fetchError.message : "No se pudo cargar la información.");
          }
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [section]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (isLoading || !information?.content.trim()) {
    return null;
  }

  return (
    <>
      <button type="button" className="league-info-button" onClick={() => setIsOpen(true)} aria-label="Abrir información y normativa">
        <span aria-hidden="true">ⓘ</span>
        <span>Información</span>
      </button>
      {isOpen ? (
        <div className="league-info-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setIsOpen(false);
          }
        }}>
          <section className="league-info-dialog" role="dialog" aria-modal="true" aria-labelledby="league-info-title">
            <header className="league-info-dialog-header">
              <div>
                <p className="eyebrow">Kings Durango · Normativa</p>
                <h2 id="league-info-title">{information?.title ?? "Información y normativa"}</h2>
              </div>
              <button type="button" className="league-info-close" onClick={() => setIsOpen(false)} aria-label="Cerrar información">×</button>
            </header>
            <div className="league-info-content" aria-live="polite">
              {isLoading ? <p className="empty-state">Cargando información…</p> : null}
              {error ? <p className="empty-state error">{error}</p> : null}
              {!isLoading && !error ? information?.content
                ? <LeagueInformationContent content={information.content} />
                : <p className="empty-state">Todavía no hay información publicada para este apartado.</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}