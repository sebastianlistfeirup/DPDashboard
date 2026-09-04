/**
 * Kongeindikatoren — årets vækst i fuldtidsbetalende medlemmer, måned for
 * måned, lagt oven på de foregående år. Det er den figur, mailen altid har
 * haft som billede; her er den levende.
 */
import { useMemo, useState } from 'react'
import { ChartCard, SectionHeading, Band } from '@/components/primitives'
import { DataTable } from '@/components/charts'
import { Lines, type Series } from '@/components/lines'
import { DivergingBars } from '@/components/lines'
import {
  MONTHS_SHORT, cap, ddmmyy, fmtNum, fmtSigned, monthIndex, yearColor, yearOf, MONTHS,
  type AsOf, type Dashboard,
} from '@/lib/data'

export function Konge({ data, a }: { data: Dashboard; a: AsOf }) {
  const year = yearOf(a.date)
  const years = Object.keys(data.konge).map(Number).filter((y) => y <= year).sort()
  const [visible, setVisible] = useState<number[]>(() => years.slice(-3))

  const series: Series[] = useMemo(() => years.filter((y) => visible.includes(y)).map((y) => {
    const pts = (data.konge[String(y)] ?? []).filter((k) => y < year || k.date <= a.date)
    return {
      key: String(y), label: String(y), color: yearColor(y), endLabel: true, dots: y === year,
      width: y === year ? 3 : 2,
      area: y === year,
      points: Array.from({ length: 12 }, (_, m) => ({ x: m, y: pts.find((p) => monthIndex(p.date) === m)?.value ?? null })),
    }
  }), [data.konge, years, visible, year, a.date])

  const thisYear = (data.konge[String(year)] ?? []).filter((k) => k.date <= a.date)
  const steps = thisYear.map((k, i) => ({
    label: MONTHS_SHORT[monthIndex(k.date)],
    value: k.value === null ? null : k.value - (i === 0 ? 0 : (thisYear[i - 1].value ?? 0)),
  }))
  const computed = thisYear.filter((k) => k.source === 'beregnet').length

  const total = a.kongeParts.reduce((s, p) => s + Math.abs(p.value), 0) || 1

  return (
    <>
      <SectionHeading
        kicker="Kongeindikatoren"
        title={`${fmtSigned(a.konge)} fuldtidsbetalende siden ${ddmmyy(a.snapshot.baseDate)}`}
        lead={`Hver kurve er ét år og starter i nul den 1. januar. Så kan man se med det samme, om ${year} følger, overhaler eller sakker efter ${year - 1} — måned for måned.`}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard
          title="Vækst i fuldtidsbetalende, år for år"
          subtitle="Kumuleret fra 31.12 året før. Læs kurven som et løb: jo højere, jo bedre."
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              {years.map((y) => {
                const on = visible.includes(y)
                return (
                  <button key={y} type="button" aria-pressed={on}
                          onClick={() => setVisible((v) => (on ? v.filter((x) => x !== y) : [...v, y]))}
                          className="tnum inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold transition"
                          style={{ borderColor: on ? yearColor(y) : '#e2e6ea', background: on ? yearColor(y) : '#fff', color: on ? '#fff' : '#4a5a72' }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: on ? 'rgba(255,255,255,0.85)' : yearColor(y) }} />
                    {y}
                  </button>
                )
              })}
            </div>
          }
          table={
            <DataTable
              columns={[{ key: 'm', label: 'Måned' }, ...years.map((y) => ({ key: String(y), label: String(y), align: 'right' as const }))]}
              rows={Array.from({ length: 12 }, (_, m) => ({
                m: cap(MONTHS[m]),
                ...Object.fromEntries(years.map((y) => [String(y), fmtSigned((data.konge[String(y)] ?? []).find((p) => monthIndex(p.date) === m)?.value ?? null)])),
              }))}
            />
          }
        >
          <Lines
            series={series}
            xLabels={MONTHS_SHORT}
            height={320}
            valueFormat={fmtSigned}
            xTickEvery={1}
            tooltipTitle={(i) => cap(MONTHS[i])}
            bands={[{ x0: 5.5, x1: 6.5, label: 'kontingentskift', color: '#4e4897' }]}
          />
          {computed > 0 && (
            <p className="mt-3 text-[0.75rem] text-dp-navy-400">
              Måneder uden en månedsfil (og hele 2024) er beregnet ud fra hovedkategoriernes månedstal med samme 31.12-basis. De afviger sjældent mere end få medlemmer fra det, der blev rapporteret.
            </p>
          )}
        </ChartCard>

        <div className="grid gap-5">
          <ChartCard title="Hvor væksten kommer fra" subtitle={`De tre kategorier bag indikatoren, pr. ${ddmmyy(a.date)}.`}>
            <ul className="space-y-4">
              {[...a.kongeParts].sort((p, q) => q.value - p.value).map((p, i) => (
                <li key={p.key}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 text-[0.8125rem] text-dp-navy-800">
                      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} />
                      {p.label}
                    </span>
                    <span className="tnum text-[0.9375rem] font-semibold" style={{ color: p.value < 0 ? '#d24e46' : '#16233a' }}>{fmtSigned(p.value)}</span>
                  </div>
                  <Band value={Math.abs(p.value)} max={total} color={p.value < 0 ? '#d24e46' : p.color} height={8} delay={i * 0.08} />
                  <div className="tnum mt-1 text-[0.6875rem] text-dp-navy-400">{fmtNum(p.base)} → {fmtNum(p.now)}</div>
                </li>
              ))}
            </ul>
          </ChartCard>

          <ChartCard title={`Måned for måned i ${year}`} subtitle="Hvad hver måned lagde til — eller trak fra.">
            <DivergingBars items={steps} height={190} width={420} positiveColor="#4c7bbd" negativeColor="#d24e46" valueFormat={fmtSigned} />
          </ChartCard>
        </div>
      </div>
    </>
  )
}
