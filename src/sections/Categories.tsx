/**
 * Alle kontingentkategorier — tabellen fra månedsarket, gjort levende:
 * sorterbar, med udvikling som en lille kurve, og et varmekort over
 * ændringerne måned for måned, så man kan se hvor bevægelserne sidder.
 */
import { useMemo, useState } from 'react'
import { ChartCard, SectionHeading } from '@/components/primitives'
import { Sparkline } from '@/components/charts'
import {
  GROUP_COLORS, MONTHS_SHORT, catLabel, ddmmyy, fmtNum, fmtPct, fmtPctSigned, fmtSigned, monthIndex, pctChange, yearOf,
  type AsOf, type CategoryRow, type Dashboard,
} from '@/lib/data'

type SortKey = 'now' | 'dMonth' | 'dYear' | 'dYtd' | 'share'

export function Categories({ data, a }: { data: Dashboard; a: AsOf }) {
  const [sort, setSort] = useState<SortKey>('now')
  const [dir, setDir] = useState<1 | -1>(-1)
  const [group, setGroup] = useState<string | null>(null)

  const rows = useMemo(() => {
    const r = a.categories.filter((c) => c.now > 0 || (c.ly ?? 0) > 0).filter((c) => !group || c.group === group)
    return [...r].sort((x, y) => ((x[sort] ?? -Infinity) - (y[sort] ?? -Infinity)) * dir)
  }, [a.categories, sort, dir, group])

  const clickSort = (k: SortKey) => {
    if (sort === k) setDir((d) => (d === 1 ? -1 : 1))
    else { setSort(k); setDir(-1) }
  }

  const gains = a.categories.filter((c) => (c.dYear ?? 0) > 0).sort((x, y) => (y.dYear ?? 0) - (x.dYear ?? 0)).slice(0, 4)
  const losses = a.categories.filter((c) => (c.dYear ?? 0) < 0).sort((x, y) => (x.dYear ?? 0) - (y.dYear ?? 0)).slice(0, 4)

  return (
    <>
      <SectionHeading
        kicker="Kontingentkategorier"
        title="Alle kategorier, pr. måned"
        lead={`Tallene fra månedsarket pr. ${ddmmyy(a.date)}. Klik på en kolonne for at sortere. Kurven er de seneste tolv måneder.`}
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <Movers title={`Vokser mest siden ${MONTHS_SHORT[monthIndex(a.date)]} ${yearOf(a.date) - 1}`} rows={gains} positive />
        <Movers title={`Falder mest siden ${MONTHS_SHORT[monthIndex(a.date)]} ${yearOf(a.date) - 1}`} rows={losses} positive={false} />
      </div>

      <ChartCard
        title="Kategori for kategori"
        subtitle="Måned = mod forrige måned · År = mod samme måned sidste år · Siden 31.12 = årets udvikling."
        actions={
          <div className="flex flex-wrap gap-1.5">
            <Chip on={group === null} color="#3a557d" onClick={() => setGroup(null)}>Alle</Chip>
            {data.meta.groups.map((g) => (
              <Chip key={g.key} on={group === g.key} color={GROUP_COLORS[g.key]} onClick={() => setGroup(group === g.key ? null : g.key)}>{g.label}</Chip>
            ))}
          </div>
        }
      >
        <div className="thin-scroll -mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-[46rem] border-collapse text-[0.8125rem]">
            <thead>
              <tr className="border-b border-dp-navy-100 text-dp-navy-500">
                <th className="py-2 pr-3 text-left font-semibold">Kategori</th>
                <th className="py-2 pr-3 text-left font-semibold">12 mdr.</th>
                <Th k="now" label="Antal" sort={sort} dir={dir} on={clickSort} />
                <Th k="dMonth" label="Måned" sort={sort} dir={dir} on={clickSort} />
                <Th k="dYear" label="År" sort={sort} dir={dir} on={clickSort} />
                <Th k="dYtd" label="Siden 31.12" sort={sort} dir={dir} on={clickSort} />
                <Th k="share" label="Andel" sort={sort} dir={dir} on={clickSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.key} className="border-b border-dp-navy-50 last:border-0 hover:bg-dp-navy-50/60">
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: GROUP_COLORS[c.group] }} />
                      <span className="font-medium text-dp-navy-900">{c.label}</span>
                      {c.fulltime && <span className="rounded-full bg-dp-gul-15 px-1.5 py-0.5 text-[0.625rem] font-bold text-dp-navy-700">KI</span>}
                    </span>
                  </td>
                  <td className="py-1 pr-3"><Sparkline values={c.history} color={GROUP_COLORS[c.group]} width={84} height={22} /></td>
                  <td className="tnum py-2 pr-3 text-right font-semibold text-dp-navy-900">{fmtNum(c.now)}</td>
                  <Delta v={c.dMonth} />
                  <Delta v={c.dYear} pct={pctChange(c.now, c.ly)} />
                  <Delta v={c.dYtd} />
                  <td className="tnum py-2 pr-3 text-right text-dp-navy-600">{fmtPct(c.share)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-dp-navy-200 font-semibold text-dp-navy-900">
                <td className="py-2 pr-3" colSpan={2}>Alle medlemmer</td>
                <td className="tnum py-2 pr-3 text-right">{fmtNum(a.total)}</td>
                <Delta v={a.totalPrev !== null ? a.total - a.totalPrev : null} />
                <Delta v={a.totalLy !== null ? a.total - a.totalLy : null} pct={pctChange(a.total, a.totalLy)} />
                <Delta v={a.totalBase !== null ? a.total - a.totalBase : null} />
                <td className="tnum py-2 pr-3 text-right">100 %</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-[0.75rem] text-dp-navy-400">KI = tæller med i kongeindikatoren.</p>
      </ChartCard>

      <div className="mt-5">
        <Heat data={data} a={a} />
      </div>
    </>
  )
}

function Chip({ on, color, onClick, children }: { on: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold transition"
            style={{ borderColor: on ? color : '#e2e6ea', background: on ? color : '#fff', color: on ? '#fff' : '#4a5a72' }}>
      <span className="h-2 w-2 rounded-full" style={{ background: on ? 'rgba(255,255,255,0.85)' : color }} />
      {children}
    </button>
  )
}

function Th({ k, label, sort, dir, on }: { k: SortKey; label: string; sort: SortKey; dir: 1 | -1; on: (k: SortKey) => void }) {
  const active = sort === k
  return (
    <th className="py-2 pr-3 text-right font-semibold">
      <button type="button" onClick={() => on(k)} className={`inline-flex items-center gap-1 ${active ? 'text-dp-navy-900' : 'hover:text-dp-navy-800'}`}>
        {label}
        <span className="text-[0.625rem]" aria-hidden="true">{active ? (dir === -1 ? '▼' : '▲') : ''}</span>
      </button>
    </th>
  )
}

function Delta({ v, pct }: { v: number | null; pct?: number | null }) {
  const color = v === null ? '#7a8798' : v > 0 ? '#179fa0' : v < 0 ? '#d24e46' : '#7a8798'
  return (
    <td className="tnum py-2 pr-3 text-right" style={{ color }}>
      {fmtSigned(v)}
      {pct !== undefined && pct !== null && <span className="ml-1 text-[0.6875rem] opacity-70">{fmtPctSigned(pct)}</span>}
    </td>
  )
}

function Movers({ title, rows, positive }: { title: string; rows: CategoryRow[]; positive: boolean }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.dYear ?? 0)))
  return (
    <div className="card p-5">
      <h3 className="text-[0.9375rem] font-semibold text-dp-navy-900">{title}</h3>
      <ul className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[0.8125rem]">
              <span className="text-dp-navy-800">{r.label}</span>
              <span className="tnum font-semibold" style={{ color: positive ? '#179fa0' : '#d24e46' }}>
                {fmtSigned(r.dYear)} <span className="text-[0.6875rem] opacity-70">{fmtPctSigned(pctChange(r.now, r.ly))}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-dp-navy-100">
              <div className="h-full rounded-full" style={{ width: `${(Math.abs(r.dYear ?? 0) / max) * 100}%`, background: positive ? '#179fa0' : '#d24e46' }} />
            </div>
          </li>
        ))}
        {!rows.length && <li className="text-[0.8125rem] text-dp-navy-400">Ingen.</li>}
      </ul>
    </div>
  )
}

/* ── Varmekort: kategori × måned ─────────────────────────────────────────── */

function Heat({ data, a }: { data: Dashboard; a: AsOf }) {
  const snaps = data.snapshots.filter((s) => s.date <= a.date).slice(-13)
  if (snaps.length < 3) return null
  const cols = snaps.slice(1)
  const cats = a.categories.filter((c) => c.now >= 15).map((c) => c.key)
  const cell = (cat: string, i: number) => {
    const prev = snaps[i].categories[cat]?.now
    const cur = snaps[i + 1].categories[cat]?.now
    return prev === null || prev === undefined || cur === null || cur === undefined ? null : cur - prev
  }
  const maxAbs = Math.max(5, ...cats.flatMap((c) => cols.map((_, i) => Math.abs(cell(c, i) ?? 0))))
  const color = (v: number | null) => {
    if (v === null) return '#f4f1f1'
    const t = Math.min(1, Math.abs(v) / maxAbs) ** 0.6
    return v >= 0 ? `rgba(23,159,160,${0.08 + t * 0.85})` : `rgba(210,78,70,${0.08 + t * 0.85})`
  }
  const gap = (i: number) => {
    const d1 = new Date(snaps[i].date), d2 = new Date(snaps[i + 1].date)
    return (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth() > 1
  }
  return (
    <ChartCard
      title="Hvor bevægelserne sidder"
      subtitle="Ændring mod forrige måned, kategori for kategori. Grøn er flere, rød er færre; jo mørkere, jo større. Kategorier under 15 medlemmer er udeladt."
    >
      <div className="thin-scroll -mx-2 overflow-x-auto px-2">
        <table className="border-collapse text-[0.75rem]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white py-1 pr-3 text-left font-semibold text-dp-navy-500">Kategori</th>
              {cols.map((s, i) => (
                <th key={s.date} className="px-0.5 py-1 text-center font-semibold text-dp-navy-500">
                  <span className="block">{MONTHS_SHORT[monthIndex(s.date)]}</span>
                  <span className="block text-[0.625rem] text-dp-navy-400">{gap(i) ? '*' : ''}{String(yearOf(s.date)).slice(2)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c}>
                <td className="sticky left-0 whitespace-nowrap bg-white py-0.5 pr-3 text-dp-navy-800">{catLabel(c)}</td>
                {cols.map((s, i) => {
                  const v = cell(c, i)
                  return (
                    <td key={s.date} className="p-0.5">
                      <div className="tnum grid h-8 w-11 place-items-center rounded-md text-[0.6875rem] font-semibold"
                           style={{ background: color(v), color: v !== null && Math.abs(v) / maxAbs > 0.45 ? '#fff' : '#16233a' }}
                           title={`${catLabel(c)}, ${MONTHS_SHORT[monthIndex(s.date)]} ${yearOf(s.date)}: ${fmtSigned(v)}`}>
                        {v === null ? '' : v === 0 ? '·' : fmtSigned(v)}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cols.some((_, i) => gap(i)) && (
        <p className="mt-3 text-[0.75rem] text-dp-navy-400">* Der mangler en månedsfil før denne måned, så ændringen dækker mere end én måned.</p>
      )}
    </ChartCard>
  )
}
