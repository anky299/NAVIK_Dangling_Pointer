const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtInt = (n: number) => nf0.format(n);
export const fmt1 = (n: number) => nf1.format(n);
export const fmt2 = (n: number) => nf2.format(n);
export const fmtUsd = (n: number) => `$${nf0.format(Math.round(n))}`;
export const fmtUsdM = (n: number) => `$${nf2.format(n / 1_000_000)}M`;
export const fmtRate = (n: number) => `$${nf2.format(n)}`;
export const fmtTonnes = (n: number) =>
  n >= 1000 ? `${nf0.format(Math.round(n / 1000))}k t` : `${nf0.format(n)} t`;
export const fmtPct = (n: number, signed = true) =>
  `${signed && n > 0 ? "+" : ""}${nf1.format(n)}%`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Deterministic UTC date formatting (safe for SSR hydration). */
export function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function fmtShortDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
}
export function fmtMonth(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ’${String(d.getUTCFullYear()).slice(2)}`;
}
export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${fmtDate(iso)} · ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}
