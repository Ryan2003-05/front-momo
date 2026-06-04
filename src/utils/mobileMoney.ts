export const MOBILE_MONEY_PLACEHOLDER = "+229 01 XX XX XX XX";

export const OPERATOR_COLORS = {
  MTN: {
    primary: "#f59e0b",
    logoClass: "bg-amber-500",
    badgeClass: "bg-amber-100 text-amber-800",
  },
  Moov: {
    primary: "#0F6AB3",
    secondary: "#F97A1E",
    logoClass: "bg-[#0F6AB3]",
    accentClass: "bg-[#F97A1E]",
    badgeClass: "bg-[#0F6AB3]/10 text-[#0F6AB3]",
    gradientClass: "bg-linear-to-br from-[#0F6AB3] to-[#F97A1E]",
  },
  Celtiis: {
    primary: "#10b981",
    secondary: "#10b981",
    logoClass: "bg-emerald-500",
    accentClass: "bg-emerald-500",
    badgeClass: "bg-emerald-100 text-emerald-700",
    gradientClass: "bg-emerald-500",
  },
} as const;

export const OPERATOR_LABELS: Record<string, string> = {
  MTN: "MTN MoMo",
  Moov: "Moov Money",
  Celtiis: "Celtiis",
};

export const OPERATOR_CODES: Record<string, string> = {
  MTN: "MTN",
  Moov: "MOV",
  Celtiis: "CEL",
};

const MTN_PREFIXES = [42, 46, 50, 51, 52, 53, 54, 56, 57, 59, 61, 62, 66, 67, 69, 90, 91, 96, 97];
const MOOV_PREFIXES = [55, 58, 60, 63, 64, 65, 68, 94, 95, 98];
const CELTIIS_PREFIXES = [40, 41, 43, 44, 47];

export function normalizeMobileMoneyDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("22901")) return digits.slice(5, 13);
  if (digits.startsWith("229")) return digits.slice(3, 11);
  if (digits.startsWith("01")) return digits.slice(2, 10);
  return digits.slice(0, 8);
}

export function normalizeMobileMoneyNumber(value: string): string {
  const local = normalizeMobileMoneyDigits(value);
  return local.length === 8 ? `+22901${local}` : value.replace(/[^\d+]/g, "");
}

export function formatMobileMoneyNumber(value: string): string {
  const local = normalizeMobileMoneyDigits(value);
  if (!local) return "";
  const national = `01${local}`.slice(0, 10);
  const groups = national.match(/.{1,2}/g) ?? [];
  return `+229 ${groups.join(" ")}`;
}

export function detectMobileMoneyOperator(value: string): string | null {
  const local = normalizeMobileMoneyDigits(value);
  const prefix = Number(local.slice(0, 2));
  if (MTN_PREFIXES.includes(prefix)) return "MTN";
  if (MOOV_PREFIXES.includes(prefix)) return "Moov";
  if (CELTIIS_PREFIXES.includes(prefix)) return "Celtiis";
  return null;
}

export function operatorHex(name: string): string {
  return OPERATOR_COLORS[name as keyof typeof OPERATOR_COLORS]?.primary ?? "#94a3b8";
}

export function operatorLogoClass(name: string): string {
  return OPERATOR_COLORS[name as keyof typeof OPERATOR_COLORS]?.logoClass ?? "bg-gray-400";
}

export function operatorBadgeClass(name: string): string {
  return OPERATOR_COLORS[name as keyof typeof OPERATOR_COLORS]?.badgeClass ?? "bg-gray-100 text-gray-700";
}
