/**
 * Datalaget: læser public/data/members.json og regner alt det, sektionerne
 * skal bruge, ud fra én valgt måned ("pr. ultimo …").
 *
 * Alle tal i dashboardet er relative til den valgte måned, så man kan gå
 * tilbage og se præcis det overblik ledergruppen fik i en tidligere måned.
 */
import { useEffect, useMemo, useState } from 'react'

/* ── Typer, som JSON'en ser ud ────────────────────────────────────────────── */

export interface CatRec { now: number | null; ly: number | null; base: number | null; konge: number | null }
export interface SecRec { now: number | null; ly: number | null }

export interface Snapshot {
  date: string
  baseDate: string
  total: CatRec
  categories: Record<string, CatRec>
  sections: Record<string, SecRec>
  file: string
}

export interface KongePoint { date: string; value: number | null; source: 'månedsfil' | 'beregnet' | null }
export interface TotalPoint { date: string; total: number; source: 'månedsfil' | 'kvartalsdata' }
export interface Quarter { date: string; total: number | null; categories: Record<string, number | null> }
export interface Flow { month: string; ind: number | null; ud: number | null; note: string | null }

export interface Projection {
  dates: string[]
  byCategory: Record<string, { start: number; latest: number; cagr: number; path: number[] }>
  totalByCagr: { start: number; latest: number; cagr: number; path: number[] } | null
  totalBySum: { start: number; latest: number; cagr: number; path: number[] } | null
}

export interface Group { key: string; label: string; categories: string[] }

export interface Dashboard {
  meta: {
    generatedAt: string
    latest: string
    first: string
    months: number
    seriesFile: string | null
    warnings: string[]
    goal: { target: number; date: string }
    fulltimeCategories: string[]
    fullPriceCategories: string[]
    groups: Group[]
    rates?: Record<string, { monthly: number | null; note: string | null }>
    studies?: Record<'tilgang' | 'bestand' | 'afbrudte' | 'fuldførte', Record<'bachelor' | 'kandidat', Record<string, number>>>
  }
  snapshots: Snapshot[]
  baseByYear: Record<string, { total: number | null; categories: Record<string, number>; source: string }>
  monthlyMain: { date: string; categories: Record<string, number> }[]
  konge: Record<string, KongePoint[]>
  totals: TotalPoint[]
  quarterly: Quarter[]
  projection: Projection | null
  flows: Flow[]
}

/* ── Indlæsning ───────────────────────────────────────────────────────────── */

declare global {
  interface Window { __DP_MEMBERS__?: Dashboard }
}

export function useDashboard() {
  const [data, setData] = useState<Dashboard | null>(() => window.__DP_MEMBERS__ ?? null)
  const [error, setError] = useState<string | null>(null)
  const embedded = Boolean(window.__DP_MEMBERS__)

  useEffect(() => {
    if (embedded) return
    const url = `${import.meta.env.BASE_URL}data/members.json?t=${Date.now()}`
    fetch(url, { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d: Dashboard) => setData(d))
      .catch((e: Error) => setError(e.message))
  }, [embedded])

  return { data, error, embedded }
}

/* ── Formatering ──────────────────────────────────────────────────────────── */

const nf = new Intl.NumberFormat('da-DK')
export const fmtNum = (n: number | null | undefined) => (n === null || n === undefined ? '–' : nf.format(Math.round(n)))
export const fmtSigned = (n: number | null | undefined) =>
  n === null || n === undefined ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : '±'}${nf.format(Math.abs(Math.round(n)))}`
export const fmtPct = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? '–'
    : `${n.toLocaleString('da-DK', { minimumFractionDigits: d, maximumFractionDigits: d })} %`
export const fmtPctSigned = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined || !Number.isFinite(n) ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmtPct(Math.abs(n), d)}`

export const MONTHS = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']
export const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

export const monthIndex = (iso: string) => Number(iso.slice(5, 7)) - 1
export const yearOf = (iso: string) => Number(iso.slice(0, 4))
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "ultimo maj 2026" */
export const ultimo = (iso: string) => `ultimo ${MONTHS[monthIndex(iso)]} ${yearOf(iso)}`
/** "31.05.26" */
export const ddmmyy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}`
/** "maj 2026" */
export const monthYear = (iso: string) => `${MONTHS[monthIndex(iso)]} ${yearOf(iso)}`

export const pctChange = (now: number | null | undefined, before: number | null | undefined) =>
  now === null || now === undefined || !before ? null : ((now - before) / before) * 100

/* ── Kategoriernes visningsnavne og farver ─────────────────────────────────
 * Farven følger kategorien, aldrig dens plads i en sorteret liste.
 * ──────────────────────────────────────────────────────────────────────────── */

export const CAT_LABEL: Record<string, string> = {
  'Normaltansat over 19 timer': 'Normalansat, over 19 timer',
  'Normaltansat under 20 timer': 'Normalansat, under 20 timer',
  'Selvstændig': 'Selvstændig',
  'Ph.d. studerende': 'Ph.d.-studerende',
  '1 og 2 års Kandidater': '1. og 2. års kandidater',
  'Studerende DP': 'Studerende',
  'Psykologistuderende': 'Psykologistuderende (udgået)',
  'Pensionist DP': 'Pensionist',
  'Pensionist DP - Udland': 'Pensionist, udland',
  'Efterløn DP': 'Efterløn',
  'Ledig DP': 'Ledig',
  'Ledig ikke ret til dagpenge': 'Ledig uden dagpengeret',
  'Orlov uden løn DP': 'Orlov uden løn',
  'Med løntilskud': 'Løntilskud',
  'Udland DP': 'Udland',
  'Anden forhandlingsret': 'Anden forhandlingsret',
  'DLF og DLF ret': 'DLF-medlem (DLF-ret)',
  'DLF og DP ret': 'DLF-medlem (DP-ret)',
  'DM1 Mag. art.': 'Mag.art.',
  'Æresmedlem': 'Æresmedlem',
  'DP medlem': 'DP-medlem (udgået)',
}
export const catLabel = (k: string) => CAT_LABEL[k] ?? k

export const MAIN_COLORS: Record<string, string> = {
  'Normaltansat over 19 timer': '#4c7bbd', // blå
  'Selvstændig': '#df790d',                // orange
  'Studerende DP': '#4fa388',              // DP Studerende
  '1 og 2 års Kandidater': '#4e4897',      // lilla
  'Ph.d. studerende': '#179fa0',           // grøn
}

export const GROUP_COLORS: Record<string, string> = {
  fuldtid: '#3a557d',
  kandidater: '#4e4897',
  studerende: '#4fa388',
  pensionister: '#8299bb',
  ledige: '#df790d',
  ovrige: '#aebdd4',
}

export const YEAR_COLORS: Record<number, string> = {
  2022: '#d4dbe1',
  2023: '#aebdd4',
  2024: '#8299bb',
  2025: '#4c7bbd',
  2026: '#df790d',
  2027: '#d24e46',
}
export const yearColor = (y: number) => YEAR_COLORS[y] ?? '#4e4897'

/* ── Afledte tal for én valgt måned ───────────────────────────────────────── */

export interface CategoryRow {
  key: string
  label: string
  now: number
  prev: number | null       // forrige måned
  ly: number | null         // samme måned sidste år
  base: number | null       // pr. 31.12 året før
  dMonth: number | null
  dYear: number | null
  dYtd: number | null
  share: number             // andel af alle medlemmer
  fulltime: boolean
  group: string
  history: (number | null)[] // seneste 12 måneder, hvor vi har tal
}

export interface AsOf {
  date: string
  snapshot: Snapshot
  prev: Snapshot | null
  index: number
  total: number
  totalPrev: number | null
  totalLy: number | null
  totalBase: number | null
  konge: number | null
  kongePrev: number | null
  kongeParts: { key: string; label: string; color: string; value: number; now: number; base: number }[]
  kongeSameMonthLastYear: number | null
  kongeSameMonthTwoYears: number | null
  kandidater: { now: number; ly: number | null; base: number | null }
  categories: CategoryRow[]
  sections: { key: string; now: number; ly: number | null; prev: number | null; dYear: number | null; dMonth: number | null }[]
  flowsToDate: Flow[]
  flowThisMonth: Flow | null
}

const snapDate = (s: Snapshot) => s.date

export function computeAsOf(data: Dashboard, date: string): AsOf {
  const snaps = data.snapshots
  let index = snaps.findIndex((s) => s.date === date)
  if (index < 0) index = snaps.length - 1
  const snapshot = snaps[index]
  const prev = snaps[index - 1] ?? null
  const year = yearOf(snapshot.date)

  const total = snapshot.total.now ?? 0
  const kongeYear = data.konge[String(year)] ?? []
  const kongeNow = kongeYear.find((k) => k.date === snapshot.date)?.value ?? snapshot.total.konge
  const kongePrev = prev
    ? (data.konge[String(yearOf(prev.date))] ?? []).find((k) => k.date === prev.date)?.value ?? prev.total.konge
    : null

  const findKonge = (y: number) => {
    const m = monthIndex(snapshot.date)
    return (data.konge[String(y)] ?? []).find((k) => monthIndex(k.date) === m)?.value ?? null
  }

  const kongeParts = data.meta.fulltimeCategories.map((key) => {
    const c = snapshot.categories[key]
    return {
      key, label: catLabel(key), color: MAIN_COLORS[key] ?? '#3a557d',
      value: (c?.now ?? 0) - (c?.base ?? 0), now: c?.now ?? 0, base: c?.base ?? 0,
    }
  })

  const groupOf = (key: string) => data.meta.groups.find((g) => g.categories.includes(key))?.key ?? 'ovrige'

  const categories: CategoryRow[] = Object.entries(snapshot.categories)
    .filter(([, v]) => v.now !== null)
    .map(([key, v]) => {
      const p = prev?.categories[key]?.now ?? null
      const history = snaps.slice(Math.max(0, index - 11), index + 1).map((s) => s.categories[key]?.now ?? null)
      return {
        key, label: catLabel(key), now: v.now!, prev: p, ly: v.ly, base: v.base,
        dMonth: p === null ? null : v.now! - p,
        dYear: v.ly === null ? null : v.now! - v.ly,
        dYtd: v.base === null ? null : v.now! - v.base,
        share: total ? (v.now! / total) * 100 : 0,
        fulltime: data.meta.fulltimeCategories.includes(key),
        group: groupOf(key),
        history,
      }
    })
    .sort((a, b) => b.now - a.now)

  const sections = Object.entries(snapshot.sections)
    .filter(([, v]) => v.now !== null)
    .map(([key, v]) => {
      const p = prev?.sections[key]?.now ?? null
      return { key, now: v.now!, ly: v.ly, prev: p, dYear: v.ly === null ? null : v.now! - v.ly, dMonth: p === null ? null : v.now! - p }
    })
    .sort((a, b) => b.now - a.now)

  const ym = snapshot.date.slice(0, 7)
  const flowsToDate = data.flows.filter((f) => f.month <= ym)
  const kand = snapshot.categories['1 og 2 års Kandidater']

  return {
    date: snapshot.date, snapshot, prev, index, total,
    totalPrev: prev?.total.now ?? null,
    totalLy: snapshot.total.ly,
    totalBase: snapshot.total.base,
    konge: kongeNow ?? null,
    kongePrev,
    kongeParts,
    kongeSameMonthLastYear: findKonge(year - 1),
    kongeSameMonthTwoYears: findKonge(year - 2),
    kandidater: { now: kand?.now ?? 0, ly: kand?.ly ?? null, base: kand?.base ?? null },
    categories,
    sections,
    flowsToDate,
    flowThisMonth: data.flows.find((f) => f.month === ym) ?? null,
  }
}

export const useAsOf = (data: Dashboard | null, date: string | null) =>
  useMemo(() => (data ? computeAsOf(data, date ?? data.meta.latest) : null), [data, date])

/* ── Målet: 15.000 medlemmer 31.12.29 ─────────────────────────────────────── */

export interface GoalPath {
  target: number
  targetDate: string
  /** Basis: medlemstal 31.12 i det seneste hele år, og den dato. */
  from: { date: string; total: number }
  /** Den lige linje fra basis til målet, ét punkt pr. 31.12. */
  linear: { date: string; total: number }[]
  requiredPerYear: number
  requiredCagr: number
  /** Hvor målstregen ligger i dag, hvis man går lineært. */
  onTrackToday: number
  gapToday: number
  yearlyGrowth: { year: number; from: number; to: number; delta: number }[]
}

export function computeGoal(data: Dashboard, asOf: AsOf): GoalPath {
  const { target, date: targetDate } = data.meta.goal
  const years = Object.keys(data.baseByYear).map(Number).sort()
  const baseYear = yearOf(asOf.date) - 1
  const fromTotal = data.baseByYear[String(baseYear)]?.total ?? asOf.totalBase ?? asOf.total
  const from = { date: `${baseYear}-12-31`, total: fromTotal }
  const targetYear = yearOf(targetDate)
  const n = targetYear - baseYear
  const requiredPerYear = (target - fromTotal) / n
  const requiredCagr = (target / fromTotal) ** (1 / n) - 1
  const linear = Array.from({ length: n }, (_, i) => ({
    date: `${baseYear + i + 1}-12-31`,
    total: Math.round(fromTotal + requiredPerYear * (i + 1)),
  }))
  const monthsIn = monthIndex(asOf.date) + 1
  const onTrackToday = Math.round(fromTotal + requiredPerYear * (monthsIn / 12))
  const yearlyGrowth = years.slice(1).map((y) => {
    const a = data.baseByYear[String(y - 1)]?.total ?? null
    const b = data.baseByYear[String(y)]?.total ?? null
    return { year: y, from: a ?? 0, to: b ?? 0, delta: a !== null && b !== null ? b - a : 0 }
  }).filter((g) => g.from && g.to)
  return {
    target, targetDate, from, linear, requiredPerYear, requiredCagr,
    onTrackToday, gapToday: asOf.total - onTrackToday, yearlyGrowth,
  }
}

/* ── Fastholdelse: det kritiske kontingentskift ───────────────────────────
 * Vi har ingen individdata, kun kategoritotaler måned for måned. Men når
 * kandidat-kategorien falder i en måned, og de fuldtidsbetalende stiger,
 * kan man se bevægelsen i nettotallene. Det er et skøn — mærket som sådan.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface Transition {
  from: string
  to: string
  kandidaterDelta: number
  fulltimeDelta: number
  studerendeDelta: number
  totalDelta: number
  /** Skøn: hvor stor en del af faldet i kandidater genfindes hos fuldtidsbetalende. */
  conversion: number | null
}

export function computeTransitions(data: Dashboard): Transition[] {
  const rows = data.monthlyMain.filter((m) => m.categories['1 og 2 års Kandidater'] !== undefined)
  const out: Transition[] = []
  const ft = (c: Record<string, number>) => (c['Normaltansat over 19 timer'] ?? 0) + (c['Selvstændig'] ?? 0) + (c['Ph.d. studerende'] ?? 0)
  const totalAt = (d: string) => data.totals.find((t) => t.date === d)?.total ?? null
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].categories
    const b = rows[i].categories
    const kd = (b['1 og 2 års Kandidater'] ?? 0) - (a['1 og 2 års Kandidater'] ?? 0)
    const fd = ft(b) - ft(a)
    const sd = (b['Studerende DP'] ?? 0) - (a['Studerende DP'] ?? 0)
    const ta = totalAt(rows[i - 1].date)
    const tb = totalAt(rows[i].date)
    out.push({
      from: rows[i - 1].date, to: rows[i].date,
      kandidaterDelta: kd, fulltimeDelta: fd, studerendeDelta: sd,
      totalDelta: ta !== null && tb !== null ? tb - ta : NaN,
      conversion: kd < -20 ? Math.max(0, Math.min(1, fd / -kd)) : null,
    })
  }
  return out
}

/* ── Årets bevægelser, samlet pr. kalendermåned på tværs af år ─────────── */

export interface MonthProfile {
  month: number
  /** Gennemsnitlig ændring i alle medlemmer i den måned (kun hvor vi har månedstal). */
  totalDelta: { year: number; value: number }[]
  kongeStep: { year: number; value: number }[]
}

export function computeMonthProfiles(data: Dashboard): MonthProfile[] {
  const byMonth: MonthProfile[] = Array.from({ length: 12 }, (_, m) => ({ month: m, totalDelta: [], kongeStep: [] }))
  const totals = data.totals.filter((t) => t.source === 'månedsfil')
  for (let i = 1; i < totals.length; i++) {
    const a = totals[i - 1], b = totals[i]
    const ma = monthIndex(a.date), mb = monthIndex(b.date)
    // kun rigtige nabomåneder
    if ((mb - ma + 12) % 12 !== 1) continue
    byMonth[mb].totalDelta.push({ year: yearOf(b.date), value: b.total - a.total })
  }
  for (const [y, pts] of Object.entries(data.konge)) {
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i]
      if (cur.value === null) continue
      const prevVal = i === 0 ? 0 : pts[i - 1].value
      if (prevVal === null) continue
      byMonth[monthIndex(cur.date)].kongeStep.push({ year: Number(y), value: cur.value - prevVal })
    }
  }
  return byMonth
}

export { snapDate }
