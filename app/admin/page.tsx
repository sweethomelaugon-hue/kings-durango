"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  adminSummary,
  calendar as initialCalendar,
  matches as initialMatches,
  sanctions as initialSanctions,
  teams,
} from "@/lib/league-data";
import { teamColors } from "@/lib/league-data";
import { dedupeActiveDisciplineStatus, getDisciplineStatus, getYellowCardsForPlayer, recalculateSuspensionRemaining } from "@/lib/discipline";
import type { SeasonRecord, TeamRecord } from "@/lib/league-store";
import { clearAuthSession, isAdminSession, readAuthSession } from "@/lib/auth";
import { buildAdminHeaders } from "@/lib/supabase";
import { TeamIdentity } from "@/lib/team-identity";

type CardType = "Amarilla" | "Doble amarilla" | "Roja" | "Otra";
type SanctionReason = "Motivos deportivos" | "Motivos antideportivos" | "Motivos de vestimenta/indumentaria no oficial" | "Otros motivos";
type SuspensionReason = "Encararse con otro jugador" | "Insultar o faltar al respeto al árbitro" | "Motivo deportivo violento" | "Otro motivo";
type ExpenseType = "gasto" | "cobro";
type RoundStatus = "completed" | "in-progress" | "upcoming";

type RoundEditor = {
  id: number;
  title: string;
  date: string;
  status: RoundStatus;
  matches: Array<{ time: string; home: string; away: string; stadium?: string; result?: string; }>;
  descansan: string[];
};

type ResultDraft = {
  home: string;
  away: string;
  homeScorers: string[];
  awayScorers: string[];
  shootoutHome: string;
  shootoutAway: string;
  isFinalized?: boolean;
};

const resultDraftKey = (home: string, away: string) => `${home}::${away}`;

type ResultScorerPickerProps = {
  label: string;
  players: string[];
  selected: string[];
  onSelect: (player: string) => void;
  onRemove: (index: number) => void;
};

function ResultScorerPicker({ label, players, selected, onSelect, onRemove }: ResultScorerPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current && !ref.current.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={ref} className="result-scorer-picker" aria-label={label}>
      <button
        type="button"
        className={`result-scorer-trigger ${isOpen ? "is-open" : ""}`}
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <span>{selected.length > 0 ? `${selected.length} goleador${selected.length > 1 ? "es" : ""} seleccionado${selected.length > 1 ? "s" : ""}` : "Añadir goleador..."}</span>
        <span className="result-scorer-caret">▾</span>
      </button>

      {isOpen ? (
        <div className="result-scorer-menu" role="listbox" aria-label={label}>
          {players.length > 0 ? players.map((player) => (
            <button
              key={player}
              type="button"
              className="result-scorer-option"
              onClick={() => {
                onSelect(player);
                setIsOpen(false);
              }}
            >
              {player}
            </button>
          )) : (
            <span className="result-scorer-empty-option">Sin jugadores disponibles</span>
          )}
        </div>
      ) : null}

      {selected.length > 0 ? (
        <div className="result-scorer-chips">
          {Array.from(new Set(selected)).map((player) => {
            const count = selected.filter((candidate) => candidate === player).length;
            return (
              <button
                key={`${player}-${count}`}
                type="button"
                className="pill result-scorer-chip"
                onClick={() => onRemove(selected.lastIndexOf(player))}
                title="Quitar un gol de este jugador"
              >
                {player}{count > 1 ? ` · ${count} goles` : ""} ×
              </button>
            );
          })}
        </div>
      ) : (
        <span className="result-scorer-empty">Sin goleadores seleccionados</span>
      )}
    </div>
  );
}

const resultDraftFromMatch = (match: { home: string; away: string; score: string; status?: string; shootoutScore?: string; goalScorers?: Array<{ player: string; team: string; minute?: number }> }): ResultDraft => {
  const shootoutParts = match.shootoutScore?.split("-") ?? [];
  return {
    home: match.score === "-" ? "" : match.score.split("-")[0]?.trim() ?? "",
    away: match.score === "-" ? "" : match.score.split("-")[1]?.trim() ?? "",
    homeScorers: match.goalScorers?.filter((entry) => entry.team === match.home).map((entry) => entry.player) ?? [],
    awayScorers: match.goalScorers?.filter((entry) => entry.team === match.away).map((entry) => entry.player) ?? [],
    shootoutHome: shootoutParts[0]?.trim() ?? "",
    shootoutAway: shootoutParts[1]?.trim() ?? "",
    isFinalized: match.status === "finished" || (match.status === undefined && match.score !== "-"),
  };
};

type FinanceKind = "cuota" | "patrocinio" | "premio" | "otro";

type ExpenseItem = {
  id: number;
  concept: string;
  amount: number;
  type: ExpenseType;
  kind?: FinanceKind;
  category?: string;
  entity?: string;
  paid?: number;
  pending?: number;
  date?: string;
  status?: "planificado" | "pendiente" | "pagado";
  previousPaid?: number;
  settlementOnly?: boolean;
  teamName?: string;
  sponsorName?: string;
};

const initialSeasons: SeasonRecord[] = [
  { id: "season-2026", name: "Temporada 2026", yearStart: 2026, yearEnd: 2027, isActive: true },
];

const initialStoreTeams: TeamRecord[] = teams.map((team) => ({
  ...team,
  seasonId: initialSeasons[0].id,
  players: team.players.map((player) => ({
    ...player,
    teamId: team.id,
    seasonId: initialSeasons[0].id,
  })),
}));

const orderedCalendar = [...initialCalendar].sort((a, b) => {
  const statusPriority: Record<RoundStatus, number> = { "in-progress": 0, completed: 1, upcoming: 2 };
  const diff = statusPriority[a.status] - statusPriority[b.status];
  return diff !== 0 ? diff : b.id - a.id;
});

const initialRegistrationFees = Object.fromEntries(
  teams.map((team) => [team.name, 700])
) as Record<string, number>;

const initialPayments = Object.fromEntries(
  teams.map((team) => [team.name, 120])
) as Record<string, number>;

const initialExpenses: ExpenseItem[] = [
  { id: 1, concept: "Balones", amount: 160, type: "gasto" },
  { id: 2, concept: "Fichas de arbitraje", amount: 180, type: "gasto" },
  { id: 3, concept: "Inscripciones", amount: 190, type: "cobro" },
];

const sanctionPrices: Record<CardType, number> = {
  Amarilla: 30,
  "Doble amarilla": 60,
  Roja: 80,
  Otra: 120,
};

const defaultSanctionPoints = { yellow: 2, doubleYellow: 4, red: 5, other: 0 };

type AdminTab = "equipos" | "calendario" | "resultados" | "sanciones" | "economia";
type SaveFeedback = { type: "success" | "error"; message: string };

const adminTabs: Array<{ id: AdminTab; label: string }> = [
  { id: "equipos", label: "Equipos" },
  { id: "calendario", label: "Calendario" },
  { id: "resultados", label: "Resultados" },
  { id: "sanciones", label: "Sanciones" },
  { id: "economia", label: "Economía" },
];

const roundTimeOptions = ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
const shieldImageOptions = [
  "Aston Birras.png",
  "Gora Gora.png",
  "Gure FC.png",
  "Inter Panda.png",
  "Kalekantoi.png",
  "Lojanos.png",
  "Martxel Juniors.png",
  "Parceros.png",
  "Pitxi FC.png",
  "Rayo Forestal Internacional.png",
  "Tigres.png",
  "Zero Filtro.png",
];

function resolveSupabaseImageUrl(fileName: string): string {
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
}

const calendarMonthNames: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const coerceCalendarIsoDate = (value: string) => {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const plainMatch = normalized.match(/(\d{1,2})\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/i);
  if (plainMatch) {
    const day = Number(plainMatch[1]);
    const monthName = plainMatch[2].toLowerCase();
    const monthIndex = calendarMonthNames[monthName];

    if (Number.isInteger(monthIndex)) {
      const explicitYear = normalized.match(/(\d{4})/)?.[1];
      const inferredYear = ["enero", "febrero"].includes(monthName) ? 2027 : 2026;
      const year = explicitYear ? Number(explicitYear) : inferredYear;
      const date = new Date(year, monthIndex, day, 12, 0, 0);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    const localDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
};

const toIsoDateInput = (value: string) => coerceCalendarIsoDate(value);

const formatRoundDate = (value: string) => {
  if (!value) {
    return "Sin fecha";
  }

  const isoDate = coerceCalendarIsoDate(value);
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
};

export default function AdminPage() {
  const [adminToken, setAdminToken] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("resultados");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [seasons, setSeasons] = useState<SeasonRecord[]>(initialSeasons);
  const [storeTeams, setStoreTeams] = useState<TeamRecord[]>(initialStoreTeams);
  const [seasonForm, setSeasonForm] = useState({
    name: "Temporada 2026",
    yearStart: 2026,
    yearEnd: 2027,
    isActive: true,
  });
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [teamForm, setTeamForm] = useState({
    seasonId: initialSeasons[0].id,
    name: "",
    shortName: "",
    stadiumName: "Tabira",
    primaryColor: teamColors[teams[0]?.name]?.primary ?? "#117d5f",
    shieldImage: "",
  });
  const [playerForm, setPlayerForm] = useState({
    teamId: initialStoreTeams[0]?.id ?? "",
    name: "",
    dorsal: "",
    isGoalkeeper: false,
  });
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isPlayerDialogOpen, setIsPlayerDialogOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const activeSeason = useMemo(
    () => seasons.find((season) => season.isActive) ?? seasons[0] ?? initialSeasons[0],
    [seasons]
  );
  const visibleTeams = useMemo(
    () => storeTeams.filter((team) => (team.seasonId ?? activeSeason.id) === activeSeason.id),
    [activeSeason, storeTeams]
  );

  const currentRound = useMemo(
    () => orderedCalendar.find((round) => round.status === "in-progress") ?? orderedCalendar[0],
    []
  );

  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoadingStore, setIsLoadingStore] = useState(true);
  const [isSavingStore, setIsSavingStore] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const [matchResults, setMatchResults] = useState(initialMatches);
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>(() =>
    Object.fromEntries(initialMatches.map((match) => [resultDraftKey(match.home, match.away), resultDraftFromMatch(match)]))
  );

  useEffect(() => {
    const session = readAuthSession();
    const nextToken = session?.token ?? "";
    setAdminToken(nextToken);
    setIsAuthenticated(isAdminSession(session));
    setAuthError(null);
  }, []);

  const hasAdminAccess = useMemo(() => isAuthenticated && adminToken.trim().length > 0, [adminToken, isAuthenticated]);

  const assertAdminAccess = () => {
    if (!hasAdminAccess) {
      throw new Error("Debes iniciar sesión con un token de administración válido para editar la liga.");
    }
  };

  const persistLeagueStore = async (nextPayload: {
    seasons: SeasonRecord[];
    teams: TeamRecord[];
    matches: typeof matchResults;
    calendar: RoundEditor[];
    sanctions: typeof cardDocket;
    finances: {
      fees: Record<string, number>;
      payments: Record<string, number>;
      expenses: ExpenseItem[];
      costs: {
        yellow: number;
        doubleYellow: number;
        red: number;
        other: number;
      };
      points?: {
        yellow: number;
        doubleYellow: number;
        red: number;
        other: number;
      };
      yellowCardResetRoundId?: number;
    };
  }) => {
    if (!hasAdminAccess) {
      return;
    }

    setStoreError(null);
    setSaveFeedback(null);
    setIsSavingStore(true);

    try {
      const response = await fetch("/api/league", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAdminHeaders(adminToken),
        },
        body: JSON.stringify({
          ...nextPayload,
          finances: {
            ...nextPayload.finances,
            points: penaltyPoints,
          },
        }),
      });

      if (!response.ok) {
        const payloadError = await response.json().catch(() => null);
        throw new Error(payloadError?.error ?? "No se pudo guardar la información del admin");
      }
      setSaveFeedback({ type: "success", message: "Cambios guardados correctamente." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error guardando la liga";
      console.error("Error guardando la liga", error);
      setStoreError(message);
      setSaveFeedback({ type: "error", message: `No se han guardado los cambios: ${message}` });
      throw error;
    } finally {
      setIsSavingStore(false);
    }
  };

  const logoutAdmin = () => {
    clearAuthSession();
    setAdminToken("");
    setIsAuthenticated(false);
    setAuthError(null);
  };
  const autoStandings = useMemo(() => {
    const table = storeTeams.map((team) => ({
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
    }));

    matchResults.filter((match) => match.score && match.score !== "-").forEach((match) => {
      const [homeGoals, awayGoals] = match.score.split("-").map((value) => Number(value.trim()) || 0);
      const home = table.find((item) => item.team === match.home);
      const away = table.find((item) => item.team === match.away);
      if (!home || !away) {
        return;
      }

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
        const homeWonShootout = shootout.length === 2 && shootout[0] !== shootout[1] ? shootout[0] > shootout[1] : true;
        if (homeWonShootout) {
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
      .map((team) => ({ ...team, goalDifference: team.goalsFor - team.goalsAgainst }))
      .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team));
  }, [matchResults, storeTeams]);
  const [calendarRounds, setCalendarRounds] = useState<RoundEditor[]>(initialCalendar);
  const [cardDocket, setCardDocket] = useState(initialSanctions);
  const [registrationFees, setRegistrationFees] = useState<Record<string, number>>(initialRegistrationFees);
  const [teamPayments, setTeamPayments] = useState<Record<string, number>>(initialPayments);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>(initialExpenses);
  const [penaltyCosts, setPenaltyCosts] = useState({
    yellow: sanctionPrices.Amarilla,
    doubleYellow: sanctionPrices["Doble amarilla"],
    red: sanctionPrices.Roja,
    other: sanctionPrices.Otra,
  });
  const [penaltyPoints, setPenaltyPoints] = useState({ ...defaultSanctionPoints });
  const [yellowCardResetRoundId, setYellowCardResetRoundId] = useState<number | undefined>(undefined);

  const updatePenaltyPoints = (field: keyof typeof defaultSanctionPoints, value: number) => {
    setPenaltyPoints((previous) => ({ ...previous, [field]: value }));
    setPenaltyCosts((previous) => ({ ...previous, [field]: value }));
  };

  useEffect(() => {
    let isActive = true;

    async function loadStore() {
      try {
        setIsLoadingStore(true);
        setStoreError(null);

        const response = await fetch("/api/league", {
          cache: "no-store",
          headers: hasAdminAccess ? buildAdminHeaders(adminToken) : undefined,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "No se pudo cargar la liga desde el store.");
        }

        const payload = await response.json();
        const store = payload?.data;

        if (!store || !isActive) {
          return;
        }

        const canonicalTeams = Array.isArray(store.teams) && store.teams.length > 0 ? store.teams : initialStoreTeams;
        const canonicalSeasons = Array.isArray(store.seasons) && store.seasons.length > 0 ? store.seasons : initialSeasons;
        const nextActiveSeason = canonicalSeasons.find((season: SeasonRecord) => season.isActive) ?? canonicalSeasons[0] ?? initialSeasons[0];

        setSeasons(canonicalSeasons);
        setStoreTeams(canonicalTeams);
        const canonicalMatches = store.matches ?? initialMatches;
        setMatchResults(canonicalMatches);
        setResultDrafts(Object.fromEntries(canonicalMatches.map((match: typeof initialMatches[number]) => [resultDraftKey(match.home, match.away), resultDraftFromMatch(match)])));
        setCalendarRounds(store.calendar ?? initialCalendar);
        const loadedCalendar = store.calendar ?? initialCalendar;
        const defaultSanctionRound = loadedCalendar.find((round: RoundEditor) => round.status === "in-progress") ?? loadedCalendar.find((round: RoundEditor) => round.status === "upcoming") ?? [...loadedCalendar].reverse().find((round: RoundEditor) => round.status === "completed") ?? loadedCalendar[0];
        setCardForm((previous) => ({ ...previous, jornada: defaultSanctionRound?.title ?? previous.jornada }));
        setCardDocket(store.sanctions ?? initialSanctions);
        const loadedExpenses = (store.finances?.expenses ?? initialExpenses).map((item: ExpenseItem) => (
          item.category === "Cuota"
            ? { ...item, concept: "Abono cuota" }
            : item.kind === "patrocinio"
              ? { ...item, concept: "Abono patrocinio" }
            : item.category === "Premio campeón"
              ? { ...item, kind: "premio" as const, concept: "Pago cuota campeón" }
              : item
        ));
        const loadedFees = store.finances?.fees ?? initialRegistrationFees;
        const loadedPayments = store.finances?.payments ?? initialPayments;
        const championTeam = loadedExpenses.find((item: ExpenseItem) => item.category === "Premio campeón")?.entity;
        const recordedQuotaPayments = new Map<string, number>();
        loadedExpenses.forEach((item: ExpenseItem) => {
          if (item.type === "cobro" && item.category === "Cuota" && item.entity) {
            recordedQuotaPayments.set(item.entity, (recordedQuotaPayments.get(item.entity) ?? 0) + (Number(item.paid ?? item.amount) || 0));
          }
        });
        const reconciliationMovements: ExpenseItem[] = Object.entries(loadedPayments)
          .filter(([teamName, paid]) => teamName !== championTeam && Number(paid) > (recordedQuotaPayments.get(teamName) ?? 0))
          .map(([teamName, paid], index) => {
            const amount = Number(paid) - (recordedQuotaPayments.get(teamName) ?? 0);
            return {
              id: Date.now() + index,
              concept: "Abono cuota",
              amount,
              type: "cobro",
              kind: "cuota",
              category: "Cuota",
              entity: teamName,
              paid: amount,
              pending: 0,
              date: new Date().toISOString().slice(0, 10),
              status: "pagado",
            };
          });
        const reconciledExpenses = reconciliationMovements.length > 0
          ? [...reconciliationMovements, ...loadedExpenses]
          : loadedExpenses;
        setRegistrationFees(loadedFees);
        setTeamPayments(loadedPayments);
        const savedChampion = loadedExpenses.find((item: ExpenseItem) => item.category === "Premio campeón")?.entity;
        setQuotaForm((previous) => ({
          ...previous,
          teamName: savedChampion ?? canonicalTeams[0]?.name ?? previous.teamName,
        }));
        setExpenseItems(reconciledExpenses);
        if (reconciliationMovements.length > 0 && hasAdminAccess) {
          await persistLeagueStore({
            seasons: canonicalSeasons,
            teams: canonicalTeams,
            matches: canonicalMatches,
            calendar: loadedCalendar,
            sanctions: store.sanctions ?? initialSanctions,
            finances: {
              fees: loadedFees,
              payments: loadedPayments,
              expenses: reconciledExpenses,
              costs: store.finances?.costs ?? penaltyCosts,
            },
          });
        }
        setPenaltyCosts({
          yellow: store.finances?.points?.yellow ?? defaultSanctionPoints.yellow,
          doubleYellow: store.finances?.points?.doubleYellow ?? defaultSanctionPoints.doubleYellow,
          red: store.finances?.points?.red ?? defaultSanctionPoints.red,
          other: store.finances?.points?.other ?? defaultSanctionPoints.other,
        });
        setPenaltyPoints({
          yellow: store.finances?.points?.yellow ?? defaultSanctionPoints.yellow,
          doubleYellow: store.finances?.points?.doubleYellow ?? defaultSanctionPoints.doubleYellow,
          red: store.finances?.points?.red ?? defaultSanctionPoints.red,
          other: store.finances?.points?.other ?? defaultSanctionPoints.other,
        });
        setYellowCardResetRoundId(store.finances?.yellowCardResetRoundId);
        setSeasonForm({
          name: nextActiveSeason.name,
          yearStart: nextActiveSeason.yearStart,
          yearEnd: nextActiveSeason.yearEnd,
          isActive: nextActiveSeason.isActive,
        });
        setTeamForm((previous) => ({
          ...previous,
          seasonId: nextActiveSeason.id,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error cargando la liga desde el store";
        console.error("Error cargando la liga desde el store", error);
        setStoreError(message);
      } finally {
        if (isActive) {
          setIsLoadingStore(false);
          setIsHydrated(true);
        }
      }
    }

    loadStore();

    return () => {
      isActive = false;
    };
  }, [adminToken, hasAdminAccess]);

  const [resultForm, setResultForm] = useState({
    matchId: initialMatches[0]?.id ?? 1,
    home: "2",
    away: "1",
    scorers: "G. Ramos 18', 73'",
  });
  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);

  const [teamSearch, setTeamSearch] = useState("");
  const [calendarSearch, setCalendarSearch] = useState("");
  const [calendarPage, setCalendarPage] = useState(1);
  const [resultsSearch, setResultsSearch] = useState("");
  const [sanctionsSearch, setSanctionsSearch] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");

  const [cardForm, setCardForm] = useState({
    player: initialStoreTeams[0]?.players[0]?.name ?? "",
    team: initialStoreTeams[0]?.name ?? "Aston Birras",
    card: "Amarilla" as CardType,
    reason: "Motivos deportivos" as SanctionReason,
    jornada: initialCalendar.find((round) => round.status === "in-progress")?.title ?? initialCalendar.find((round) => round.status === "completed")?.title ?? "Jornada 1",
    manualAmount: "",
    suspensionReason: "Encararse con otro jugador" as SuspensionReason,
    suspensionMatches: "",
  });
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [isSanctionDialogOpen, setIsSanctionDialogOpen] = useState(false);

  const getCardCost = (card: CardType, reason = "", manualAmount = "") => {
    return getSanctionPoints(card, reason, manualAmount);
  };

  const getSanctionPoints = (card: CardType, reason: string, manualAmount = "") => {
    if ((card === "Otra" || /otros motivos/i.test(reason)) && manualAmount.trim() !== "") {
      return Number(manualAmount) || 0;
    }
    if (card === "Roja" && /antideportiv/i.test(reason)) {
      return penaltyPoints.red * 2;
    }
    return card === "Amarilla" ? penaltyPoints.yellow : card === "Doble amarilla" ? penaltyPoints.doubleYellow : card === "Roja" ? penaltyPoints.red : penaltyPoints.other;
  };

  const playerRosterByTeam = useMemo(
    () =>
      Object.fromEntries(
        storeTeams.map((team) => [team.name, team.players.map((player) => player.name)])
      ) as Record<string, string[]>,
    [storeTeams]
  );

  const selectedTeamPlayers = useMemo(
    () => {
      const players = playerRosterByTeam[cardForm.team] ?? [];
      const normalizedSearch = playerSearch.trim().toLowerCase();
      return normalizedSearch
        ? players.filter((player) => player.toLowerCase().includes(normalizedSearch))
        : players;
    },
    [cardForm.team, playerSearch, playerRosterByTeam]
  );

  const sanctionRounds = useMemo(
    () => calendarRounds.filter((round) => round.status !== "upcoming" && matchResults.some((match) =>
      match.jornada === round.title
      && (match.home === cardForm.team || match.away === cardForm.team)
      && Boolean(match.score && match.score !== "-")
    )),
    [calendarRounds, cardForm.team, matchResults]
  );
  const effectiveSanctionJornada = sanctionRounds.some((round) => round.title === cardForm.jornada)
    ? cardForm.jornada
    : sanctionRounds[0]?.title ?? "";

  const selectedPlayerYellowCards = useMemo(
    () => getYellowCardsForPlayer(cardDocket, calendarRounds, cardForm.team, cardForm.player, yellowCardResetRoundId),
    [cardDocket, calendarRounds, cardForm.player, cardForm.team, yellowCardResetRoundId]
  );

  const searchableTeams = useMemo(() => {
    const normalizedSearch = teamSearch.trim().toLowerCase();
    return normalizedSearch
      ? storeTeams.filter((team) => team.name.toLowerCase().includes(normalizedSearch))
      : storeTeams;
  }, [storeTeams, teamSearch]);

  const searchableCalendarRounds = useMemo(() => {
    const normalizedSearch = calendarSearch.trim().toLowerCase();
    return normalizedSearch
      ? calendarRounds.filter((round) =>
          round.title.toLowerCase().includes(normalizedSearch)
          || round.date.toLowerCase().includes(normalizedSearch)
          || round.matches.some((match) =>
              match.home.toLowerCase().includes(normalizedSearch)
              || match.away.toLowerCase().includes(normalizedSearch)
          )
        )
      : calendarRounds;
  }, [calendarRounds, calendarSearch]);

  const calendarPageSize = 5;
  const totalCalendarPages = Math.max(1, Math.ceil(searchableCalendarRounds.length / calendarPageSize));

  useEffect(() => {
    setCalendarPage(1);
  }, [calendarSearch]);

  useEffect(() => {
    setCalendarPage((currentPage) => Math.min(currentPage, totalCalendarPages));
  }, [totalCalendarPages]);

  const visibleCalendarRounds = useMemo(() => {
    const start = (calendarPage - 1) * calendarPageSize;
    return searchableCalendarRounds.slice(start, start + calendarPageSize);
  }, [calendarPage, calendarPageSize, searchableCalendarRounds]);

  const searchableResults = useMemo(() => {
    const normalizedSearch = resultsSearch.trim().toLowerCase();
    return normalizedSearch
      ? matchResults.filter((match) =>
          match.home.toLowerCase().includes(normalizedSearch)
          || match.away.toLowerCase().includes(normalizedSearch)
          || match.score.toLowerCase().includes(normalizedSearch)
        )
      : matchResults;
  }, [matchResults, resultsSearch]);

  const resultRounds = useMemo(() => {
    return calendarRounds
      .map((round) => {
        const linkedMatches = round.matches.map((fixture) => matchResults.find(
          (match) => match.home === fixture.home && match.away === fixture.away
        ));
        const completedMatches = linkedMatches.filter((match) => match && (match.status === "finished" || (!match.status && match.score !== "-"))).length;
        const isFinalized = round.status === "completed" && round.matches.length > 0 && completedMatches === round.matches.length;

        return {
          round,
          linkedMatches,
          completedMatches,
          isFinalized,
        };
      })
      .sort((a, b) => {
        if (a.isFinalized !== b.isFinalized) {
          return a.isFinalized ? 1 : -1;
        }

        return toIsoDateInput(a.round.date).localeCompare(toIsoDateInput(b.round.date));
      });
  }, [calendarRounds, matchResults]);

  const currentResultRound = resultRounds.find((entry) => !entry.isFinalized) ?? resultRounds[0];

  const searchableSanctions = useMemo(() => {
    const normalizedSearch = sanctionsSearch.trim().toLowerCase();
    return normalizedSearch
      ? cardDocket.filter((record) =>
          record.player.toLowerCase().includes(normalizedSearch)
          || record.team.toLowerCase().includes(normalizedSearch)
          || record.card.toLowerCase().includes(normalizedSearch)
          || record.reason.toLowerCase().includes(normalizedSearch)
        )
      : cardDocket;
  }, [cardDocket, sanctionsSearch]);

  const currentSanctions = useMemo(() => {
    const currentRound = calendarRounds.find((round) => round.status === "in-progress")
      ?? calendarRounds.find((round) => round.status === "upcoming")
      ?? [...calendarRounds].filter((round) => round.status === "completed").sort((a, b) => b.id - a.id)[0];
    if (!currentRound) {
      return [];
    }

    return dedupeActiveDisciplineStatus(getDisciplineStatus(cardDocket, calendarRounds, currentRound.id, yellowCardResetRoundId));
  }, [calendarRounds, cardDocket, yellowCardResetRoundId]);

  const accumulatedYellowCards = useMemo(() => {
    const currentRound = calendarRounds.find((round) => round.status === "in-progress")
      ?? calendarRounds.find((round) => round.status === "upcoming")
      ?? [...calendarRounds].filter((round) => round.status === "completed").sort((a, b) => b.id - a.id)[0];
    if (!currentRound) {
      return [];
    }

    const byPlayer = new Map<string, { player: string; team: string; yellowCards: number }>();
    getDisciplineStatus(cardDocket, calendarRounds, currentRound.id, yellowCardResetRoundId).forEach((record) => {
      if (record.yellowCards <= 0 || record.suspensionRemaining > 0) {
        return;
      }

      const key = `${record.team.toLowerCase()}::${record.player.toLowerCase()}`;
      const current = byPlayer.get(key);
      if (!current || record.yellowCards > current.yellowCards) {
        byPlayer.set(key, { player: record.player, team: record.team, yellowCards: record.yellowCards });
      }
    });

    return Array.from(byPlayer.values()).sort((a, b) => b.yellowCards - a.yellowCards || a.player.localeCompare(b.player));
  }, [calendarRounds, cardDocket, yellowCardResetRoundId]);

  const latestRoundSanctions = useMemo(() => {
    const latestCompletedRound = [...calendarRounds]
      .filter((round) => round.status === "completed")
      .sort((a, b) => b.id - a.id)[0];
    if (!latestCompletedRound) {
      return { roundTitle: "Sin jornada finalizada", records: [], total: 0 };
    }

    const records = cardDocket.filter((record) => record.jornada === latestCompletedRound.title);
    return {
      roundTitle: latestCompletedRound.title,
      records,
      total: records.reduce((sum, record) => sum + Number(record.costAmount ?? record.cost_amount ?? 0), 0),
    };
  }, [calendarRounds, cardDocket]);

  const teamSanctionPoints = useMemo(() => {
    const totals = new Map<string, number>(storeTeams.map((team) => [team.name, 0]));
    cardDocket.forEach((record) => {
      totals.set(record.team, (totals.get(record.team) ?? 0) + Number(record.points ?? record.pointsAmount ?? 0));
    });
    return Array.from(totals.entries()).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  }, [cardDocket, storeTeams]);

  const deleteSanction = async (recordId: number) => {
    const record = cardDocket.find((item) => item.id === recordId);
    const confirmed = window.confirm(`Vas a eliminar la sanción de ${record?.player ?? "este jugador"}. Esta acción actualizará el historial y el Fair Play. ¿Quieres continuar?`);
    if (!confirmed) {
      return;
    }

    const nextSanctions = cardDocket.filter((item) => item.id !== recordId);
    setCardDocket(nextSanctions);
    try {
      await persistLeagueStore({
        seasons,
        teams: storeTeams,
        matches: matchResults,
        calendar: calendarRounds,
        sanctions: nextSanctions,
        finances: {
          fees: registrationFees,
          payments: teamPayments,
          expenses: expenseItems,
          costs: penaltyCosts,
        },
      });
      if (editingCardId === recordId) {
        resetCardForm();
      }
    } catch {
      setCardDocket(cardDocket);
    }
  };

  const resetYellowCardCount = async () => {
    const currentRound = calendarRounds.find((round) => round.status === "in-progress")
      ?? calendarRounds.find((round) => round.status === "upcoming")
      ?? [...calendarRounds].filter((round) => round.status === "completed").sort((a, b) => b.id - a.id)[0];
    if (!currentRound) {
      setFormError("No hay una jornada activa desde la que reiniciar el contador.");
      return;
    }

    const confirmed = window.confirm(`Se reiniciará el contador de amarillas para todos los jugadores desde ${currentRound.title}. El historial no se borrará. ¿Quieres continuar?`);
    if (!confirmed) {
      return;
    }

    const previousResetRoundId = yellowCardResetRoundId;
    setYellowCardResetRoundId(currentRound.id);
    try {
      await persistLeagueStore({
        seasons,
        teams: storeTeams,
        matches: matchResults,
        calendar: calendarRounds,
        sanctions: cardDocket,
        finances: {
          fees: registrationFees,
          payments: teamPayments,
          expenses: expenseItems,
          costs: penaltyCosts,
          yellowCardResetRoundId: currentRound.id,
        },
      });
    } catch {
      setYellowCardResetRoundId(previousResetRoundId);
    }
  };

  const [roundForm, setRoundForm] = useState({
    title: "Jornada 15",
    date: new Date().toISOString().slice(0, 10),
    time: "16:00",
    matches: [
      {
        time: "16:00",
        home: initialStoreTeams[0]?.name ?? "Aston Birras",
        away: initialStoreTeams[1]?.name ?? "Kalekantoi",
      },
    ],
  });
  const [editingRoundId, setEditingRoundId] = useState<number | null>(null);
  const [isRoundDialogOpen, setIsRoundDialogOpen] = useState(false);

  const [economyTab, setEconomyTab] = useState<"cuotas" | "patrocinadores" | "otros">("cuotas");
  const [quotaForm, setQuotaForm] = useState({
    teamName: initialStoreTeams[0]?.name ?? "",
    cuotaBase: 700,
  });
  const [sponsorForm, setSponsorForm] = useState({
    sponsorName: "",
    suggestedSponsor: "",
    expectedAmount: "",
    receivedAmount: "0",
    date: new Date().toISOString().slice(0, 10),
  });
  const [expenseForm, setExpenseForm] = useState({
    concept: "Balones",
    entity: "Material",
    amount: "120",
    paid: "0",
    type: "gasto" as ExpenseType,
    category: "Gasto",
    date: new Date().toISOString().slice(0, 10),
    status: "pendiente" as "planificado" | "pendiente" | "pagado",
  });
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [movementFilter, setMovementFilter] = useState<"todos" | FinanceKind>("todos");
  const [movementSearch, setMovementSearch] = useState("");
  const [inlineMovementDrafts, setInlineMovementDrafts] = useState<Record<number, Partial<ExpenseItem>>>({});
  const [quotaPaidDrafts, setQuotaPaidDrafts] = useState<Record<string, string>>({});

  const playedMatches = useMemo(() => matchResults.filter((match) => match.score !== "-").length, [matchResults]);
  const pendingMatches = useMemo(() => matchResults.filter((match) => match.score === "-").length, [matchResults]);

  const penaltyBalance = useMemo(() => {
    const totals: Record<string, number> = {};

    storeTeams.forEach((team) => {
      totals[team.name] = 0;
    });

    cardDocket.forEach((card) => {
      const amount =
        card.card === "Amarilla"
          ? penaltyCosts.yellow
          : card.card === "Doble amarilla"
            ? penaltyCosts.doubleYellow
            : card.card === "Roja"
              ? penaltyCosts.red * (/antideportiv/i.test(card.reason) ? 2 : 1)
              : penaltyCosts.other;
      totals[card.team] = (totals[card.team] ?? 0) + amount;
    });

    return totals;
  }, [cardDocket, penaltyCosts, storeTeams]);

  const economicSummary = useMemo(() => {
    return storeTeams.map((team) => {
      const registrationFee = registrationFees[team.name] ?? 0;
      const paid = teamPayments[team.name] ?? 0;
      const penalty = penaltyBalance[team.name] ?? 0;
      const remaining = registrationFee + penalty - paid;
      const status: "Pendiente" | "Parcial" | "Pagado" = remaining <= 0 ? "Pagado" : remaining < registrationFee ? "Parcial" : "Pendiente";

      return {
        team: team.name,
        total: registrationFee + penalty,
        paid,
        pending: Math.max(remaining, 0),
        status,
      };
    });
  }, [penaltyBalance, registrationFees, teamPayments, storeTeams]);

  const allSponsors = useMemo(
    () => Array.from(new Set(expenseItems.filter((item) => item.kind === "patrocinio" && (item.entity || item.sponsorName)).map((item) => item.entity ?? item.sponsorName ?? "Sin patrocinador"))).sort((a, b) => a.localeCompare(b)),
    [expenseItems]
  );

  const sponsorTotalsByEntity = useMemo(() => {
    const totals = new Map<string, { amount: number; paid: number }>();
    expenseItems.forEach((item) => {
      if (item.kind !== "patrocinio") {
        return;
      }
      const entity = item.entity?.trim() || item.sponsorName?.trim() || "Sin patrocinador";
      const current = totals.get(entity) ?? { amount: 0, paid: 0 };
      totals.set(entity, {
        amount: current.amount + (item.settlementOnly ? 0 : Number(item.amount) || 0),
        paid: current.paid + (Number(item.paid ?? 0) || 0),
      });
    });
    return totals;
  }, [expenseItems]);

  const saveInlineMovement = async (item: ExpenseItem) => {
    const draft = inlineMovementDrafts[item.id] ?? item;
    const nextKind = (draft.kind ?? item.kind ?? "otro") as FinanceKind;
    const nextType: ExpenseType = nextKind === "cuota" || nextKind === "patrocinio"
      ? "cobro"
      : (draft.type ?? item.type);
    const nextMovement = {
      ...item,
      ...draft,
      kind: nextKind,
      type: nextType,
      concept: nextKind === "cuota" ? "Abono cuota" : nextKind === "patrocinio" ? "Abono patrocinio" : nextKind === "premio" ? "Pago cuota campeón" : (draft.concept ?? item.concept).trim() || item.concept,
      entity: (draft.entity ?? item.entity ?? "").trim() || "Sin entidad",
      amount: Number(draft.amount ?? item.amount) || 0,
      paid: Math.min(Number(draft.paid ?? item.paid ?? 0) || 0, Number(draft.amount ?? item.amount) || 0),
      pending: Math.max((Number(draft.amount ?? item.amount) || 0) - (Number(draft.paid ?? item.paid ?? 0) || 0), 0),
      status: (draft.paid ?? item.paid ?? 0) >= (draft.amount ?? item.amount)
        ? "pagado"
        : (draft.status ?? item.status ?? "pendiente"),
    } as ExpenseItem;

    const nextExpenses = expenseItems.map((entry) => entry.id === item.id ? nextMovement : entry);
    const nextPayments = { ...teamPayments };
    if (item.type === "cobro" && item.category === "Cuota" && item.entity) {
      nextPayments[item.entity] = Math.max((nextPayments[item.entity] ?? 0) - (item.paid ?? item.amount ?? 0), 0);
    }
    if (nextMovement.type === "cobro" && nextMovement.kind === "cuota" && nextMovement.entity) {
      nextPayments[nextMovement.entity] = Math.min(
        (nextPayments[nextMovement.entity] ?? 0) + (nextMovement.paid ?? nextMovement.amount ?? 0),
        registrationFees[nextMovement.entity] ?? quotaForm.cuotaBase
      );
    }
    setExpenseItems(nextExpenses);
    setTeamPayments(nextPayments);
    setInlineMovementDrafts((previous) => ({ ...previous, [item.id]: {} }));

    try {
      await persistLeagueStore({
        seasons,
        teams: storeTeams,
        matches: matchResults,
        calendar: calendarRounds,
        sanctions: cardDocket,
        finances: { fees: registrationFees, payments: nextPayments, expenses: nextExpenses, costs: penaltyCosts },
      });
    } catch {
      setExpenseItems(expenseItems);
      setTeamPayments(teamPayments);
    }
  };

  const exportMovementsToExcel = () => {
    const term = movementSearch.trim().toLowerCase();
    const movements = expenseItems.filter((item) => {
      const matchesType = movementFilter === "todos" || item.kind === movementFilter;
      const matchesSearch = !term || [item.concept, item.entity ?? "", item.category ?? ""].join(" ").toLowerCase().includes(term);
      return matchesType && matchesSearch;
    });
    const escapeCsvValue = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [
      ["Tipo", "Concepto", "Entidad", "Categoría", "Importe total", "Pagado / recibido", "Pendiente", "Fecha", "Estado"],
      ...movements.map((item) => {
        const amount = Number(item.amount) || 0;
        const paid = Number(item.paid ?? 0) || 0;
        const sponsorEntity = item.entity?.trim() || item.sponsorName?.trim() || "Sin patrocinador";
        const sponsorTotals = item.kind === "patrocinio" ? sponsorTotalsByEntity.get(sponsorEntity) : undefined;
        const pending = item.kind === "cuota" && item.entity
          ? Math.max((registrationFees[item.entity] ?? quotaForm.cuotaBase) - (teamPayments[item.entity] ?? 0), 0)
          : sponsorTotals
            ? Math.max(sponsorTotals.amount - sponsorTotals.paid, 0)
          : Math.max(amount - paid, 0);
        return [
          item.kind === "cuota" ? "Cuota" : item.kind === "patrocinio" ? "Patrocinio" : item.kind === "premio" ? "Premio" : "Otro",
          item.concept,
          item.entity ?? item.sponsorName ?? "",
          item.category ?? "",
          amount.toFixed(2),
          paid.toFixed(2),
          pending.toFixed(2),
          item.date ?? "",
          item.status ?? (paid >= amount ? "pagado" : "pendiente"),
        ];
      }),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsvValue).join(";")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `movimientos-liga-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const payPreviousChampionPrize = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      assertAdminAccess();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No tienes permisos para modificar la liga.");
      return;
    }

    const teamName = quotaForm.teamName.trim();
    const amount = registrationFees[teamName] ?? quotaForm.cuotaBase;
    const existingChampionPrize = expenseItems.find((item) => item.category === "Premio campeón");
    const previousChampion = existingChampionPrize?.entity;
    if (previousChampion === teamName) {
      setFormError(`Ya existe un premio registrado para ${teamName}.`);
      return;
    }

    const restoredPayments = { ...teamPayments };
    if (previousChampion) {
      restoredPayments[previousChampion] = Math.min(existingChampionPrize?.previousPaid ?? 0, registrationFees[previousChampion] ?? quotaForm.cuotaBase);
    }
    const previousPaid = restoredPayments[teamName] ?? 0;
    const nextPayments = { ...restoredPayments, [teamName]: amount };

    const championExpense: ExpenseItem = {
      id: Date.now(),
      concept: "Pago cuota campeón",
      amount,
      type: "gasto",
      kind: "premio",
      category: "Premio campeón",
      entity: teamName,
      paid: amount,
      pending: 0,
      date: new Date().toISOString().slice(0, 10),
      status: "pagado",
      previousPaid,
    };
    const nextExpenses = [championExpense, ...expenseItems.filter((item) => item !== existingChampionPrize)];
    setTeamPayments(nextPayments);
    setExpenseItems(nextExpenses);

    try {
      await persistLeagueStore({
        seasons,
        teams: storeTeams,
        matches: matchResults,
        calendar: calendarRounds,
        sanctions: cardDocket,
        finances: { fees: registrationFees, payments: nextPayments, expenses: nextExpenses, costs: penaltyCosts },
      });
      setFormError(null);
    } catch {
      setTeamPayments(teamPayments);
      setExpenseItems(expenseItems);
    }
  };

  const saveQuotaInstallment = async (teamName: string) => {
    try {
      assertAdminAccess();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No tienes permisos para modificar la liga.");
      return;
    }

    const expected = registrationFees[teamName] ?? quotaForm.cuotaBase;
    const currentPaid = teamPayments[teamName] ?? 0;
    const installment = Math.max(Number(quotaPaidDrafts[teamName] ?? 0) || 0, 0);
    const pendingAmount = Math.max(expected - currentPaid, 0);
    if (installment <= 0) {
      setFormError("Introduce un importe mayor que cero.");
      return;
    }
    if (installment > pendingAmount) {
      setFormError(`El importe no puede superar los €${pendingAmount} pendientes de ${teamName}.`);
      return;
    }

    const acceptedInstallment = installment;
    const nextPaid = currentPaid + acceptedInstallment;
    const nextPayments = { ...teamPayments, [teamName]: nextPaid };
    const quotaMovement: ExpenseItem = {
      id: Date.now(),
      concept: "Abono cuota",
      amount: acceptedInstallment,
      type: "cobro",
      kind: "cuota",
      category: "Cuota",
      entity: teamName,
      paid: acceptedInstallment,
      pending: 0,
      date: new Date().toISOString().slice(0, 10),
      status: "pagado",
    };
    const nextExpenses = [quotaMovement, ...expenseItems];
    setTeamPayments(nextPayments);
    setExpenseItems(nextExpenses);

    try {
      await persistLeagueStore({
        seasons,
        teams: storeTeams,
        matches: matchResults,
        calendar: calendarRounds,
        sanctions: cardDocket,
        finances: { fees: registrationFees, payments: nextPayments, expenses: nextExpenses, costs: penaltyCosts },
      });
      setQuotaPaidDrafts((previous) => ({ ...previous, [teamName]: "" }));
      setFormError(null);
    } catch {
      setTeamPayments(teamPayments);
      setExpenseItems(expenseItems);
    }
  };

  const deleteMovement = async (item: ExpenseItem) => {
    const confirmed = window.confirm(
      `Vas a eliminar el movimiento "${item.concept}"${item.entity ? ` de ${item.entity}` : ""} por €${item.amount}. Esta acción actualizará el histórico, las cuotas y la caja. ¿Quieres continuar?`
    );
    if (!confirmed) {
      return;
    }

    try {
      assertAdminAccess();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No tienes permisos para modificar la liga.");
      return;
    }

    const nextExpenses = expenseItems.filter((entry) => entry.id !== item.id);
    const isQuotaPayment = item.type === "cobro" && item.category === "Cuota" && Boolean(item.entity);
    const nextPayments = isQuotaPayment
      ? { ...teamPayments, [item.entity as string]: Math.max((teamPayments[item.entity as string] ?? 0) - (item.paid ?? item.amount), 0) }
      : teamPayments;
    setExpenseItems(nextExpenses);
    setTeamPayments(nextPayments);

    try {
      await persistLeagueStore({
        seasons,
        teams: storeTeams,
        matches: matchResults,
        calendar: calendarRounds,
        sanctions: cardDocket,
        finances: { fees: registrationFees, payments: nextPayments, expenses: nextExpenses, costs: penaltyCosts },
      });
    } catch {
      setExpenseItems(expenseItems);
      setTeamPayments(teamPayments);
    }
  };

  const saveGlobalQuota = async () => {
    try {
      assertAdminAccess();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No tienes permisos para modificar la liga.");
      return;
    }

    const nextFees = Object.fromEntries(storeTeams.map((team) => [team.name, quotaForm.cuotaBase]));
    setRegistrationFees(nextFees);

    try {
      await persistLeagueStore({
        seasons,
        teams: storeTeams,
        matches: matchResults,
        calendar: calendarRounds,
        sanctions: cardDocket,
        finances: { fees: nextFees, payments: teamPayments, expenses: expenseItems, costs: penaltyCosts },
      });
      setFormError(null);
    } catch {
      setRegistrationFees(registrationFees);
    }
  };

  const expectedQuotaByTeam = useMemo(
    () => Object.fromEntries(storeTeams.map((team) => [team.name, registrationFees[team.name] ?? 700])),
    [registrationFees, storeTeams]
  );

  const expectedIncomeFromQuota = useMemo(
    () => Object.values(expectedQuotaByTeam).reduce((sum, value) => sum + value, 0),
    [expectedQuotaByTeam]
  );

  const selectedQuotaTeam = useMemo(
    () => storeTeams.find((team) => team.name === quotaForm.teamName) ?? storeTeams[0],
    [quotaForm.teamName, storeTeams]
  );

  const quotaPendingSummary = useMemo(
    () => storeTeams
      .map((team) => {
        const expected = registrationFees[team.name] ?? quotaForm.cuotaBase;
        const paid = teamPayments[team.name] ?? 0;
        const pending = Math.max(expected - paid, 0);
        return {
          team: team.name,
          expected,
          paid,
          pending,
          status: pending <= 0 ? "Pagado" : paid > 0 ? "Parcial" : "Pendiente",
        };
      })
      .sort((a, b) => b.pending - a.pending || a.team.localeCompare(b.team)),
    [quotaForm.cuotaBase, registrationFees, storeTeams, teamPayments]
  );

  const currentQuotaIncome = useMemo(
    () => Object.values(teamPayments).reduce((sum, value) => sum + value, 0),
    [teamPayments]
  );

  const pendingQuotaIncome = useMemo(
    () => Math.max(expectedIncomeFromQuota - currentQuotaIncome, 0),
    [currentQuotaIncome, expectedIncomeFromQuota]
  );

  const expectedSponsorIncome = useMemo(
    () => expenseItems.filter((item) => item.kind === "patrocinio" && item.type === "cobro").reduce((sum, item) => sum + item.amount, 0),
    [expenseItems]
  );

  const currentSponsorIncome = useMemo(
    () => expenseItems.filter((item) => item.kind === "patrocinio" && item.type === "cobro").reduce((sum, item) => sum + (item.paid ?? 0), 0),
    [expenseItems]
  );

  const expectedOtherIncome = useMemo(
    () => expenseItems.filter((item) => item.kind === "otro" && item.type === "cobro").reduce((sum, item) => sum + item.amount, 0),
    [expenseItems]
  );

  const currentOtherIncome = useMemo(
    () => expenseItems.filter((item) => item.kind === "otro" && item.type === "cobro").reduce((sum, item) => sum + (item.paid ?? 0), 0),
    [expenseItems]
  );

  const expectedExpenseOutflow = useMemo(
    () => expenseItems.filter((item) => item.type === "gasto").reduce((sum, item) => sum + item.amount, 0) + Object.values(penaltyBalance).reduce((sum, value) => sum + value, 0),
    [expenseItems, penaltyBalance]
  );

  const currentExpenseOutflow = useMemo(
    () => expenseItems.filter((item) => item.type === "gasto").reduce((sum, item) => sum + (item.paid ?? 0), 0) + Object.values(penaltyBalance).reduce((sum, value) => sum + value, 0),
    [expenseItems, penaltyBalance]
  );

  const totalIncome = useMemo(
    () => currentQuotaIncome + currentSponsorIncome + currentOtherIncome,
    [currentOtherIncome, currentQuotaIncome, currentSponsorIncome]
  );

  const totalExpense = useMemo(
    () => currentExpenseOutflow,
    [currentExpenseOutflow]
  );

  const projectedIncome = useMemo(
    () => expectedIncomeFromQuota + expectedSponsorIncome + expectedOtherIncome,
    [expectedIncomeFromQuota, expectedOtherIncome, expectedSponsorIncome]
  );

  const projectedExpense = useMemo(
    () => expectedExpenseOutflow,
    [expectedExpenseOutflow]
  );

  const cashAvailable = totalIncome - totalExpense;
  const projectedCash = projectedIncome - projectedExpense;
  const totalPendingDebt = useMemo(
    () => economicSummary.reduce((sum, item) => sum + item.pending, 0),
    [economicSummary]
  );

  const pendingSponsorDebt = useMemo(
    () => expenseItems.filter((item) => item.kind === "patrocinio" && item.type === "cobro").reduce((sum, item) => sum + Math.max((item.amount ?? 0) - (item.paid ?? 0), 0), 0),
    [expenseItems]
  );


  const pendingOtherMovements = useMemo(
    () => expenseItems.filter((item) => item.kind === "otro" && item.type === "gasto").reduce((sum, item) => sum + Math.max((item.amount ?? 0) - (item.paid ?? 0), 0), 0),
    [expenseItems]
  );
  const currentRoundMatches = currentRound?.matches.length ?? 0;
  const currentRoundPendingResults = useMemo(() => {
    if (!currentRound?.matches?.length) {
      return 0;
    }

    return currentRound.matches.filter((fixture) => {
      const relatedMatch = matchResults.find(
        (match) => match.home === fixture.home && match.away === fixture.away
      );

      return !relatedMatch || relatedMatch.score === "-" || relatedMatch.score === "";
    }).length;
  }, [currentRound, matchResults]);

  const totalRegistrationFees = useMemo(
    () => Object.values(registrationFees).reduce((sum, value) => sum + value, 0),
    [registrationFees]
  );

  const pendingRegistrationFees = useMemo(
    () => totalRegistrationFees - Object.values(teamPayments).reduce((sum, value) => sum + value, 0),
    [teamPayments, totalRegistrationFees]
  );

  const totalSanctionBalance = useMemo(
    () => Object.values(penaltyBalance).reduce((sum, value) => sum + value, 0),
    [penaltyBalance]
  );

  const pendingSanctionBalance = totalSanctionBalance;

  const resetSeasonForm = () => {
    setEditingSeasonId(null);
    setSeasonForm({
      name: "",
      yearStart: 2026,
      yearEnd: 2027,
      isActive: true,
    });
  };

  const startEditSeason = (season: SeasonRecord) => {
    setEditingSeasonId(season.id);
    setSeasonForm({
      name: season.name,
      yearStart: season.yearStart,
      yearEnd: season.yearEnd,
      isActive: season.isActive,
    });
    setFormError(null);
  };

  const addSeason = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      assertAdminAccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No tienes permisos para modificar la liga.";
      setFormError(message);
      return;
    }

    const normalizedName = seasonForm.name.trim();
    if (!normalizedName) {
      setFormError("La temporada debe tener un nombre.");
      return;
    }

    if (editingSeasonId) {
      const nextSeasons = seasons.map((season) =>
        season.id === editingSeasonId
          ? {
              ...season,
              name: normalizedName,
              yearStart: Number(seasonForm.yearStart) || 2026,
              yearEnd: Number(seasonForm.yearEnd) || 2027,
              isActive: seasonForm.isActive,
            }
          : {
              ...season,
              isActive: seasonForm.isActive ? season.id === editingSeasonId : season.isActive,
            }
      );
      setSeasons(nextSeasons);
      setFormError(null);
      resetSeasonForm();
      try {
        await persistLeagueStore({
          seasons: nextSeasons,
          teams: storeTeams,
          matches: matchResults,
          calendar: calendarRounds,
          sanctions: cardDocket,
          finances: { fees: registrationFees, payments: teamPayments, expenses: expenseItems, costs: penaltyCosts },
        });
      } catch {
        setSeasons(seasons);
      }
      return;
    }

    const duplicate = seasons.some((season) => season.name.trim().toLowerCase() === normalizedName.toLowerCase());
    if (duplicate) {
      setFormError("No se puede crear una temporada con el mismo nombre.");
      return;
    }

    const nextSeason: SeasonRecord = {
      id: `season-${Date.now()}`,
      name: normalizedName,
      yearStart: Number(seasonForm.yearStart) || 2026,
      yearEnd: Number(seasonForm.yearEnd) || 2027,
      isActive: seasonForm.isActive,
    };

    const nextSeasons = (() => {
      const updatedSeasons = seasons.map((season) => ({
        ...season,
        isActive: seasonForm.isActive && season.id === nextSeason.id ? true : seasonForm.isActive ? false : season.isActive,
      }));

      if (nextSeason.isActive) {
        return [...updatedSeasons, nextSeason].map((season) => ({
          ...season,
          isActive: season.id === nextSeason.id,
        }));
      }

      return [...updatedSeasons, nextSeason];
    })();

    setSeasons(nextSeasons);

    setTeamForm((previous) => ({ ...previous, seasonId: nextSeason.id }));
    setPlayerForm((previous) => ({ ...previous, teamId: visibleTeams[0]?.id ?? previous.teamId }));
    setFormError(null);
    resetSeasonForm();
    try {
      await persistLeagueStore({
        seasons: nextSeasons,
        teams: storeTeams,
        matches: matchResults,
        calendar: calendarRounds,
        sanctions: cardDocket,
        finances: { fees: registrationFees, payments: teamPayments, expenses: expenseItems, costs: penaltyCosts },
      });
    } catch {
      setSeasons(seasons);
    }
  };

  const startEditTeam = (team: TeamRecord) => {
    setEditingTeamId(team.id);
    setTeamForm({
      seasonId: team.seasonId ?? activeSeason.id,
      name: team.name,
      shortName: team.shortName || team.short_name || "",
      stadiumName: team.stadiumName || team.stadium_name || "Tabira",
      primaryColor: team.primaryColor || teamColors[team.name]?.primary || "#117d5f",
      shieldImage: team.shieldImage || "",
    });
    setFormError(null);
  };

  const openTeamDialog = (team?: TeamRecord) => {
    if (team) {
      startEditTeam(team);
    } else {
      resetTeamForm();
      setEditingTeamId(null);
    }
    setIsTeamDialogOpen(true);
  };

  const resetTeamForm = () => {
    setEditingTeamId(null);
    setTeamForm({
      seasonId: activeSeason.id,
      name: "",
      shortName: "",
      stadiumName: "Tabira",
      primaryColor: "#117d5f",
      shieldImage: "",
    });
  };

  const addTeam = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      assertAdminAccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No tienes permisos para modificar la liga.";
      setFormError(message);
      return;
    }

    const normalizedName = teamForm.name.trim();
    const shortName = teamForm.shortName.trim();
    if (!normalizedName) {
      setFormError("El equipo debe tener un nombre.");
      return;
    }

    const seasonKey = teamForm.seasonId || activeSeason.id;

    let nextTeams: TeamRecord[];

    if (editingTeamId) {
      const previousTeam = storeTeams.find((team) => team.id === editingTeamId);
      const previousName = previousTeam?.name ?? normalizedName;
      const nameChanged = previousName !== normalizedName;
      nextTeams = storeTeams.map((team) =>
        team.id === editingTeamId
          ? {
              ...team,
              name: normalizedName,
              shortName: shortName || normalizedName.slice(0, 3).toUpperCase(),
              short_name: shortName || normalizedName.slice(0, 3).toUpperCase(),
              seasonId: seasonKey,
              stadiumName: teamForm.stadiumName || "Tabira",
              stadium_name: teamForm.stadiumName || "Tabira",
              primaryColor: teamForm.primaryColor || team.primaryColor || teamColors[normalizedName]?.primary || "#117d5f",
              shieldImage: teamForm.shieldImage || team.shieldImage,
              players: team.players.map((player) => ({
                ...player,
                seasonId: seasonKey,
              })),
            }
          : team
      );
      const nextMatches = nameChanged
        ? matchResults.map((match) => ({
            ...match,
            home: match.home === previousName ? normalizedName : match.home,
            away: match.away === previousName ? normalizedName : match.away,
            goalScorers: match.goalScorers?.map((scorer) => ({
              ...scorer,
              team: scorer.team === previousName ? normalizedName : scorer.team,
            })),
          }))
        : matchResults;
      const nextCalendar = nameChanged
        ? calendarRounds.map((round) => ({
            ...round,
            matches: round.matches.map((fixture) => ({
              ...fixture,
              home: fixture.home === previousName ? normalizedName : fixture.home,
              away: fixture.away === previousName ? normalizedName : fixture.away,
            })),
            descansan: round.descansan.map((teamName) => teamName === previousName ? normalizedName : teamName),
          }))
        : calendarRounds;
      const nextSanctions = nameChanged
        ? cardDocket.map((record) => ({ ...record, team: record.team === previousName ? normalizedName : record.team }))
        : cardDocket;
      const nextFees = nameChanged
        ? Object.fromEntries(Object.entries(registrationFees).map(([name, amount]) => [name === previousName ? normalizedName : name, amount]))
        : registrationFees;
      const nextPayments = nameChanged
        ? Object.fromEntries(Object.entries(teamPayments).map(([name, amount]) => [name === previousName ? normalizedName : name, amount]))
        : teamPayments;
      const nextExpenses = nameChanged
        ? expenseItems.map((item) => ({ ...item, entity: item.entity === previousName ? normalizedName : item.entity }))
        : expenseItems;
      setStoreTeams(nextTeams);
      setFormError(null);
      resetTeamForm();
      setIsTeamDialogOpen(false);
      try {
        await persistLeagueStore({
          seasons,
          teams: nextTeams,
          matches: nextMatches,
          calendar: nextCalendar,
          sanctions: nextSanctions,
          finances: {
            fees: nextFees,
            payments: nextPayments,
            expenses: nextExpenses,
            costs: penaltyCosts,
          },
        });
      } catch {
        setStoreTeams(storeTeams);
      }
      return;
    }

    const duplicate = storeTeams.some(
      (team) => (team.seasonId ?? activeSeason.id) === seasonKey && team.name.trim().toLowerCase() === normalizedName.toLowerCase()
    );
    if (duplicate) {
      setFormError("No se puede crear un equipo con el mismo nombre dentro de la temporada activa.");
      return;
    }

    const nextTeam: TeamRecord = {
      id: `team-${Date.now()}`,
      name: normalizedName,
      shortName: shortName || normalizedName.slice(0, 3).toUpperCase(),
      short_name: shortName || normalizedName.slice(0, 3).toUpperCase(),
      seasonId: seasonKey,
      stadiumName: teamForm.stadiumName || "Tabira",
      stadium_name: teamForm.stadiumName || "Tabira",
      primaryColor: teamForm.primaryColor || teamColors[normalizedName]?.primary || "#117d5f",
      shieldImage: teamForm.shieldImage || undefined,
      players: [],
    };

    nextTeams = [...storeTeams, nextTeam];
    setStoreTeams(nextTeams);
    setPlayerForm((previous) => ({ ...previous, teamId: nextTeam.id }));
    setFormError(null);
    resetTeamForm();
    setIsTeamDialogOpen(false);
    try {
      await persistLeagueStore({
        seasons,
        teams: nextTeams,
        matches: matchResults,
        calendar: calendarRounds,
        sanctions: cardDocket,
        finances: {
          fees: registrationFees,
          payments: teamPayments,
          expenses: expenseItems,
          costs: penaltyCosts,
        },
      });
    } catch {
      setStoreTeams(storeTeams);
    }
  };

  const startEditPlayer = (team: TeamRecord, player: { id?: string; name: string; dorsal: number | string; isGoalkeeper?: boolean }) => {
    const playerId = player.id ?? `${team.id}-${player.name}`;
    setEditingPlayerId(playerId);
    setPlayerForm({
      teamId: team.id,
      name: player.name,
      dorsal: String(player.dorsal ?? ""),
      isGoalkeeper: player.isGoalkeeper === true,
    });
    setFormError(null);
  };

  const openPlayerDialog = (team: TeamRecord, player?: { id?: string; name: string; dorsal: number | string; isGoalkeeper?: boolean }) => {
    if (player) {
      startEditPlayer(team, player);
    } else {
      setEditingPlayerId(null);
      setPlayerForm({
        teamId: team.id,
        name: "",
        dorsal: "",
        isGoalkeeper: false,
      });
    }
    setIsPlayerDialogOpen(true);
  };

  const resetPlayerForm = () => {
    setEditingPlayerId(null);
    setPlayerForm({
      teamId: visibleTeams[0]?.id ?? "",
      name: "",
      dorsal: "",
      isGoalkeeper: false,
    });
  };

  const addPlayer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      assertAdminAccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No tienes permisos para modificar la liga.";
      setFormError(message);
      return;
    }

    const team = storeTeams.find((candidate) => candidate.id === playerForm.teamId);
    if (!team) {
      setFormError("Debes seleccionar un equipo antes de añadir un jugador.");
      return;
    }

    const normalizedName = playerForm.name.trim();
    if (!normalizedName) {
      setFormError("El jugador debe tener un nombre.");
      return;
    }

    let nextTeams: TeamRecord[];

    if (editingPlayerId) {
      const previousPlayer = team.players.find((player) => (player.id ?? `${team.id}-${player.name}`) === editingPlayerId);
      const previousName = previousPlayer?.name ?? normalizedName;
      const nameChanged = previousName !== normalizedName;
      nextTeams = storeTeams.map((candidate) => {
        if (candidate.id !== team.id) {
          return candidate;
        }

        return {
          ...candidate,
          players: candidate.players.map((player) => {
            const currentPlayerId = player.id ?? `${candidate.id}-${player.name}`;
            return currentPlayerId === editingPlayerId
              ? {
                  ...player,
                  id: player.id ?? currentPlayerId,
                  name: normalizedName,
                  dorsal: playerForm.dorsal === "" ? 0 : Number(playerForm.dorsal) || playerForm.dorsal,
                  isGoalkeeper: playerForm.isGoalkeeper,
                  seasonId: candidate.seasonId ?? activeSeason.id,
                  teamId: candidate.id,
                }
              : player;
          }),
        };
      });
      const nextMatches = nameChanged
        ? matchResults.map((match) => ({
            ...match,
            goalScorers: match.goalScorers?.map((scorer) => scorer.player === previousName && scorer.team === team.name
              ? { ...scorer, player: normalizedName }
              : scorer),
          }))
        : matchResults;
      const nextSanctions = nameChanged
        ? cardDocket.map((record) => record.player === previousName && record.team === team.name ? { ...record, player: normalizedName } : record)
        : cardDocket;
      setStoreTeams(nextTeams);
      setFormError(null);
      resetPlayerForm();
      setIsPlayerDialogOpen(false);
      try {
        await persistLeagueStore({
          seasons,
          teams: nextTeams,
          matches: nextMatches,
          calendar: calendarRounds,
          sanctions: nextSanctions,
          finances: {
            fees: registrationFees,
            payments: teamPayments,
            expenses: expenseItems,
            costs: penaltyCosts,
          },
        });
      } catch {
        setStoreTeams(storeTeams);
      }
      return;
    }

    const duplicate = team.players.some((player) => player.name.trim().toLowerCase() === normalizedName.toLowerCase());
    if (duplicate) {
      setFormError("No se puede crear un jugador duplicado en el mismo equipo.");
      return;
    }

    const nextPlayer = {
      id: `player-${Date.now()}`,
      teamId: team.id,
      seasonId: team.seasonId ?? activeSeason.id,
      name: normalizedName,
      dorsal: playerForm.dorsal === "" ? 0 : Number(playerForm.dorsal) || playerForm.dorsal,
      isGoalkeeper: playerForm.isGoalkeeper,
    };

    try {
      await fetch("/api/players", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAdminHeaders(adminToken),
        },
        body: JSON.stringify({
          ...nextPlayer,
          teamId: team.id,
          name: normalizedName,
          dorsal: playerForm.dorsal === "" ? 0 : Number(playerForm.dorsal) || playerForm.dorsal,
          isGoalkeeper: playerForm.isGoalkeeper,
        }),
      });
    } catch {
      // El guardado se gestiona siempre a través de la API de Supabase.
    }

    nextTeams = storeTeams.map((candidate) =>
      candidate.id === team.id
        ? { ...candidate, players: [...candidate.players, nextPlayer] }
        : candidate
    );
    setStoreTeams(nextTeams);
    setFormError(null);
    resetPlayerForm();
    setIsPlayerDialogOpen(false);
    try {
      await persistLeagueStore({
        seasons,
        teams: nextTeams,
        matches: matchResults,
        calendar: calendarRounds,
        sanctions: cardDocket,
        finances: {
          fees: registrationFees,
          payments: teamPayments,
          expenses: expenseItems,
          costs: penaltyCosts,
        },
      });
    } catch {
      setStoreTeams(storeTeams);
    }
  };

  const parseGoalScorers = (rawValue: string, homeTeam: string, awayTeam: string) => {
    const teamNames = [homeTeam, awayTeam];
    const entries = rawValue.split(/[\n,;]+/).map((segment) => segment.trim()).filter(Boolean);

    return entries.map((entry) => {
      const minuteMatch = entry.match(/(\d{1,2})\s*['’]?$/);
      const minute = minuteMatch ? Number(minuteMatch[1]) : undefined;
      const candidate = minuteMatch ? entry.slice(0, minuteMatch.index).trim() : entry.trim();
      const teamName = teamNames.find((team) => candidate.toLowerCase().includes(team.toLowerCase()));
      const playerName = teamName ? candidate.replace(new RegExp(teamName, "ig"), "").replace(/[()\-–:]/g, "").trim() : candidate;

      if (!playerName || !teamName) {
        throw new Error("Cada goleador debe incluir jugador y equipo en el formato 'Jugador - Equipo - 28'.");
      }

      return {
        player: playerName,
        team: teamName,
        minute,
      };
    });
  };

  const resetResultForm = () => {
    setEditingMatchId(null);
    const fallbackMatch = matchResults[0];
    if (fallbackMatch) {
      setResultForm({
        matchId: fallbackMatch.id,
        home: fallbackMatch.score !== "-" ? String(fallbackMatch.score.split("-")[0]?.trim() ?? "0") : "0",
        away: fallbackMatch.score !== "-" ? String(fallbackMatch.score.split("-")[1]?.trim() ?? "0") : "0",
        scorers: fallbackMatch.goalScorers?.map((entry) => `${entry.player} ${entry.team} ${entry.minute ?? ""}`.trim()).join("; ") ?? "",
      });
      return;
    }

    setResultForm({
      matchId: initialMatches[0]?.id ?? 1,
      home: "0",
      away: "0",
      scorers: "",
    });
  };

  const startEditResult = (match: (typeof matchResults)[number]) => {
    setEditingMatchId(match.id);
    setResultForm({
      matchId: match.id,
      home: match.score === "-" ? "0" : (match.score.split("-")[0]?.trim() ?? "0"),
      away: match.score === "-" ? "0" : (match.score.split("-")[1]?.trim() ?? "0"),
      scorers: match.goalScorers?.map((entry) => `${entry.player} ${entry.team} ${entry.minute ?? ""}`.trim()).join("; ") ?? "",
    });
    setFormError(null);
  };

  const saveResult = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      assertAdminAccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No tienes permisos para modificar la liga.";
      setFormError(message);
      return;
    }

    if (!resultForm.matchId) {
      return;
    }

    const homeGoals = Number(resultForm.home) || 0;
    const awayGoals = Number(resultForm.away) || 0;
    const selectedMatch = matchResults.find((match) => match.id === Number(resultForm.matchId));
    if (!selectedMatch) {
      setFormError("Debes seleccionar un partido válido para guardar el resultado.");
      return;
    }

    const score = `${homeGoals} - ${awayGoals}`;
    const winner = homeGoals > awayGoals ? selectedMatch.home : awayGoals > homeGoals ? selectedMatch.away : "Empate";

    let goalScorers: Array<{ player: string; team: string; minute?: number }> = [];
    if (homeGoals > 0 || awayGoals > 0) {
      try {
        goalScorers = parseGoalScorers(resultForm.scorers, selectedMatch.home, selectedMatch.away);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Datos de goleadores no válidos.";
        setFormError(message);
        return;
      }
    }

    setMatchResults((previous) =>
      previous.map((match) =>
        match.id === Number(resultForm.matchId)
          ? { ...match, score, winner, goalScorers }
          : match
      )
    );
    setFormError(null);
    setEditingMatchId(null);
  };

  const updateResultDraft = (home: string, away: string, field: keyof ResultDraft, value: string) => {
    const key = resultDraftKey(home, away);
    setResultDrafts((previous) => ({
      ...previous,
      [key]: {
        ...(previous[key] ?? { home: "", away: "", homeScorers: [], awayScorers: [], shootoutHome: "", shootoutAway: "" }),
        [field]: value,
      },
    }));
  };

  const toggleResultFinalized = (home: string, away: string, isFinalized: boolean) => {
    const key = resultDraftKey(home, away);
    setResultDrafts((previous) => ({
      ...previous,
      [key]: {
        ...(previous[key] ?? { home: "", away: "", homeScorers: [], awayScorers: [], shootoutHome: "", shootoutAway: "" }),
        isFinalized,
      },
    }));
  };

  const addResultScorer = (home: string, away: string, team: "homeScorers" | "awayScorers", player: string) => {
    if (!player) {
      return;
    }

    const key = resultDraftKey(home, away);
    setResultDrafts((previous) => ({
      ...previous,
      [key]: {
        ...(previous[key] ?? { home: "", away: "", homeScorers: [], awayScorers: [], shootoutHome: "", shootoutAway: "" }),
        [team]: [...(previous[key]?.[team] ?? []), player],
      },
    }));
  };

  const removeResultScorer = (home: string, away: string, team: "homeScorers" | "awayScorers", scorerIndex: number) => {
    const key = resultDraftKey(home, away);
    setResultDrafts((previous) => ({
      ...previous,
      [key]: {
        ...(previous[key] ?? { home: "", away: "", homeScorers: [], awayScorers: [], shootoutHome: "", shootoutAway: "" }),
        [team]: (previous[key]?.[team] ?? []).filter((_, index) => index !== scorerIndex),
      },
    }));
  };

  const saveRoundResults = async (
    round: RoundEditor,
    linkedMatches: Array<(typeof matchResults)[number] | undefined>
  ) => {
    try {
      assertAdminAccess();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No tienes permisos para modificar la liga.");
      return;
    }

    const updatedByFixture = new Map<string, (typeof matchResults)[number]>();
    for (const [index, fixture] of round.matches.entries()) {
      const match = linkedMatches[index];
      const draft = resultDrafts[resultDraftKey(fixture.home, fixture.away)] ?? (match ? resultDraftFromMatch(match) : null);
      if (!match || !draft) {
        setFormError(`No se encontró el partido ${fixture.home} vs ${fixture.away} en los resultados.`);
        return;
      }

      const hasHomeScore = /^\d+$/.test(draft.home.trim());
      const hasAwayScore = /^\d+$/.test(draft.away.trim());
      const isFinalized = draft.isFinalized === true;
      if (isFinalized && (!hasHomeScore || !hasAwayScore)) {
        setFormError(`Completa el resultado de ${fixture.home} vs ${fixture.away} antes de marcarlo como finalizado.`);
        return;
      }

      const homeGoals = hasHomeScore ? Number(draft.home) : 0;
      const awayGoals = hasAwayScore ? Number(draft.away) : 0;
      const homeScorers = draft.homeScorers ?? [];
      const awayScorers = draft.awayScorers ?? [];
      const activeSanctionsForRound = dedupeActiveDisciplineStatus(
        getDisciplineStatus(cardDocket, calendarRounds, round.id, yellowCardResetRoundId)
      );
      const suspendedPlayers = new Set(activeSanctionsForRound.map((record) => `${record.team.toLowerCase()}::${record.player.toLowerCase()}`));
      const suspendedScorer = [
        ...homeScorers.map((player) => ({ player, team: fixture.home })),
        ...awayScorers.map((player) => ({ player, team: fixture.away })),
      ].find((scorer) => suspendedPlayers.has(`${scorer.team.toLowerCase()}::${scorer.player.toLowerCase()}`));
      if (suspendedScorer) {
        setFormError(`${suspendedScorer.player} está cumpliendo sanción y no puede figurar como goleador en ${round.title}.`);
        return;
      }
      if (homeScorers.length > 0 && homeScorers.length !== homeGoals) {
        setFormError(`Selecciona exactamente ${homeGoals} goleador${homeGoals === 1 ? "" : "es"} para ${fixture.home}. Puedes seleccionar varias veces al mismo jugador.`);
        return;
      }
      if (awayScorers.length > 0 && awayScorers.length !== awayGoals) {
        setFormError(`Selecciona exactamente ${awayGoals} goleador${awayGoals === 1 ? "" : "es"} para ${fixture.away}. Puedes seleccionar varias veces al mismo jugador.`);
        return;
      }

      let shootoutScore: string | undefined;
      if (homeGoals === awayGoals) {
        const hasShootout = /^\d+$/.test(draft.shootoutHome.trim()) && /^\d+$/.test(draft.shootoutAway.trim());
        const hasPartialShootout = draft.shootoutHome.trim() !== "" || draft.shootoutAway.trim() !== "";
        if ((isFinalized || hasPartialShootout) && (!hasShootout || Number(draft.shootoutHome) === Number(draft.shootoutAway))) {
          setFormError(`Introduce un desempate por penaltis válido para ${fixture.home} vs ${fixture.away}.`);
          return;
        }
        if (hasShootout) {
          shootoutScore = `${Number(draft.shootoutHome)} - ${Number(draft.shootoutAway)}`;
        }
      }

      const goalScorers = [
        ...homeScorers.map((player) => ({ player, team: fixture.home })),
        ...awayScorers.map((player) => ({ player, team: fixture.away })),
      ];
      updatedByFixture.set(resultDraftKey(fixture.home, fixture.away), {
        ...match,
        score: hasHomeScore || hasAwayScore ? `${homeGoals} - ${awayGoals}` : "-",
        status: isFinalized ? "finished" : hasHomeScore || hasAwayScore ? "in-progress" : "scheduled",
        winner: hasHomeScore || hasAwayScore ? homeGoals > awayGoals ? match.home : awayGoals > homeGoals ? match.away : "Empate" : undefined,
        goalScorers: hasHomeScore || hasAwayScore ? goalScorers : [],
        shootoutScore: hasHomeScore || hasAwayScore ? shootoutScore : undefined,
      });
    }

    const nextMatchResults = matchResults.map((match) => updatedByFixture.get(resultDraftKey(match.home, match.away)) ?? match);
    const roundResults = round.matches.map((fixture) => nextMatchResults.find((match) => resultDraftKey(match.home, match.away) === resultDraftKey(fixture.home, fixture.away)));
    const finalizedMatches = roundResults.filter((match) => match?.status === "finished").length;
    const hasResults = roundResults.some((match) => match?.status === "finished" || match?.status === "in-progress");
    const nextRoundStatus: RoundStatus = finalizedMatches === round.matches.length
      ? "completed"
      : hasResults
        ? "in-progress"
        : "upcoming";
    const nextCalendar = calendarRounds.map((candidate) => candidate.id === round.id
      ? { ...candidate, status: nextRoundStatus }
      : candidate
    );
    const nextSanctions = recalculateSuspensionRemaining(cardDocket, nextCalendar);

    setIsSavingStore(true);
    try {
      await persistLeagueStore({
        seasons,
        teams: storeTeams,
        matches: nextMatchResults,
        calendar: nextCalendar,
        sanctions: nextSanctions,
        finances: {
          fees: registrationFees,
          payments: teamPayments,
          expenses: expenseItems,
          costs: penaltyCosts,
        },
      });
      setMatchResults(nextMatchResults);
      setCalendarRounds(nextCalendar);
      setCardDocket(nextSanctions);
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No se pudieron guardar los resultados.");
      return;
    } finally {
      setIsSavingStore(false);
    }
  };

  const reopenRound = async (round: RoundEditor) => {
    const confirmed = window.confirm(`Vas a quitar el estado finalizado de ${round.title} y de las jornadas posteriores que también estén finalizadas. Las jornadas anteriores mantendrán su estado y los marcadores guardados no se borrarán. ¿Quieres continuar?`);
    if (!confirmed) {
      return;
    }

    const targetDate = toIsoDateInput(round.date);
    const nextCalendar = calendarRounds.map((candidate) => {
      const candidateDate = toIsoDateInput(candidate.date);
      return candidate.status === "completed" && candidateDate >= targetDate
        ? { ...candidate, status: "in-progress" as const }
        : candidate;
    });
      const nextSanctions = recalculateSuspensionRemaining(cardDocket, nextCalendar);

    setIsSavingStore(true);
    try {
      await persistLeagueStore({
        seasons,
        teams: storeTeams,
        matches: matchResults,
        calendar: nextCalendar,
        sanctions: nextSanctions,
        finances: {
          fees: registrationFees,
          payments: teamPayments,
          expenses: expenseItems,
          costs: penaltyCosts,
        },
      });
      setCalendarRounds(nextCalendar);
      setCardDocket(nextSanctions);
      setFormError(null);
    } catch {
      return;
    } finally {
      setIsSavingStore(false);
    }
  };

  const clearRoundResults = async (round: RoundEditor) => {
    if (round.status === "completed") {
      return;
    }

    const confirmed = window.confirm(`Vas a vaciar todos los resultados, goleadores y penaltis de ${round.title}. Los partidos y horarios del calendario no se borrarán. ¿Quieres continuar?`);
    if (!confirmed) {
      return;
    }

    const roundFixtures = new Set(round.matches.map((fixture) => resultDraftKey(fixture.home, fixture.away)));
    const nextMatchResults = matchResults.map((match) => roundFixtures.has(resultDraftKey(match.home, match.away))
      ? { ...match, score: "-", winner: undefined, goalScorers: [], shootoutScore: undefined }
      : match
    );
    const nextDrafts = { ...resultDrafts };
    round.matches.forEach((fixture) => {
      nextDrafts[resultDraftKey(fixture.home, fixture.away)] = {
        home: "",
        away: "",
        homeScorers: [],
        awayScorers: [],
        shootoutHome: "",
        shootoutAway: "",
      };
    });
    const nextCalendar = calendarRounds.map((candidate) => candidate.id === round.id
      ? { ...candidate, status: "upcoming" as const }
      : candidate
    );
    const nextSanctions = recalculateSuspensionRemaining(cardDocket, nextCalendar);

    setIsSavingStore(true);
    try {
      await persistLeagueStore({
        seasons,
        teams: storeTeams,
        matches: nextMatchResults,
        calendar: nextCalendar,
        sanctions: nextSanctions,
        finances: {
          fees: registrationFees,
          payments: teamPayments,
          expenses: expenseItems,
          costs: penaltyCosts,
        },
      });
      setMatchResults(nextMatchResults);
      setCalendarRounds(nextCalendar);
      setCardDocket(nextSanctions);
      setFormError(null);
    } catch {
      return;
    } finally {
      setIsSavingStore(false);
    }
  };

  const resetCardForm = () => {
    setEditingCardId(null);
    setIsSanctionDialogOpen(false);
    const fallbackTeam = visibleTeams[0]?.name ?? initialStoreTeams[0]?.name ?? "Aston Birras";
    const fallbackPlayer = playerRosterByTeam[fallbackTeam]?.[0] ?? initialStoreTeams[0]?.players[0]?.name ?? "";
    setCardForm({
      player: fallbackPlayer,
      team: fallbackTeam,
      card: "Amarilla",
      reason: "Motivos deportivos",
      jornada: calendarRounds.find((round) => round.status === "in-progress")?.title ?? calendarRounds.find((round) => round.status === "upcoming")?.title ?? [...calendarRounds].reverse().find((round) => round.status === "completed")?.title ?? calendarRounds[0]?.title ?? "Jornada 1",
      manualAmount: "",
      suspensionReason: "Encararse con otro jugador",
      suspensionMatches: "",
    });
  };

  const startEditCard = (record: typeof cardDocket[number]) => {
    setEditingCardId(record.id);
    setIsSanctionDialogOpen(true);
    setCardForm({
      player: record.player,
      team: record.team,
      card: record.card,
      reason: (record.reason as SanctionReason) || "Otros motivos",
      jornada: record.jornada ?? calendarRounds.find((round) => round.status === "completed")?.title ?? "Jornada 1",
      manualAmount: String(record.points ?? record.pointsAmount ?? record.costAmount ?? record.cost_amount ?? ""),
      suspensionReason: (record.suspensionReason as SuspensionReason) || "Encararse con otro jugador",
      suspensionMatches: String(record.suspensionMatches ?? record.matches ?? ""),
    });
    setFormError(null);
  };

  const saveCard = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      assertAdminAccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No tienes permisos para modificar la liga.";
      setFormError(message);
      return;
    }

    const playerName = cardForm.player.trim();
    const teamName = cardForm.team.trim();
    if (!playerName || !teamName) {
      setFormError("Debes seleccionar un equipo y un jugador válidos para la sanción.");
      return;
    }

    const selectedTeam = storeTeams.find((team) => team.name === teamName);
    const teamPlayer = selectedTeam?.players.some((player) => player.name.toLowerCase() === playerName.toLowerCase());
    if (!selectedTeam || !teamPlayer) {
      setFormError("La sanción debe apuntar a un jugador que pertenezca a ese equipo.");
      return;
    }

    const selectedRound = calendarRounds.find((round) => round.title === effectiveSanctionJornada);
    if (!selectedRound || selectedRound.status === "upcoming") {
      setFormError("Solo puedes registrar sanciones de jornadas finalizadas o en curso.");
      return;
    }

    const linkedMatch = matchResults.find((match) =>
      match.jornada === effectiveSanctionJornada
      && (match.home === teamName || match.away === teamName)
      && Boolean(match.score && match.score !== "-")
    );
    if (!linkedMatch) {
      setFormError(`No hay un partido de ${teamName} en ${effectiveSanctionJornada} para vincular esta sanción.`);
      return;
    }

    if (cardForm.card === "Amarilla") {
      const yellowAlreadyRegistered = cardDocket.some((record) =>
        record.id !== editingCardId
        && record.card === "Amarilla"
        && record.team.toLowerCase() === teamName.toLowerCase()
        && record.player.toLowerCase() === playerName.toLowerCase()
        && record.jornada === effectiveSanctionJornada
      );

      if (yellowAlreadyRegistered) {
        setFormError(`${playerName} ya tiene una tarjeta amarilla registrada en ${effectiveSanctionJornada}. No se puede añadir otra en la misma jornada.`);
        return;
      }
    }

    const previousYellowCount = getYellowCardsForPlayer(cardDocket.filter((record) => record.id !== editingCardId), calendarRounds, teamName, playerName, yellowCardResetRoundId);
    const automaticSuspension = cardForm.card === "Amarilla" && previousYellowCount >= 2 ? 1 : cardForm.card === "Doble amarilla" || (cardForm.card === "Roja" && cardForm.reason === "Motivos deportivos") ? 1 : cardForm.card === "Roja" && cardForm.reason === "Motivos antideportivos"
      ? cardForm.suspensionReason === "Encararse con otro jugador" ? 2 : cardForm.suspensionReason === "Insultar o faltar al respeto al árbitro" ? 3 : cardForm.suspensionReason === "Motivo deportivo violento" ? 4 : Number(cardForm.suspensionMatches) || 0
      : Number(cardForm.suspensionMatches) || 0;

    const sanctionAmount = getSanctionPoints(cardForm.card, cardForm.reason, cardForm.manualAmount);
    const nextRecord = {
      id: editingCardId ?? Date.now(),
      matchId: linkedMatch.id,
      player: playerName,
      team: teamName,
      playerId: selectedTeam.players.find((player) => player.name.toLowerCase() === playerName.toLowerCase())?.id ?? undefined,
      teamId: selectedTeam.id,
      card: cardForm.card,
      card_type: cardForm.card,
      matches: 1,
      remaining: 1,
      reason: (["Amarilla", "Doble amarilla"] as CardType[]).includes(cardForm.card) ? "Motivos deportivos" : cardForm.reason.trim() || "Registrada por el administrador",
      jornada: effectiveSanctionJornada,
      suspensionReason: cardForm.card === "Roja" && cardForm.reason === "Motivos antideportivos" ? cardForm.suspensionReason : undefined,
      suspensionMatches: automaticSuspension,
      suspensionRemaining: automaticSuspension,
      costAmount: sanctionAmount,
      cost_amount: sanctionAmount,
      points: sanctionAmount,
      pointsAmount: sanctionAmount,
    };

    const nextSanctions = editingCardId !== null
      ? cardDocket.map((record) => record.id === editingCardId ? { ...record, ...nextRecord } : record)
      : [nextRecord, ...cardDocket];

    setCardDocket(nextSanctions);
    setFormError(null);
    setEditingCardId(null);
    resetCardForm();

    try {
      await persistLeagueStore({
        seasons,
        teams: storeTeams,
        matches: matchResults,
        calendar: calendarRounds,
        sanctions: nextSanctions,
        finances: {
          fees: registrationFees,
          payments: teamPayments,
          expenses: expenseItems,
          costs: penaltyCosts,
        },
      });
    } catch {
      setCardDocket(cardDocket);
    }
  };

  const resetRoundForm = () => {
    setEditingRoundId(null);
    const fallbackTeamA = visibleTeams[0]?.name ?? initialStoreTeams[0]?.name ?? "Aston Birras";
    const fallbackTeamB = visibleTeams[1]?.name ?? initialStoreTeams[1]?.name ?? "Kalekantoi";
    setRoundForm({
      title: "Jornada 15",
      date: new Date().toISOString().slice(0, 10),
      time: "16:00",
      matches: [
        {
          time: "16:00",
          home: fallbackTeamA,
          away: fallbackTeamB,
        },
      ],
    });
  };

  const addRoundMatch = () => {
    setRoundForm((previous) => ({
      ...previous,
      matches: [
        ...previous.matches,
        {
          time: previous.time || "16:00",
          home: visibleTeams[0]?.name ?? initialStoreTeams[0]?.name ?? "Aston Birras",
          away: visibleTeams[1]?.name ?? initialStoreTeams[1]?.name ?? "Kalekantoi",
        },
      ],
    }));
  };

  const removeRoundMatch = (matchIndex: number) => {
    setRoundForm((previous) => ({
      ...previous,
      matches: previous.matches.filter((_, index) => index !== matchIndex),
    }));
  };

  const openRoundDialog = (round?: RoundEditor) => {
    if (round) {
      setEditingRoundId(round.id);
      setRoundForm({
        title: round.title,
        date: round.date,
        time: round.matches[0]?.time ?? "16:00",
        matches: round.matches.length > 0
          ? round.matches.map((match) => ({ ...match, time: match.time || "16:00" }))
          : [
              {
                time: "16:00",
                home: visibleTeams[0]?.name ?? initialStoreTeams[0]?.name ?? "Aston Birras",
                away: visibleTeams[1]?.name ?? initialStoreTeams[1]?.name ?? "Kalekantoi",
              },
            ],
      });
    } else {
      resetRoundForm();
      setEditingRoundId(null);
    }
    setFormError(null);
    setIsRoundDialogOpen(true);
  };

  const closeRoundDialog = () => {
    setIsRoundDialogOpen(false);
    resetRoundForm();
    setEditingRoundId(null);
  };

  const startEditRound = (round: RoundEditor) => {
    openRoundDialog(round);
  };

  const deleteRound = async (roundId: number) => {
    const nextCalendar = calendarRounds.filter((round) => round.id !== roundId);
    setCalendarRounds(nextCalendar);

    try {
      await persistLeagueStore({
        seasons,
        teams: storeTeams,
        matches: matchResults,
        calendar: nextCalendar,
        sanctions: cardDocket,
        finances: {
          fees: registrationFees,
          payments: teamPayments,
          expenses: expenseItems,
          costs: penaltyCosts,
        },
      });
    } catch {
      setCalendarRounds(calendarRounds);
    }

    if (editingRoundId === roundId) {
      resetRoundForm();
    }
  };

  const addRound = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      assertAdminAccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No tienes permisos para modificar la liga.";
      setFormError(message);
      return;
    }

    const validMatches = roundForm.matches.filter((match) => match.home && match.away);
    if (validMatches.length === 0) {
      setFormError("Define al menos un cruce válido para la jornada.");
      return;
    }

    const teamCounts = new Map<string, number>();
    const timeCounts = new Map<string, number>();
    for (const match of validMatches) {
      const home = match.home.trim();
      const away = match.away.trim();
      const matchTime = (match.time || roundForm.time || "16:00").trim();

      if (home === away) {
        setFormError("Un equipo no puede jugar contra sí mismo dentro de la misma jornada.");
        return;
      }

      if (timeCounts.get(matchTime)) {
        setFormError(`La hora ${matchTime} ya está ocupada por otro partido en esta jornada. Cada hora solo puede tener un cruce.`);
        return;
      }
      timeCounts.set(matchTime, 1);

      for (const teamName of [home, away]) {
        const nextCount = (teamCounts.get(teamName) ?? 0) + 1;
        if (nextCount > 1) {
          setFormError(`El equipo "${teamName}" ya está programado en esta jornada. Cada equipo solo puede jugar una vez por jornada.`);
          return;
        }
        teamCounts.set(teamName, nextCount);
      }
    }

    const usedTeams = new Set(validMatches.flatMap((match) => [match.home, match.away]));
    const nextRound: RoundEditor = {
      id: editingRoundId ?? Date.now(),
      title: roundForm.title || `Jornada ${calendarRounds.length + 1}`,
      date: roundForm.date,
      status: "upcoming",
      matches: validMatches.map((match) => ({
        time: match.time || roundForm.time || "16:00",
        home: match.home,
        away: match.away,
        stadium: "Tabira",
      })),
      descansan: visibleTeams.filter((team) => !usedTeams.has(team.name)).map((team) => team.name),
    };

    const nextCalendar = editingRoundId !== null
      ? calendarRounds.map((round) => round.id === editingRoundId ? { ...round, ...nextRound } : round)
      : [nextRound, ...calendarRounds];

    const previousRound = editingRoundId !== null ? calendarRounds.find((round) => round.id === editingRoundId) : undefined;
    const nextMatchResults = editingRoundId !== null
      ? matchResults.map((match) => {
          const previousIndex = previousRound?.matches.findIndex((fixture) => fixture.home === match.home && fixture.away === match.away) ?? -1;
          const replacement = previousIndex >= 0 ? nextRound.matches[previousIndex] : undefined;
          return replacement
            ? {
                ...match,
                jornada: nextRound.title,
                date: nextRound.date,
                time: replacement.time,
                home: replacement.home,
                away: replacement.away,
                scheduledAt: `${nextRound.date}T${replacement.time}:00`,
              }
            : match;
        })
      : [
          ...matchResults,
          ...nextRound.matches.map((fixture, index) => ({
            id: `match-${nextRound.id}-${index}`,
            jornada: nextRound.title,
            date: nextRound.date,
            time: fixture.time,
            home: fixture.home,
            away: fixture.away,
            score: "-",
            stadium: fixture.stadium ?? "Tabira",
            events: { home: "", away: "" },
            goalScorers: [],
            seasonId: activeSeason.id,
            status: "scheduled" as const,
          })),
        ];

    setCalendarRounds(nextCalendar);

    try {
      await persistLeagueStore({
        seasons,
        teams: storeTeams,
        matches: nextMatchResults,
        calendar: nextCalendar,
        sanctions: cardDocket,
        finances: {
          fees: registrationFees,
          payments: teamPayments,
          expenses: expenseItems,
          costs: penaltyCosts,
        },
      });
      setFormError(null);
      setIsRoundDialogOpen(false);
      resetRoundForm();
    } catch {
      setCalendarRounds(calendarRounds);
    }
  };

  const updateRoundFixture = (fixtureIndex: number, field: "home" | "away" | "time", value: string) => {
    setRoundForm((previous) => ({
      ...previous,
      matches: previous.matches.map((match, index) =>
        index === fixtureIndex ? { ...match, [field]: value } : match
      ),
    }));
  };

  const restingTeams = useMemo(() => {
    const usedTeams = new Set(roundForm.matches.flatMap((match) => [match.home, match.away]));
    return visibleTeams.filter((team) => !usedTeams.has(team.name)).map((team) => team.name);
  }, [roundForm.matches, visibleTeams]);

  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setExpenseForm({
      concept: "Balones",
      entity: "Material",
      amount: "120",
      paid: "0",
      type: "gasto",
      category: "Gasto",
      date: new Date().toISOString().slice(0, 10),
      status: "pendiente",
    });
  };

  const addExpense = async (event: React.FormEvent<HTMLFormElement>, overrides: Partial<typeof expenseForm> & { settlementOnly?: boolean } = {}) => {
    event.preventDefault();

    try {
      assertAdminAccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No tienes permisos para modificar la liga.";
      setFormError(message);
      return;
    }

    const formValues = { ...expenseForm, ...overrides };
    const concept = economyTab === "patrocinadores" ? "Abono patrocinio" : formValues.concept.trim();
    if (!concept) {
      setFormError("El concepto del movimiento es obligatorio.");
      return;
    }

    const amount = Number(formValues.amount) || 0;
    const paid = Number(formValues.paid) || 0;
    if (amount <= 0) {
      setFormError("El importe debe ser mayor que cero.");
      return;
    }

    const nextEntry: ExpenseItem = {
      id: editingExpenseId ?? Date.now(),
      concept,
      amount,
      type: formValues.type,
      kind: economyTab === "cuotas" ? "cuota" : economyTab === "patrocinadores" ? "patrocinio" : "otro",
      category: formValues.category || (formValues.type === "cobro" ? "Patrocinio" : "Gasto"),
      entity: formValues.entity.trim() || "Sin entidad",
      paid: Math.min(paid, amount),
      pending: Math.max(amount - paid, 0),
      date: formValues.date || new Date().toISOString().slice(0, 10),
      status: paid >= amount ? "pagado" : formValues.status === "planificado" ? "planificado" : "pendiente",
      settlementOnly: overrides.settlementOnly === true,
    };

    const nextExpenses = editingExpenseId !== null
      ? expenseItems.map((item) => item.id === editingExpenseId ? { ...item, ...nextEntry } : item)
      : [nextEntry, ...expenseItems];

    setExpenseItems(nextExpenses);
    setFormError(null);
    resetExpenseForm();

    try {
      await persistLeagueStore({
        seasons,
        teams: storeTeams,
        matches: matchResults,
        calendar: calendarRounds,
        sanctions: cardDocket,
        finances: { fees: registrationFees, payments: teamPayments, expenses: nextExpenses, costs: penaltyCosts },
      });
    } catch {
      setExpenseItems(expenseItems);
    }
  };

  if (!hasAdminAccess) {
    return (
      <main className="page-shell admin-shell">
        <header className="page-header">
          <div>
            <p className="eyebrow">Administración</p>
            <h1>Panel del organizador</h1>
          </div>
          <Link href="/" className="button button-secondary">Volver al inicio</Link>
        </header>

        <section className="content-card" style={{ maxWidth: 520, margin: "24px auto" }}>
          <h2>Acceso restringido</h2>
          <p style={{ color: "#bfd1cf", marginBottom: 18 }}>
            Para entrar en esta zona debes iniciar sesión con un usuario administrador.
          </p>

          <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
            <Link href="/login?next=/admin" className="button button-secondary">
              Iniciar sesión
            </Link>
          </div>

          {authError ? (
            <p style={{ marginTop: 14, color: "#fca5a5" }}>{authError}</p>
          ) : null}
        </section>
      </main>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "calendario":
        return (
          <section className="content-card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }}>
              <h2>Jornadas programadas</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" className="button button-secondary" onClick={() => openRoundDialog()}>
                  + Nueva jornada
                </button>
                <span className="pill" style={{ background: "rgba(47,201,138,0.08)", color: "#a9f0d0" }}>{searchableCalendarRounds.length} jornadas</span>
              </div>
            </div>

              <label className="search-field" style={{ marginBottom: 16 }}>
                <span>Buscar jornada</span>
                <input
                  className="search-input"
                  value={calendarSearch}
                  onChange={(event) => setCalendarSearch(event.target.value)}
                  placeholder="Título, fecha o equipo"
                />
              </label>

              <div style={{ display: "grid", gap: 12 }}>
                {visibleCalendarRounds.length > 0 ? (
                  visibleCalendarRounds.map((round) => (
                    <div key={round.id} className="content-card" style={{ padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <strong>{round.title}</strong>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" className="button button-secondary" onClick={() => startEditRound(round)}>Editar</button>
                          <button type="button" className="button button-secondary" onClick={() => deleteRound(round.id)}>Borrar</button>
                        </div>
                      </div>
                      <p style={{ color: "#b0bab8", marginTop: 8 }}>{formatRoundDate(round.date)}</p>
                      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                        {round.matches.map((match, index) => (
                          <div
                            key={`${round.id}-${index}`}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "72px 1fr",
                              gap: 10,
                              alignItems: "center",
                              padding: "10px 12px",
                              borderRadius: 12,
                              border: "1px solid rgba(255,255,255,0.06)",
                              background: "rgba(255,255,255,0.02)",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                justifyContent: "center",
                                alignItems: "center",
                                padding: "6px 8px",
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.04)",
                                color: "#dfe8ff",
                                fontWeight: 700,
                                fontSize: 12,
                                border: "1px solid rgba(255,255,255,0.08)",
                              }}
                            >
                              {match.time}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span
                                style={{
                                  color: "#edf3f1",
                                  fontWeight: 600,
                                }}
                              >
                                <TeamIdentity name={match.home} compact />
                              </span>
                              <span style={{ color: "#8aa3a0", fontWeight: 700 }}>vs</span>
                              <span
                                style={{
                                  color: "#edf3f1",
                                  fontWeight: 600,
                                }}
                              >
                                <TeamIdentity name={match.away} compact />
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {round.descansan?.length ? (
                        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <span className="pill" style={{ background: "rgba(212,173,77,0.1)", color: "#f4d78d" }}>Descansan</span>
                          {round.descansan.map((team) => (
                            <span key={`${round.id}-${team}`} className="pill" style={{ background: "rgba(255,255,255,0.03)", color: "#edf3f1" }}>{team}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="pill" style={{ background: "rgba(255,255,255,0.02)", color: "#b0bab8", justifyContent: "center" }}>
                    No hay jornadas que coincidan con la búsqueda
                  </div>
                )}
              </div>

              {searchableCalendarRounds.length > calendarPageSize ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setCalendarPage((current) => Math.max(1, current - 1))}
                    disabled={calendarPage === 1}
                  >
                    Anterior
                  </button>

                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {Array.from({ length: totalCalendarPages }, (_, index) => index + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        className={page === calendarPage ? "action-button" : "button button-secondary"}
                        onClick={() => setCalendarPage(page)}
                        style={{ minWidth: 36, padding: "8px 10px" }}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setCalendarPage((current) => Math.min(totalCalendarPages, current + 1))}
                    disabled={calendarPage === totalCalendarPages}
                  >
                    Siguiente
                  </button>
                </div>
              ) : null}
          </section>
        );
      case "resultados":
        return (
          <section className="content-card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap" }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: 6 }}>Centro de resultados</p>
                <h2 style={{ marginBottom: 6 }}>Resultados por jornada</h2>
                <p style={{ color: "#9fb2ae", margin: 0 }}>Marca cada partido como finalizado. La jornada se cerrará automáticamente cuando estén finalizados todos sus partidos.</p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="pill" style={{ background: "rgba(47,201,138,0.1)", color: "#a9f0d0" }}>{resultRounds.filter((entry) => entry.isFinalized).length} finalizadas</span>
                <span className="pill" style={{ background: "rgba(212,173,77,0.12)", color: "#f4d78d" }}>{resultRounds.filter((entry) => !entry.isFinalized).length} pendientes</span>
              </div>
            </div>

            {resultRounds.length > 0 ? (
              <div className="results-rounds" style={{ display: "grid", gap: 16 }}>
                {resultRounds.map((entry, roundIndex) => {
                  const { round, linkedMatches, completedMatches, isFinalized } = entry;
                  const isCurrent = roundIndex === 0 && !isFinalized;
                  const allDraftsComplete = round.matches.every((fixture) => {
                    const draft = resultDrafts[resultDraftKey(fixture.home, fixture.away)];
                    return Boolean(draft && (/^\d+$/.test(draft.home.trim()) || /^\d+$/.test(draft.away.trim())));
                  });

                  return (
                    <article key={round.id} className="results-round-card" style={{
                      border: isCurrent ? "1px solid rgba(47,201,138,0.45)" : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 14,
                      padding: 18,
                      background: isCurrent ? "linear-gradient(135deg, rgba(47,201,138,0.1), rgba(255,255,255,0.025))" : "rgba(255,255,255,0.018)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <h3 style={{ margin: 0 }}>{round.title}</h3>
                          {isCurrent ? <span className="pill" style={{ background: "#2fc98a", color: "#06271b", fontWeight: 800 }}>PRÓXIMA JORNADA</span> : null}
                          <span className="pill" style={{ background: isFinalized ? "rgba(47,201,138,0.1)" : "rgba(212,173,77,0.1)", color: isFinalized ? "#a9f0d0" : "#f4d78d" }}>
                            {isFinalized ? "Finalizada" : `${completedMatches}/${round.matches.length} resultados`}
                          </span>
                        </div>
                        <span style={{ color: "#b0bab8" }}>{formatRoundDate(round.date)}</span>
                      </div>

                      <div className="results-match-list" style={{ display: "grid", gap: 8 }}>
                        {round.matches.map((fixture, fixtureIndex) => {
                          const draft = resultDrafts[resultDraftKey(fixture.home, fixture.away)] ?? (linkedMatches[fixtureIndex] ? resultDraftFromMatch(linkedMatches[fixtureIndex]) : { home: "", away: "", homeScorers: [], awayScorers: [], shootoutHome: "", shootoutAway: "" });
                          const homePlayers = playerRosterByTeam[fixture.home] ?? [];
                          const awayPlayers = playerRosterByTeam[fixture.away] ?? [];
                          const homeScorers = draft.homeScorers ?? [];
                          const awayScorers = draft.awayScorers ?? [];
                          const isDraw = /^\d+$/.test(draft.home) && /^\d+$/.test(draft.away) && draft.home === draft.away;
                          const isMatchFinalized = draft.isFinalized === true;
                          const matchStatusLabel = isMatchFinalized ? "Finalizado" : round.status === "in-progress" ? "En curso" : "Próximo";

                          const scorerPicker = (team: "homeScorers" | "awayScorers", players: string[], selected: string[]) => (
                            <div style={{ display: "grid", gap: 8 }}>
                              <ResultScorerPicker
                                label={`Seleccionar goleador ${team === "homeScorers" ? fixture.home : fixture.away}`}
                                players={players}
                                selected={selected}
                                onSelect={(player) => addResultScorer(fixture.home, fixture.away, team, player)}
                                onRemove={(index) => removeResultScorer(fixture.home, fixture.away, team, index)}
                              />
                            </div>
                          );

                          return (
                            <div key={`${round.id}-${fixtureIndex}-${fixture.home}-${fixture.away}`} className="results-match-card" style={{ display: "grid", gap: 14, padding: 16, borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.14)" }}>
                              <div className="results-match-top" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 150px minmax(0, 1fr)", gap: 14, alignItems: "center" }}>
                                <div className="results-team-name" style={{ justifyContent: "flex-end", textAlign: "right", fontWeight: 800, color: "#edf3f1" }}><span className="results-match-time">{fixture.time}</span><TeamIdentity name={fixture.home} compact /></div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "6px 0" }}>
                                  <input className="result-score-input" aria-label={`Goles ${fixture.home}`} inputMode="numeric" min="0" type="number" value={draft.home} onChange={(event) => updateResultDraft(fixture.home, fixture.away, "home", event.target.value)} style={{ width: 56, height: 46, textAlign: "center", fontWeight: 900, fontSize: 20, padding: "8px 4px" }} placeholder="-" />
                                  <span style={{ color: "#819894", fontWeight: 900 }}>:</span>
                                  <input className="result-score-input" aria-label={`Goles ${fixture.away}`} inputMode="numeric" min="0" type="number" value={draft.away} onChange={(event) => updateResultDraft(fixture.home, fixture.away, "away", event.target.value)} style={{ width: 56, height: 46, textAlign: "center", fontWeight: 900, fontSize: 20, padding: "8px 4px" }} placeholder="-" />
                                </div>
                                <div className="results-team-name" style={{ fontWeight: 800, color: "#edf3f1" }}><TeamIdentity name={fixture.away} compact /></div>
                              </div>

                              <label className={`result-finalization-control ${isMatchFinalized ? "is-finalized" : ""}`}>
                                <input
                                  type="checkbox"
                                  checked={isMatchFinalized}
                                  onChange={(event) => toggleResultFinalized(fixture.home, fixture.away, event.target.checked)}
                                />
                                <span className="result-finalization-switch" aria-hidden="true"><span /></span>
                                <span>
                                  <strong>{matchStatusLabel}</strong>
                                  <small>{isMatchFinalized ? "El resultado queda cerrado" : "Marca cuando el partido haya terminado"}</small>
                                </span>
                              </label>

                              <div className="result-scorer-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <div style={{ display: "grid", gap: 7 }}>
                                  <span className="result-scorer-label" style={{ color: "#9fb2ae", fontSize: 12, fontWeight: 700 }}>GOLEADORES · {fixture.home.toUpperCase()}</span>
                                  {scorerPicker("homeScorers", homePlayers, homeScorers)}
                                </div>
                                <div style={{ display: "grid", gap: 7 }}>
                                  <span className="result-scorer-label" style={{ color: "#9fb2ae", fontSize: 12, fontWeight: 700 }}>GOLEADORES · {fixture.away.toUpperCase()}</span>
                                  {scorerPicker("awayScorers", awayPlayers, awayScorers)}
                                </div>
                              </div>

                              {isDraw ? (
                                <div className="result-shootout" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", borderRadius: 9, background: "rgba(212,173,77,0.08)", border: "1px solid rgba(212,173,77,0.18)" }}>
                                  <span style={{ color: "#f4d78d", fontSize: 12, fontWeight: 800 }}>DESEMPATE POR PENALTIS</span>
                                  <input className="result-shootout-input" aria-label={`Penaltis ${fixture.home}`} inputMode="numeric" min="0" type="number" value={draft.shootoutHome} onChange={(event) => updateResultDraft(fixture.home, fixture.away, "shootoutHome", event.target.value)} style={{ width: 52, textAlign: "center", padding: "7px 4px" }} placeholder="-" />
                                  <span style={{ color: "#f4d78d", fontWeight: 800 }}>:</span>
                                  <input className="result-shootout-input" aria-label={`Penaltis ${fixture.away}`} inputMode="numeric" min="0" type="number" value={draft.shootoutAway} onChange={(event) => updateResultDraft(fixture.home, fixture.away, "shootoutAway", event.target.value)} style={{ width: 52, textAlign: "center", padding: "7px 4px" }} placeholder="-" />
                                  <span style={{ color: "#bda96d", fontSize: 12 }}>No cuenta para goleadores ni Zamora</span>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                        <button type="button" className="action-button" onClick={() => saveRoundResults(round, linkedMatches)} disabled={isSavingStore}>
                          {isSavingStore ? "Guardando…" : "Guardar cambios"}
                        </button>
                      </div>
                      {!isFinalized && !allDraftsComplete ? (
                        <p className="results-save-hint">Introduce al menos un marcador por partido; el lado vacío se guardará como 0. Los goleadores son opcionales y, si los introduces, deben coincidir con los goles. En los empates añade el desempate por penaltis.</p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="pill" style={{ background: "rgba(255,255,255,0.02)", color: "#b0bab8", justifyContent: "center" }}>No hay jornadas cargadas en el calendario.</div>
            )}
          </section>
        );
      case "sanciones":
        return (
          <section className="sanctions-admin-layout">
            <div
              className={`content-card sanction-editor-panel ${isSanctionDialogOpen ? "sanction-editor-modal" : ""}`}
              role={isSanctionDialogOpen ? "dialog" : undefined}
              aria-modal={isSanctionDialogOpen ? true : undefined}
              aria-labelledby={isSanctionDialogOpen ? "sanction-dialog-title" : undefined}
            >
              <div className="section-header compact-header">
                <div>
                  <p className="eyebrow">Disciplina</p>
                  <h2 id={isSanctionDialogOpen ? "sanction-dialog-title" : undefined}>{editingCardId ? "Editar sanción" : "Registrar sanción"}</h2>
                </div>
                {editingCardId ? (
                  <button type="button" className="button button-secondary sanction-dialog-close" onClick={resetCardForm}>
                    Cerrar
                  </button>
                ) : null}
              </div>
              <form onSubmit={saveCard} className="admin-form-grid">
                <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1", marginBottom: 6 }}>
                  <div className="pill" style={{ background: "rgba(47, 201, 138, 0.12)", color: "#a9f0d0" }}>
                    Operativo • {visibleTeams.length} equipos
                  </div>
                  <div className="pill" style={{ background: "rgba(212, 173, 77, 0.12)", color: "#f4d78d" }}>
                    {visibleTeams.reduce((sum, team) => sum + team.players.length, 0)} jugadores
                  </div>
                </div>

                <label>
                  Equipo
                  <select value={cardForm.team} onChange={(event) => {
                    const nextTeam = event.target.value;
                    const nextPlayer = playerRosterByTeam[nextTeam]?.[0] ?? "";
                    const nextRound = calendarRounds.find((round) => round.status !== "upcoming" && matchResults.some((match) =>
                      match.jornada === round.title
                      && (match.home === nextTeam || match.away === nextTeam)
                      && Boolean(match.score && match.score !== "-")
                    ));
                    setCardForm((previous) => ({
                      ...previous,
                      team: nextTeam,
                      player: nextPlayer,
                      jornada: nextRound?.title ?? "",
                    }));
                  }}>
                    {visibleTeams.map((team) => (
                      <option key={team.name} value={team.name}>{team.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Buscar jugador
                  <input value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} placeholder="Nombre del jugador" />
                </label>
                <label>
                  Jugador
                  <select value={cardForm.player} onChange={(event) => setCardForm((previous) => ({ ...previous, player: event.target.value }))}>
                    {selectedTeamPlayers.length > 0 ? (
                      selectedTeamPlayers.map((player) => (
                        <option key={player} value={player}>{player}</option>
                      ))
                    ) : (
                      <option value="">Sin jugadores</option>
                    )}
                  </select>
                  <small className="yellow-card-counter">
                    Amarillas acumuladas: {selectedPlayerYellowCards}/3
                    {selectedPlayerYellowCards === 2 ? " · la próxima en otra jornada genera 1 partido de suspensión" : ""}
                  </small>
                </label>
                <label>
                  Jornada
                  <select value={effectiveSanctionJornada} onChange={(event) => setCardForm((previous) => ({ ...previous, jornada: event.target.value }))}>
                    {sanctionRounds.length > 0 ? sanctionRounds.map((round) => (
                      <option key={round.id} value={round.title}>{round.title}</option>
                    )) : <option value="">Sin partidos finalizados</option>}
                  </select>
                </label>
                <label>
                  Tarjeta
                  <select value={cardForm.card} onChange={(event) => setCardForm((previous) => ({
                    ...previous,
                    card: event.target.value as CardType,
                    reason: (["Amarilla", "Doble amarilla", "Roja"] as CardType[]).includes(event.target.value as CardType)
                      && !(["Motivos deportivos", "Motivos antideportivos", "Otros motivos"] as SanctionReason[]).includes(previous.reason)
                      ? "Motivos deportivos"
                      : (["Amarilla", "Doble amarilla"] as CardType[]).includes(event.target.value as CardType) ? "Motivos deportivos" : previous.reason,
                  }))}>
                    <option value="Amarilla">Amarilla</option>
                    <option value="Doble amarilla">Doble amarilla</option>
                    <option value="Roja">Roja</option>
                    <option value="Otra">Otra sanción</option>
                  </select>
                </label>
                <label>
                  Puntos
                  <input value={getSanctionPoints(cardForm.card, cardForm.reason)} readOnly />
                </label>
                <label>
                  Motivo
                  <select
                    value={cardForm.reason}
                    disabled={cardForm.card === "Amarilla" || cardForm.card === "Doble amarilla"}
                    onChange={(event) => setCardForm((previous) => ({ ...previous, reason: event.target.value as SanctionReason }))}
                  >
                    <option value="Motivos deportivos">Motivos deportivos</option>
                    <option value="Motivos antideportivos">Motivos antideportivos</option>
                    {cardForm.card !== "Roja" ? <option value="Motivos de vestimenta/indumentaria no oficial">Motivos de vestimenta/indumentaria no oficial</option> : null}
                    <option value="Otros motivos">Otros motivos</option>
                  </select>
                </label>
                {cardForm.card === "Roja" && cardForm.reason === "Motivos antideportivos" ? (
                  <>
                    <label>
                      Motivo de la roja antideportiva
                      <select value={cardForm.suspensionReason} onChange={(event) => setCardForm((previous) => ({ ...previous, suspensionReason: event.target.value as SuspensionReason }))}>
                        <option value="Encararse con otro jugador">Encararse con otro jugador · 2 partidos</option>
                        <option value="Insultar o faltar al respeto al árbitro">Insultar o faltar al respeto al árbitro · 3 partidos</option>
                        <option value="Motivo deportivo violento">Motivo deportivo violento · 4 partidos</option>
                        <option value="Otro motivo">Otro motivo</option>
                      </select>
                    </label>
                    {cardForm.suspensionReason === "Otro motivo" ? (
                      <label>
                        Partidos de suspensión
                        <input type="number" min="0" value={cardForm.suspensionMatches} onChange={(event) => setCardForm((previous) => ({ ...previous, suspensionMatches: event.target.value }))} />
                      </label>
                    ) : null}
                  </>
                ) : null}
                {(cardForm.card === "Otra" || cardForm.reason === "Otros motivos") ? (
                  <>
                    <label>
                      Puntos / importe manual
                      <input type="number" min="0" value={cardForm.manualAmount} onChange={(event) => setCardForm((previous) => ({ ...previous, manualAmount: event.target.value }))} placeholder="Introduce el valor" />
                    </label>
                    {cardForm.card === "Otra" ? (
                      <label>
                        Partidos de suspensión
                        <input type="number" min="0" step="1" value={cardForm.suspensionMatches} onChange={(event) => setCardForm((previous) => ({ ...previous, suspensionMatches: event.target.value }))} />
                      </label>
                    ) : null}
                  </>
                ) : null}
                <div className="form-actions" style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                  <button type="submit" className="action-button">{editingCardId ? "Guardar cambios" : "Registrar sanción"}</button>
                  {editingCardId ? (
                    <button type="button" className="button button-secondary" onClick={resetCardForm}>Cancelar</button>
                  ) : null}
                </div>
              </form>
              <div className="admin-form-grid" style={{ marginTop: 18 }}>
                <label>
                  Puntos tarjeta amarilla
                  <input type="number" min="0" value={penaltyPoints.yellow} onChange={(event) => updatePenaltyPoints("yellow", Number(event.target.value) || 0)} />
                </label>
                <label>
                  Puntos doble amarilla
                  <input type="number" min="0" value={penaltyPoints.doubleYellow} onChange={(event) => updatePenaltyPoints("doubleYellow", Number(event.target.value) || 0)} />
                </label>
                <label>
                  Puntos roja deportiva
                  <input type="number" min="0" value={penaltyPoints.red} onChange={(event) => updatePenaltyPoints("red", Number(event.target.value) || 0)} />
                </label>
                <label>
                  Puntos otras amonestaciones
                  <input type="number" min="0" value={penaltyPoints.other} onChange={(event) => updatePenaltyPoints("other", Number(event.target.value) || 0)} />
                </label>
                <p style={{ gridColumn: "1 / -1", color: "#b0bab8", fontSize: 12, margin: 0 }}>
                  Una roja con motivo antideportivo aplica automáticamente el doble de puntos.
                </p>
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ color: "#b0bab8", fontSize: 12 }}>
                    El contador de amarillas se acumula por jornadas distintas y se reinicia tras cumplir la suspensión.
                  </span>
                  <button type="button" className="button button-secondary" onClick={() => void resetYellowCardCount()} disabled={isSavingStore}>
                    Reiniciar amarillas
                  </button>
                </div>
              </div>
            </div>

            <div className="content-card sanction-overview-panel">
              <div className="section-header compact-header">
                <h2>Sanciones en curso</h2>
                <span>{currentSanctions.length} activas</span>
              </div>
              <div className="sanction-active-list" style={{ marginBottom: 20 }}>
                {currentSanctions.length > 0 ? currentSanctions.map((record) => (
                  <div key={`active-${record.id}`} className="sanction-active-card">
                    <div className="sanction-active-main">
                      <strong>{record.player}</strong>
                      <span>{record.team}</span>
                    </div>
                    <div className="sanction-active-meta">
                      <span>{record.jornada ?? "Sin jornada"}</span>
                      <span>{record.card}</span>
                      <strong>{record.suspensionRemaining} {record.suspensionRemaining === 1 ? "partido" : "partidos"}</strong>
                    </div>
                    <small>{record.isYellowAccumulationSuspension ? "Acumulación 3 amarillas" : record.reason}</small>
                  </div>
                )) : <p className="empty-state">No hay suspensiones activas.</p>}
              </div>

              <div className="section-header compact-header" style={{ marginTop: 4 }}>
                <h2>Puntos por equipo</h2>
                <span>Acumulado</span>
              </div>
              <div className="team-points-list" style={{ marginBottom: 20 }}>
                {teamSanctionPoints.map(([team, points]) => (
                  <div key={team} className="team-points-row">
                    <TeamIdentity name={team} compact />
                    <strong className={points <= 0 ? "low" : points <= 4 ? "medium" : points <= 8 ? "high" : "critical"}>{points}</strong>
                  </div>
                ))}
              </div>

            </div>

            <div className="sanction-summary-row">
              <div className="content-card">
                <div className="section-header compact-header">
                  <h2>Tarjetas acumuladas</h2>
                  <span>{accumulatedYellowCards.length} jugadores</span>
                </div>
                <div className="team-points-list">
                  {accumulatedYellowCards.length > 0 ? accumulatedYellowCards.map((record) => (
                    <div key={`${record.team}-${record.player}`} className="team-points-row">
                      <span><strong>{record.player}</strong><small style={{ display: "block", color: "#b0bab8", marginTop: 3 }}>{record.team}</small></span>
                      <strong className={record.yellowCards === 2 ? "critical" : "medium"}>{record.yellowCards}/3</strong>
                    </div>
                  )) : <p className="empty-state">No hay jugadores con amarillas acumuladas.</p>}
                </div>
              </div>

              <div className="content-card">
                <div className="section-header compact-header">
                  <h2>Nuevas sanciones</h2>
                  <span>{latestRoundSanctions.roundTitle}</span>
                </div>
                <div className="team-points-list">
                  {latestRoundSanctions.records.length > 0 ? latestRoundSanctions.records.map((record) => (
                    <div key={`new-${record.id}`} className="team-points-row">
                      <span><strong>{record.player}</strong><small style={{ display: "block", color: "#b0bab8", marginTop: 3 }}>{record.team} · {record.card}</small></span>
                      <strong className="medium">€{Number(record.costAmount ?? record.cost_amount ?? 0)}</strong>
                    </div>
                  )) : <p className="empty-state">No hay sanciones nuevas en la última jornada.</p>}
                </div>
                <div className="sanction-payment-total"><span>Total a cobrar</span><strong>€{latestRoundSanctions.total}</strong></div>
              </div>
            </div>

            <div className="content-card sanction-history-panel">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }}>
                <h2>Historial de temporada</h2>
                <span className="pill" style={{ background: "rgba(212, 173, 77, 0.12)", color: "#f4d78d" }}>{cardDocket.length} registros</span>
              </div>

              <label className="search-field" style={{ marginBottom: 16 }}>
                <span>Buscar sanción</span>
                <input
                  className="search-input"
                  value={sanctionsSearch}
                  onChange={(event) => setSanctionsSearch(event.target.value)}
                  placeholder="Jugador, equipo o motivo"
                />
              </label>

              <div className="table-wrap admin-sanction-history">
                {searchableSanctions.length > 0 ? (
                  <table className="league-table">
                    <thead>
                      <tr>
                        <th>Jornada</th>
                        <th>Jugador</th>
                        <th>Equipo</th>
                        <th>Tarjeta</th>
                        <th>Motivo</th>
                        <th>Puntos</th>
                        <th>Suspensión</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchableSanctions.map((record) => (
                        <tr key={record.id} onClick={() => startEditCard(record)} className="admin-sanction-row">
                          <td>{record.jornada ?? "Sin jornada"}</td>
                          <td><strong>{record.player}</strong></td>
                          <td><TeamIdentity name={record.team} compact /></td>
                          <td><span className={`sanction-badge ${record.card.toLowerCase().replace(/ /g, "-")}`}>{record.card}</span></td>
                          <td>{record.reason}</td>
                          <td><strong>{record.points ?? record.pointsAmount ?? 0}</strong></td>
                          <td>{record.suspensionMatches ? `${record.suspensionMatches} ${record.suspensionMatches === 1 ? "partido" : "partidos"}` : "Sin suspensión"}</td>
                          <td className="sanction-row-actions">
                            <button type="button" className="button button-secondary table-action" onClick={(event) => { event.stopPropagation(); startEditCard(record); }}>
                              Editar
                            </button>
                            <button type="button" className="button button-secondary table-action danger-action" onClick={(event) => { event.stopPropagation(); void deleteSanction(record.id); }}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="pill" style={{ background: "rgba(255,255,255,0.02)", color: "#b0bab8", justifyContent: "center" }}>
                    No hay sanciones que coincidan con la búsqueda
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      case "economia":
        return (
          <section className="two-column">
            <div className="content-card economy-panel">
              <div className="economy-heading">
                <div>
                  <p className="eyebrow">Control financiero</p>
                  <h2>Economía de la liga</h2>
                </div>
              </div>

              <div className="tabs" role="tablist" aria-label="Tipos de movimiento económico" style={{ marginTop: 18, marginBottom: 18 }}>
                <button type="button" className={`tab ${economyTab === "cuotas" ? "active" : ""}`} onClick={() => setEconomyTab("cuotas")}>Cuotas</button>
                <button type="button" className={`tab ${economyTab === "patrocinadores" ? "active" : ""}`} onClick={() => setEconomyTab("patrocinadores")}>Patrocinadores</button>
                <button type="button" className={`tab ${economyTab === "otros" ? "active" : ""}`} onClick={() => setEconomyTab("otros")}>Otros movimientos</button>
              </div>

              {economyTab === "cuotas" ? (
                <form onSubmit={payPreviousChampionPrize} className="quota-single-form">
                  <div className="admin-form-grid" style={{ marginBottom: 16 }}>
                    <label>
                      Cuota base por equipo
                      <div className="quota-global-input-row">
                        <input
                          type="number"
                          min={0}
                          value={quotaForm.cuotaBase}
                          onChange={(event) => setQuotaForm((previous) => ({ ...previous, cuotaBase: Number(event.target.value) || 0 }))}
                        />
                        <button type="button" className="button button-secondary table-action" onClick={() => void saveGlobalQuota()}>
                          Aplicar a todos
                        </button>
                      </div>
                    </label>
                    <label>
                      Campeón temporada anterior
                      <select
                        value={selectedQuotaTeam?.name ?? ""}
                        onChange={(event) => setQuotaForm((previous) => ({ ...previous, teamName: event.target.value }))}
                      >
                        {storeTeams.map((team) => (
                          <option key={team.id} value={team.name}>{team.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="quota-selected-team">
                    <div>
                      <span className="eyebrow">Premio a pagar</span>
                      <strong>{selectedQuotaTeam?.name ?? "Sin equipos"}</strong>
                    </div>
                    <strong className="money">€{quotaForm.cuotaBase}</strong>
                  </div>

                  <div className="form-actions" style={{ marginTop: 16 }}>
                    <button type="submit" className="action-button">Pagar cuota al campeón</button>
                  </div>

                  <div className="quota-pending-summary">
                    <div className="quota-pending-heading">
                      <div>
                        <span className="eyebrow">Seguimiento por equipo</span>
                        <strong>Cuotas pendientes</strong>
                      </div>
                      <span>{quotaPendingSummary.length} equipos</span>
                    </div>
                    <div className="quota-pending-list">
                      {quotaPendingSummary.map((entry) => (
                        <div key={entry.team} className="quota-pending-row">
                          <div>
                            <strong><TeamIdentity name={entry.team} compact /></strong>
                            <small>Pagado: €{entry.paid} de €{entry.expected}</small>
                          </div>
                          <div className="quota-pending-amount">
                            <input
                              type="number"
                              min={0}
                              max={entry.pending}
                              aria-label={`Nuevo abono de ${entry.team}`}
                              placeholder="Importe"
                              value={quotaPaidDrafts[entry.team] ?? ""}
                              onChange={(event) => setQuotaPaidDrafts((previous) => ({ ...previous, [entry.team]: event.target.value }))}
                            />
                            <strong className={entry.pending > 0 ? "money" : "quota-paid"}>€{entry.pending}</strong>
                            <span className={`status status-${entry.status.toLowerCase()}`}>{entry.status}</span>
                            <button type="button" className="button button-secondary table-action" onClick={() => void saveQuotaInstallment(entry.team)}>
                              Pagar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              ) : null}

              {economyTab === "patrocinadores" ? (
                <form onSubmit={addExpense} className="admin-form-grid" style={{ marginTop: 6 }}>
                  <label>
                    Patrocinador
                    <select
                      value={sponsorForm.suggestedSponsor}
                      onChange={(event) => {
                        const value = event.target.value;
                        setSponsorForm((previous) => ({ ...previous, suggestedSponsor: value, sponsorName: value }));
                        setExpenseForm((current) => ({ ...current, entity: value }));
                      }}
                    >
                      <option value="">Nuevo patrocinador</option>
                      {allSponsors.map((sponsor) => (
                        <option key={sponsor} value={sponsor}>{sponsor}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Nombre del patrocinador
                    <input
                      value={sponsorForm.sponsorName || sponsorForm.suggestedSponsor}
                      onChange={(event) => {
                        const value = event.target.value;
                        setSponsorForm((previous) => ({ ...previous, sponsorName: value }));
                        setExpenseForm((current) => ({ ...current, entity: value }));
                      }}
                    />
                  </label>

                  <label>
                    Importe previsto
                    <input type="number" value={sponsorForm.expectedAmount} onChange={(event) => setSponsorForm((previous) => ({ ...previous, expectedAmount: event.target.value }))} />
                  </label>
                  <label>
                    Importe recibido
                    <input type="number" value={sponsorForm.receivedAmount} onChange={(event) => setSponsorForm((previous) => ({
                      ...previous,
                      receivedAmount: event.target.value,
                      expectedAmount: previous.expectedAmount,
                    }))} />
                  </label>
                  <label>
                    Fecha
                    <input type="date" value={sponsorForm.date} onChange={(event) => setSponsorForm((previous) => ({ ...previous, date: event.target.value }))} />
                  </label>

                  <div className="form-actions" style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="action-button"
                      onClick={() => {
                        const paid = Number(sponsorForm.receivedAmount) || 0;
                        const entity = (sponsorForm.sponsorName || sponsorForm.suggestedSponsor || "Patrocinador").trim();
                        const existingSponsorTotals = expenseItems
                          .filter((item) => item.kind === "patrocinio" && (item.entity ?? item.sponsorName ?? "Sin patrocinador").trim() === entity)
                          .reduce((totals, item) => ({
                            amount: totals.amount + (item.settlementOnly ? 0 : Number(item.amount) || 0),
                            paid: totals.paid + (Number(item.paid ?? 0) || 0),
                          }), { amount: 0, paid: 0 });
                        const hasExpectedAmount = Number(sponsorForm.expectedAmount) > 0;
                        const pendingBeforePayment = Math.max(existingSponsorTotals.amount - existingSponsorTotals.paid, 0);
                        const settlementOnly = !hasExpectedAmount && paid > 0 && pendingBeforePayment > 0;
                        const value = hasExpectedAmount ? Number(sponsorForm.expectedAmount) : paid;
                        const sponsorValues = {
                          concept: "Abono patrocinio",
                          entity,
                          amount: String(value),
                          paid: String(paid),
                          type: "cobro" as ExpenseType,
                          category: "Patrocinio",
                          date: sponsorForm.date,
                          status: paid >= value ? "pagado" as const : "pendiente" as const,
                          settlementOnly,
                        };
                        setExpenseForm((previous) => ({ ...previous, ...sponsorValues }));
                        void addExpense({ preventDefault: () => undefined } as React.FormEvent<HTMLFormElement>, sponsorValues);
                      }}
                    >
                      Guardar patrocinio
                    </button>
                  </div>
                </form>
              ) : null}

              {economyTab === "otros" ? (
                <form onSubmit={addExpense} className="admin-form-grid" style={{ marginTop: 6 }}>
                  <label>
                    Concepto
                    <input value={expenseForm.concept} onChange={(event) => setExpenseForm((previous) => ({ ...previous, concept: event.target.value }))} />
                  </label>
                  <label>
                    Entidad / proveedor
                    <input value={expenseForm.entity} onChange={(event) => setExpenseForm((previous) => ({ ...previous, entity: event.target.value }))} />
                  </label>
                  <label>
                    Tipo
                    <select value={expenseForm.type} onChange={(event) => setExpenseForm((previous) => ({ ...previous, type: event.target.value as ExpenseType, category: event.target.value === "cobro" ? "Otros" : "Gasto" }))}>
                      <option value="gasto">Gasto</option>
                      <option value="cobro">Cobro</option>
                    </select>
                  </label>
                  <label>
                    Categoria
                    <select value={expenseForm.category} onChange={(event) => setExpenseForm((previous) => ({ ...previous, category: event.target.value }))}>
                      <option value="Gasto">Gasto</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </label>
                  <label>
                    Importe total
                    <input type="number" value={expenseForm.amount} onChange={(event) => setExpenseForm((previous) => ({ ...previous, amount: event.target.value }))} />
                  </label>
                  <label>
                    Pagado / recibido
                    <input type="number" value={expenseForm.paid} onChange={(event) => setExpenseForm((previous) => ({ ...previous, paid: event.target.value }))} />
                  </label>
                  <label>
                    Fecha
                    <input type="date" value={expenseForm.date} onChange={(event) => setExpenseForm((previous) => ({ ...previous, date: event.target.value }))} />
                  </label>
                  <label>
                    Estado
                    <select value={expenseForm.status} onChange={(event) => setExpenseForm((previous) => ({ ...previous, status: event.target.value as "planificado" | "pendiente" | "pagado" }))}>
                      <option value="planificado">Planificado</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="pagado">Pagado</option>
                    </select>
                  </label>

                  <div className="form-actions" style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                    <button type="submit" className="action-button">Guardar movimiento</button>
                    {editingExpenseId !== null ? (
                      <button type="button" className="button button-secondary" onClick={resetExpenseForm}>Cancelar</button>
                    ) : null}
                  </div>
                </form>
              ) : null}

            </div>

            <div className="content-card economy-panel economy-history-panel">
              <div className="content-card cash-summary" style={{ marginBottom: 18 }}>
                <div className="cash-summary-heading">
                  <div>
                    <p className="eyebrow">Balance de la liga</p>
                    <strong>Caja</strong>
                  </div>
                  <strong className={`cash-balance ${cashAvailable >= 0 ? "positive" : "negative"}`}>€{cashAvailable}</strong>
                </div>

                <div className="cash-summary-grid">
                  <div className="cash-metric income">
                    <span>Ingresos reales</span>
                    <strong>€{totalIncome}</strong>
                    <small>Cuotas €{currentQuotaIncome} · Patrocinios €{currentSponsorIncome} · Otros €{currentOtherIncome}</small>
                  </div>
                  <div className="cash-metric expense">
                    <span>Gastos reales</span>
                    <strong>€{totalExpense}</strong>
                    <small>Movimientos pagados y sanciones</small>
                  </div>
                  <div className="cash-metric projected">
                    <span>Ingresos previstos</span>
                    <strong>€{projectedIncome}</strong>
                    <small>Si se cobran todos los pendientes</small>
                  </div>
                  <div className="cash-metric projected">
                    <span>Gastos previstos</span>
                    <strong>€{projectedExpense}</strong>
                    <small>Si se pagan todos los pendientes</small>
                  </div>
                </div>

                <div className="cash-projection-row">
                  <span>Saldo previsto</span>
                  <strong>€{projectedCash}</strong>
                </div>

                <div className="cash-pending-list">
                  <div><span>Pendiente cuotas</span><strong>€{pendingQuotaIncome}</strong></div>
                  <div><span>Pendiente patrocinadores</span><strong>€{pendingSponsorDebt}</strong></div>
                  <div><span>Pendiente otros</span><strong>€{pendingOtherMovements}</strong></div>
                </div>
              </div>

              <div className="economy-heading">
                <div>
                  <p className="eyebrow">Seguimiento</p>
                  <h2>Histórico de movimientos</h2>
                </div>
                <button type="button" className="button button-secondary economy-export-button" onClick={exportMovementsToExcel}>
                  Exportar Excel
                </button>
              </div>

              <div className="admin-form-grid economy-filters" style={{ marginTop: 18, marginBottom: 18 }}>
                <label>
                  Filtrar por tipo
                  <select value={movementFilter} onChange={(event) => setMovementFilter(event.target.value as "todos" | FinanceKind)}>
                    <option value="todos">Todos</option>
                    <option value="cuota">Cuotas</option>
                    <option value="patrocinio">Patrocinadores</option>
                    <option value="premio">Premios</option>
                    <option value="otro">Otros movimientos</option>
                  </select>
                </label>
                <label>
                  Buscar movimiento
                  <input value={movementSearch} onChange={(event) => setMovementSearch(event.target.value)} placeholder="Concepto o entidad" />
                </label>
              </div>

              <div className="table-wrap" style={{ marginTop: 18 }}>
                <table className="economy-movement-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Concepto</th>
                      <th>Entidad</th>
                      <th>Importe total</th>
                      <th>Pagado / recibido</th>
                      <th>Pendiente</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(expenseItems.filter((item) => {
                      const matchesType = movementFilter === "todos" || item.kind === movementFilter;
                      const term = movementSearch.trim().toLowerCase();
                      const matchesSearch = !term || [item.concept, item.entity ?? "", item.category ?? ""].join(" ").toLowerCase().includes(term);
                      return matchesType && matchesSearch;
                    })).map((item) => {
                      const draft = inlineMovementDrafts[item.id] ?? {};
                      const current = { ...item, ...draft };
                      const effectivePaid = Number(current.paid ?? item.paid ?? 0) || 0;
                      const effectiveAmount = Number(current.amount ?? item.amount) || 0;
                      const effectivePending = current.kind === "cuota" && current.entity
                        ? Math.max((registrationFees[current.entity] ?? quotaForm.cuotaBase) - (teamPayments[current.entity] ?? 0), 0)
                        : current.kind === "patrocinio"
                          ? Math.max((sponsorTotalsByEntity.get(current.entity?.trim() || "Sin patrocinador")?.amount ?? effectiveAmount) - (sponsorTotalsByEntity.get(current.entity?.trim() || "Sin patrocinador")?.paid ?? effectivePaid), 0)
                        : Math.max(effectiveAmount - effectivePaid, 0);

                      return (
                        <tr key={item.id}>
                          <td>
                            <select
                              value={String(current.kind ?? item.kind ?? "otro")}
                              onChange={(event) => setInlineMovementDrafts((previous) => ({ ...previous, [item.id]: { ...item, ...previous[item.id], kind: event.target.value as FinanceKind } }))}
                            >
                              <option value="cuota">Cuota</option>
                              <option value="patrocinio">Patrocinio</option>
                              <option value="premio">Premio</option>
                              <option value="otro">Otro</option>
                            </select>
                          </td>
                          <td>
                            <input
                              value={current.concept ?? ""}
                              onChange={(event) => setInlineMovementDrafts((previous) => ({ ...previous, [item.id]: { ...item, ...previous[item.id], concept: event.target.value } }))}
                            />
                          </td>
                          <td>
                            <input
                              value={current.entity ?? ""}
                              onChange={(event) => setInlineMovementDrafts((previous) => ({ ...previous, [item.id]: { ...item, ...previous[item.id], entity: event.target.value } }))}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={effectiveAmount}
                              onChange={(event) => setInlineMovementDrafts((previous) => ({ ...previous, [item.id]: { ...item, ...previous[item.id], amount: Number(event.target.value) || 0 } }))}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={effectivePaid}
                              onChange={(event) => setInlineMovementDrafts((previous) => ({ ...previous, [item.id]: { ...item, ...previous[item.id], paid: Number(event.target.value) || 0 } }))}
                            />
                          </td>
                          <td>
                            <input
                              className="movement-pending-input"
                              type="number"
                              value={effectivePending}
                              readOnly
                              aria-label={`Pendiente de ${current.entity ?? current.concept ?? "este movimiento"}`}
                              title={current.kind === "cuota" ? "Cuota global del equipo menos todos sus pagos" : "Importe total menos pagado o recibido"}
                            />
                          </td>
                          <td>
                            <input
                              type="date"
                              value={current.date ?? ""}
                              onChange={(event) => setInlineMovementDrafts((previous) => ({ ...previous, [item.id]: { ...item, ...previous[item.id], date: event.target.value } }))}
                            />
                          </td>
                          <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" className="button button-secondary table-action" onClick={() => void saveInlineMovement(item)}>
                              Guardar
                            </button>
                            <button type="button" className="button button-secondary table-action danger-action" onClick={() => {
                              void deleteMovement(item);
                            }}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          </section>
        );
      default:
        return (
          <section className="two-column">
            <div className="content-card">
              <h2>Temporadas</h2>
              <form onSubmit={addSeason} className="admin-form-grid">
                <label>
                  Nombre
                  <input value={seasonForm.name} onChange={(event) => setSeasonForm((previous) => ({ ...previous, name: event.target.value }))} />
                </label>
                <label>
                  Año inicio
                  <input type="number" value={seasonForm.yearStart} onChange={(event) => setSeasonForm((previous) => ({ ...previous, yearStart: Number(event.target.value) || 2026 }))} />
                </label>
                <label>
                  Año fin
                  <input type="number" value={seasonForm.yearEnd} onChange={(event) => setSeasonForm((previous) => ({ ...previous, yearEnd: Number(event.target.value) || 2027 }))} />
                </label>
                <label>
                  Temporada activa
                  <select value={seasonForm.isActive ? "true" : "false"} onChange={(event) => setSeasonForm((previous) => ({ ...previous, isActive: event.target.value === "true" }))}>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </label>
                <div className="form-actions" style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                  <button type="submit" className="action-button">{editingSeasonId ? "Actualizar temporada" : "Guardar temporada"}</button>
                  {editingSeasonId ? (
                    <button type="button" className="button button-secondary" onClick={resetSeasonForm}>Cancelar</button>
                  ) : null}
                </div>
              </form>
            </div>

            <div className="content-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <h2>Equipos</h2>
                <button type="button" className="button button-secondary" onClick={() => openTeamDialog()}>
                  + Nuevo equipo
                </button>
              </div>

              <label className="search-field" style={{ display: "block", marginBottom: 16 }}>
                <span>Buscar equipo</span>
                <input
                  className="search-input"
                  value={teamSearch}
                  onChange={(event) => setTeamSearch(event.target.value)}
                  placeholder="Escribe el nombre del equipo"
                />
              </label>

              <div style={{ display: "grid", gap: 12 }}>
                {searchableTeams.length > 0 ? (
                  searchableTeams.map((team) => (
                    <div key={team.id} className="content-card" style={{ padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <strong style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: team.primaryColor || teamColors[team.name]?.primary || "#117d5f", boxShadow: `0 0 0 3px ${team.primaryColor || teamColors[team.name]?.primary || "#117d5f"}22` }} />
                            <TeamIdentity name={team.name} imageFile={team.shieldImage} compact />
                          </strong>
                          <div style={{ color: "#b0bab8", fontSize: 12, marginTop: 4 }}>{team.stadiumName || team.stadium_name || "Tabira"}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" className="button button-secondary" onClick={() => openTeamDialog(team)}>
                            Editar equipo
                          </button>
                          <button type="button" className="button button-secondary" onClick={() => openPlayerDialog(team)}>
                            + Jugador
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {team.players.length > 0 ? (
                          team.players.map((player) => (
                            <button
                              key={`${team.id}-${player.name}`}
                              type="button"
                              className="pill"
                              style={{ background: "rgba(255,255,255,0.04)", color: "#edf3f1", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}
                              onClick={() => openPlayerDialog(team, player)}
                            >
                              {player.name}{typeof player.dorsal !== "undefined" && player.dorsal !== "" && player.dorsal !== 0 ? ` (${player.dorsal})` : ""}
                            </button>
                          ))
                        ) : (
                          <span className="pill" style={{ background: "rgba(255,255,255,0.02)", color: "#b0bab8" }}>Sin jugadores</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="pill" style={{ background: "rgba(255,255,255,0.02)", color: "#b0bab8", justifyContent: "center" }}>
                    No hay equipos que coincidan con la búsqueda
                  </div>
                )}
              </div>
            </div>
          </section>
        );
    }
  };

  return (
    <main className="page-shell admin-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Panel del organizador</h1>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button type="button" className="button button-secondary" onClick={logoutAdmin}>Cerrar sesión</button>
          <Link href="/" className="button button-secondary">Salir</Link>
        </div>
      </header>

      {isSavingStore ? (
        <section className="content-card" style={{ marginBottom: 20 }}>
          <strong>Guardando cambios…</strong>
        </section>
      ) : null}

      {saveFeedback ? (
        <section className={`admin-feedback ${saveFeedback.type === "error" ? "error" : ""}`} role={saveFeedback.type === "error" ? "alert" : "status"}>
          <div>
            <strong>{saveFeedback.type === "error" ? "No se ha podido guardar" : "Guardado correcto"}</strong>
            <span>{saveFeedback.message}</span>
          </div>
        </section>
      ) : null}

      {isLoadingStore ? (
        <section className="content-card" style={{ marginBottom: 20 }}>
          <strong>Cargando datos de la liga…</strong>
        </section>
      ) : null}

      {(formError || (storeError && !saveFeedback)) ? (
        <section className="content-card" style={{ marginBottom: 20, borderColor: "rgba(239, 68, 68, 0.45)" }}>
          <strong style={{ color: "#fca5a5" }}>Aviso del sistema</strong>
          <p style={{ marginTop: 8, color: "#fecaca" }}>{formError ?? storeError}</p>
        </section>
      ) : null}

      <section className="stats-grid admin-grid">
        <article className="stat-card admin-card">
          <span>Equipos</span>
          <strong>{storeTeams.length}</strong>
        </article>
        <article className="stat-card admin-card">
          <span>Partidos jugados</span>
          <strong>{playedMatches}</strong>
        </article>
        <article className="stat-card admin-card">
          <span>Partidos restantes</span>
          <strong>{pendingMatches}</strong>
        </article>
        <article className="stat-card admin-card">
          <span>Jornada actual</span>
          <strong>{currentRound?.title ?? "Sin jornada"}</strong>
          <small>{currentRoundMatches} partidos programados</small>
        </article>
        <article className="stat-card admin-card">
          <span>Resultados pendientes</span>
          <strong>{currentRoundPendingResults}</strong>
          <small>de la jornada actual</small>
        </article>
      </section>

      <section className="stats-grid admin-grid margin-top-compact">
        <article className="stat-card admin-card">
          <span>Inscripciones</span>
          <strong>€{totalRegistrationFees}</strong>
        </article>
        <article className={`stat-card admin-card ${pendingRegistrationFees !== 0 ? "danger" : ""}`}>
          <span>Pendiente Inscripciones</span>
          <strong>€{pendingRegistrationFees}</strong>
        </article>
        <article className="stat-card admin-card">
          <span>Sanciones</span>
          <strong>€{totalSanctionBalance}</strong>
        </article>
        <article className={`stat-card admin-card ${pendingSanctionBalance !== 0 ? "danger" : ""}`}>
          <span>Pendiente sanciones</span>
          <strong>€{pendingSanctionBalance}</strong>
        </article>
        <article className={`stat-card admin-card highlight ${cashAvailable >= 0 ? "success" : "danger"}`}>
          <span>Caja disponible</span>
          <strong>€{cashAvailable}</strong>
        </article>
      </section>

      <div className="tabs" role="tablist" aria-label="Administración de la liga">
        {adminTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isTeamDialogOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(4, 8, 10, 0.72)",
            backdropFilter: "blur(6px)",
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => {
            setIsTeamDialogOpen(false);
            resetTeamForm();
          }}
        >
          <div
            className="content-card"
            style={{
              width: "min(680px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 22,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>{editingTeamId ? "Editar equipo" : "Nuevo equipo"}</h2>
              <button type="button" className="button button-secondary" onClick={() => {
                setIsTeamDialogOpen(false);
                resetTeamForm();
              }}>
                Cerrar
              </button>
            </div>

            <form onSubmit={addTeam} className="admin-form-grid">
              <label>
                Temporada
                <select value={teamForm.seasonId} onChange={(event) => setTeamForm((previous) => ({ ...previous, seasonId: event.target.value }))}>
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>{season.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Nombre
                <input value={teamForm.name} onChange={(event) => setTeamForm((previous) => ({ ...previous, name: event.target.value }))} />
              </label>
              <label>
                Alias
                <input value={teamForm.shortName} onChange={(event) => setTeamForm((previous) => ({ ...previous, shortName: event.target.value }))} />
              </label>
              <label>
                Estadio
                <input value={teamForm.stadiumName} onChange={(event) => setTeamForm((previous) => ({ ...previous, stadiumName: event.target.value }))} />
              </label>
              <label>
                Color del equipo
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="color"
                    value={teamForm.primaryColor}
                    onChange={(event) => setTeamForm((previous) => ({ ...previous, primaryColor: event.target.value }))}
                    style={{ width: 52, height: 42, padding: 4, cursor: "pointer" }}
                  />
                  <span style={{ color: "#b0bab8", fontSize: 12 }}>{teamForm.primaryColor}</span>
                </div>
              </label>
              <label>
                Escudo del equipo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setTeamForm((previous) => ({ ...previous, shieldImage: typeof reader.result === "string" ? reader.result : previous.shieldImage }));
                    reader.readAsDataURL(file);
                  }}
                />
                <select value={teamForm.shieldImage} onChange={(event) => setTeamForm((previous) => ({ ...previous, shieldImage: event.target.value }))}>
                  <option value="">Usar escudo por defecto</option>
                  {shieldImageOptions.map((image) => (
                    <option key={image} value={image}>{image.replace(/\.png$/i, "")}</option>
                  ))}
                </select>
                {teamForm.shieldImage ? (
                  <img className="team-editor-shield-preview" src={resolveSupabaseImageUrl(teamForm.shieldImage)} alt="Vista previa del escudo" />
                ) : null}
              </label>

              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="button button-secondary" onClick={() => {
                  setIsTeamDialogOpen(false);
                  resetTeamForm();
                }}>
                  Cancelar
                </button>
                <button type="submit" className="action-button">
                  {editingTeamId ? "Actualizar equipo" : "Guardar equipo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isPlayerDialogOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(4, 8, 10, 0.72)",
            backdropFilter: "blur(6px)",
            zIndex: 120,
            padding: 20,
          }}
          onClick={() => {
            setIsPlayerDialogOpen(false);
            resetPlayerForm();
          }}
        >
          <div
            className="content-card"
            style={{
              width: "min(560px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 22,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>{editingPlayerId ? "Editar jugador" : "Nuevo jugador"}</h2>
              <button type="button" className="button button-secondary" onClick={() => {
                setIsPlayerDialogOpen(false);
                resetPlayerForm();
              }}>
                Cerrar
              </button>
            </div>

            <form onSubmit={addPlayer} className="admin-form-grid">
              <label>
                Equipo
                <select value={playerForm.teamId} onChange={(event) => setPlayerForm((previous) => ({ ...previous, teamId: event.target.value }))}>
                  {storeTeams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Nombre
                <input value={playerForm.name} onChange={(event) => setPlayerForm((previous) => ({ ...previous, name: event.target.value }))} />
              </label>
              <label>
                Dorsal
                <input value={playerForm.dorsal} onChange={(event) => setPlayerForm((previous) => ({ ...previous, dorsal: event.target.value }))} />
              </label>
              <label className="quota-checkbox-label">
                <input type="checkbox" checked={playerForm.isGoalkeeper} onChange={(event) => setPlayerForm((previous) => ({ ...previous, isGoalkeeper: event.target.checked }))} />
                <span>Es portero</span>
              </label>

              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="button button-secondary" onClick={() => {
                  setIsPlayerDialogOpen(false);
                  resetPlayerForm();
                }}>
                  Cancelar
                </button>
                <button type="submit" className="action-button">
                  {editingPlayerId ? "Actualizar jugador" : "Guardar jugador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isRoundDialogOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(4, 8, 10, 0.72)",
            backdropFilter: "blur(6px)",
            zIndex: 130,
            padding: 20,
          }}
          onClick={closeRoundDialog}
        >
          <div
            className="content-card"
            style={{
              width: "min(760px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 22,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>{editingRoundId ? "Editar jornada" : "Nueva jornada"}</h2>
              <button type="button" className="button button-secondary" onClick={closeRoundDialog}>
                Cerrar
              </button>
            </div>

            <form onSubmit={addRound} className="admin-form-grid">
              <label>
                Título
                <input value={roundForm.title} onChange={(event) => setRoundForm((previous) => ({ ...previous, title: event.target.value }))} />
              </label>
              <label>
                Fecha
                <div style={{ position: "relative" }}>
                  <input
                    type="date"
                    value={toIsoDateInput(roundForm.date)}
                    onChange={(event) => setRoundForm((previous) => ({ ...previous, date: event.target.value }))}
                    onClick={(event) => {
                      if (typeof event.currentTarget.showPicker === "function") {
                        event.currentTarget.showPicker();
                      }
                    }}
                    onFocus={(event) => {
                      if (typeof event.currentTarget.showPicker === "function") {
                        event.currentTarget.showPicker();
                      }
                    }}
                    style={{ width: "100%", paddingRight: 40 }}
                  />
                  <span aria-hidden="true" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 16 }}>📅</span>
                </div>
              </label>

              <div style={{ gridColumn: "1 / -1", overflowX: "auto", WebkitOverflowScrolling: "touch", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16 }}>
                <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                      <th style={{ textAlign: "left", padding: "10px 12px", color: "#b0bab8" }}>Hora</th>
                      <th style={{ textAlign: "left", padding: "10px 12px", color: "#b0bab8" }}>Local</th>
                      <th style={{ textAlign: "left", padding: "10px 12px", color: "#b0bab8" }}>Visitante</th>
                      <th style={{ textAlign: "right", padding: "10px 12px", color: "#b0bab8" }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roundForm.matches.map((match, index) => (
                      <tr key={`fixture-dialog-${index}`} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <td style={{ padding: "10px 12px" }}>
                          <select value={match.time || "16:00"} onChange={(event) => updateRoundFixture(index, "time", event.target.value)} style={{ width: "100%" }}>
                            {roundTimeOptions.map((time) => (
                              <option key={time} value={time}>{time}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <select value={match.home} onChange={(event) => updateRoundFixture(index, "home", event.target.value)} style={{ width: "100%" }}>
                            {visibleTeams.map((team) => <option key={team.name} value={team.name}>{team.name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <select value={match.away} onChange={(event) => updateRoundFixture(index, "away", event.target.value)} style={{ width: "100%" }}>
                            {visibleTeams.map((team) => <option key={team.name} value={team.name}>{team.name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          {roundForm.matches.length > 1 ? (
                            <button type="button" className="button button-secondary" onClick={() => removeRoundMatch(index)}>
                              Borrar
                            </button>
                          ) : (
                            <span style={{ color: "#8aa3a0" }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="button button-secondary" onClick={addRoundMatch}>+ Añadir cruce</button>
              </div>

              <div style={{ gridColumn: "1 / -1", border: "1px solid rgba(47,201,138,0.18)", background: "rgba(47,201,138,0.06)", borderRadius: 16, padding: 12 }}>
                <strong style={{ display: "block", marginBottom: 8 }}>Equipos que descansan</strong>
                {restingTeams.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {restingTeams.map((team) => (
                      <span key={team} className="pill" style={{ background: "rgba(255,255,255,0.03)", color: "#edf3f1" }}>{team}</span>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: "#b0bab8" }}>Todos los equipos tienen partido en esta jornada.</span>
                )}
              </div>

              <div className="form-actions" style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button type="button" className="button button-secondary" onClick={closeRoundDialog}>Cancelar</button>
                <button type="submit" className="action-button">{editingRoundId ? "Guardar cambios" : "Guardar jornada"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {renderTabContent()}
    </main>
  );
}
