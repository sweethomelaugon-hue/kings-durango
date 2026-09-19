export type FinanceKind = "cuota" | "patrocinio" | "premio" | "sancion" | "arbitros" | "campo" | "material" | "eventos" | "otro";

export const MOVEMENT_CONCEPT_OPTIONS: Array<{ value: FinanceKind; label: string }> = [
  { value: "cuota", label: "Cuota" },
  { value: "patrocinio", label: "Patrocinio" },
  { value: "premio", label: "Premio" },
  { value: "sancion", label: "Sanción" },
  { value: "arbitros", label: "Arbitros" },
  { value: "campo", label: "Campo" },
  { value: "material", label: "Material" },
  { value: "eventos", label: "Eventos" },
  { value: "otro", label: "Otros" },
];

export function normalizeFinanceKind(value?: string | null): FinanceKind {
  const normalized = String(value ?? "").trim().toLowerCase();

  switch (normalized) {
    case "cuota":
    case "quota":
      return "cuota";
    case "patrocinio":
    case "sponsor":
    case "patrocinador":
      return "patrocinio";
    case "premio":
    case "prize":
      return "premio";
    case "sancion":
    case "sanción":
    case "sanction":
      return "sancion";
    case "arbitros":
    case "arbitraje":
    case "arbitro":
      return "arbitros";
    case "campo":
    case "stadium":
      return "campo";
    case "material":
    case "materials":
      return "material";
    case "eventos":
    case "evento":
    case "events":
      return "eventos";
    case "otro":
    case "otros":
    case "other":
    default:
      return "otro";
  }
}

export function getMovementTypeLabel(type?: string | null): "Gasto" | "Abono" {
  return type === "cobro" || type === "income" ? "Abono" : "Gasto";
}

export function getMovementConceptLabel(kind?: string | null): string {
  const normalized = normalizeFinanceKind(kind);
  switch (normalized) {
    case "cuota":
      return "cuota";
    case "patrocinio":
      return "patrocinio";
    case "premio":
      return "premio";
    case "sancion":
      return "sanción";
    case "arbitros":
      return "arbitros";
    case "campo":
      return "campo";
    case "material":
      return "material";
    case "eventos":
      return "eventos";
    case "otro":
    default:
      return "otros";
  }
}
