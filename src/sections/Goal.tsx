/**
 * Målet: 15.000 medlemmer 31.12.29.
 *
 * Én figur med tre linjer, der hver svarer på ét spørgsmål: hvor har vi
 * været (blå), hvilken vej skal vi følge for at nå målet (rød), og hvor
 * ender vi, hvis det seneste års tempo holder (grå). Under figuren står de
 * fire scenarier som ét tal hver.
 */
import { ChartCard, SectionHeading, Reveal } from '@/components/primitives'
import { DataTable } from '@/components/charts'
import { Lines, type Series } from '@/components/lines'
import { DivergingBars } from '@/components/lines'
import { MONTHS_SHORT, fmtNum, fmtPct, fmtSigned, ddmmyy, yearOf, type AsOf, type Dashboard, type GoalPath } from '@/lib/data'

export function Goal({ data, a, goal }: { data: Dashboard; a: AsOf; goal: GoalPath }) {
  const actual = data.totals.filter((t) => t.date <= a.date)
  const first = actual[0]?.date ?? goal.from.date
  const monthsBetween = (d: string) => (yearOf(d) - yearOf(first)) * 12 + (Number(d.slice(5, 7)) - Number(first.slice(5, 7)))
  const n = monthsBetween(goal.targetDate) + 1
  const xs = Array.from({ length: n }, (_, i) => {
    const y = yearOf(first) + Math.floor((Number(first.slice(5, 7)) - 1 + i) / 12)
    const m = ((Number(first.slice(5, 7)) - 1 + i) % 12) + 1
    return `${y}-${String(m).padStart(2, '0')}-${m === 12 ? '31' : '01'}`
  })
  const idx = (d: string) => monthsBetween(d)

  // Tempoet fra de seneste 12 måneder: samme måned sidste år → i dag.
  const yearsLeft = (new Date(goal.targetDate).getTime() - new Date(a.date).getTime()) / (365.25 * 24 * 3600 * 1000)
  const paceYear = a.totalLy !== null ? a.total - a.totalLy : null
  const paceEnd = paceYear !== null ? Math.round(a.total + paceYear * yearsLeft) : null

  const proj = data.projection
  const cagrEnd = proj?.totalByCagr?.path[proj.totalByCagr.path.length - 1] ?? null
  const sumEnd = proj?.totalBySum?.path[proj.totalBySum.path.length - 1] ?? null

  const series: Series[] = [
    {
      key: 'faktisk', label: `I dag: ${fmtNum(a.total)}`, shortLabel: fmtNum(a.total), color: '#3a557d', width: 2.5, area: true, endLabel: true,
      points: actual.map((t) => ({ x: idx(t.date), y: t.total })),
    },
    {
      key: 'linje', label: `Målet: ${fmtNum(goal.target)}`, shortLabel: fmtNum(goal.target), color: '#d24e46', dashed: true, endLabel: true,
      points: [{ x: idx(goal.from.date), y: goal.from.total }, ...goal.linear.map((l) => ({ x: idx(l.date), y: l.total }))].filter((p) => p.x >= 0),
    },
  ]
  if (paceEnd !== null) {
    series.push({
      key: 'tempo', label: `Seneste års tempo: ${fmtNum(paceEnd)}`, shortLabel: fmtNum(paceEnd), color: '#8299bb', dashed: true, endLabel: true,
      points: [{ x: idx(a.date), y: a.total }, { x: n - 1, y: paceEnd }],
    })
  }

  const xLabels = xs.map((d) => (d.slice(5, 7) === '12' ? String(yearOf(d)) : ''))
  const ahead = goal.gapToday >= 0
  const needed = goal.target - a.total
  const pacePerYear = needed / yearsLeft
  const lastFullYear = goal.yearlyGrowth[goal.yearlyGrowth.length - 1]

  const scenarios: { title: string; how: string; end: number | null }[] = [
    { title: 'Seneste års tempo', how: `${fmtSigned(paceYear)} medlemmer på 12 måneder, fortsat til 2029`, end: paceEnd },
    { title: 'Regnearkets fremskrivning', how: `${fmtPct((proj?.totalByCagr?.cagr ?? 0) * 100)} om året — totalens gennemsnit siden 2022`, end: cagrEnd },
    { title: 'Sum af kategorierne', how: 'Hver kontingentkategori fremskrevet med sin egen vækst', end: sumEnd },
  ]

  return (
    <>
      <SectionHeading
        kicker="Mål 2029"
        title={`${fmtNum(goal.target)} medlemmer den 31. december 2029`}
        lead={`Vi var ${fmtNum(goal.from.total)} ved udgangen af ${yearOf(goal.from.date)}. Så skal vi have ${fmtNum(goal.requiredPerYear)} flere om året i ${yearOf(goal.targetDate) - yearOf(goal.from.date)} år — ${fmtPct(goal.requiredCagr * 100)} årlig vækst.`}
        onDark
        color="#f2d57a"
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <ChartCard
          title="Er vi på vej mod målet?"
          subtitle="Blå: så mange medlemmer har vi haft. Rød: den vej vi skal følge for at ramme 15.000. Grå: hvor vi ender, hvis det seneste års tempo holder. Ligger blå over rød, er vi foran."
          legend={[
            { label: 'Medlemmer indtil nu', color: '#3a557d' },
            { label: 'Vejen til 15.000', color: '#d24e46', dashed: true },
            { label: 'Seneste års tempo, fortsat', color: '#8299bb', dashed: true },
          ]}
          table={
            <DataTable
              columns={[{ key: 'd', label: 'Dato' }, { key: 't', label: 'Medlemmer', align: 'right' }, { key: 'k', label: 'Kilde' }]}
              rows={[
                ...actual.map((t) => ({ d: ddmmyy(t.date), t: fmtNum(t.total), k: t.source })),
                ...goal.linear.map((l) => ({ d: ddmmyy(l.date), t: fmtNum(l.total), k: 'vejen til målet' })),
              ]}
            />
          }
        >
          <Lines
            series={series}
            xLabels={xLabels}
            height={340}
            xTickEvery={1}
            xMarks={[{ x: idx(a.date), label: 'i dag', color: '#3a557d' }]}
            tooltipTitle={(i) => `${MONTHS_SHORT[Number(xs[i].slice(5, 7)) - 1]} ${yearOf(xs[i])}`}
            padRight={190}
          />
        </ChartCard>

        <div className="grid gap-5">
          <Reveal className="card p-5 sm:p-6" delay={0.05}>
            <div className="text-[0.8125rem] font-semibold text-dp-navy-500">Hvor er vi i dag, {ddmmyy(a.date)}?</div>
            <div className="mt-2 font-serif text-[2.25rem] font-semibold leading-none" style={{ color: ahead ? '#179fa0' : '#d24e46' }}>
              {ahead ? `${fmtNum(goal.gapToday)} foran` : `${fmtNum(-goal.gapToday)} bagud`}
            </div>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-dp-navy-600">
              Følger vi vejen til målet, skulle vi i dag have været {fmtNum(goal.onTrackToday)}. Vi er {fmtNum(a.total)}.
              Herfra mangler {fmtNum(needed)} på {yearsLeft.toLocaleString('da-DK', { maximumFractionDigits: 1 })} år, altså {fmtNum(pacePerYear)} om året.
              {lastFullYear && (
                <> Sidste hele år ({lastFullYear.year}) gav {fmtSigned(lastFullYear.delta)}, så tempoet {lastFullYear.delta >= pacePerYear ? 'rækker, hvis det holder' : 'skal op'}.</>
              )}
            </p>
          </Reveal>

          <Reveal className="card p-5 sm:p-6" delay={0.1}>
            <h3 className="text-[1.0625rem] font-semibold text-dp-navy-900">Hvor ender vi 31.12.29?</h3>
            <p className="mt-1 text-[0.8125rem] text-dp-navy-500">Tre måder at regne frem på. Målet er {fmtNum(goal.target)}.</p>
            <ul className="mt-4 divide-y divide-dp-navy-50">
              {scenarios.filter((s) => s.end !== null).map((s) => {
                const gap = (s.end ?? 0) - goal.target
                return (
                  <li key={s.title} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div>
                      <div className="text-[0.875rem] font-semibold text-dp-navy-900">{s.title}</div>
                      <div className="text-[0.75rem] leading-snug text-dp-navy-500">{s.how}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="tnum font-serif text-[1.375rem] font-semibold leading-none text-dp-navy-900">{fmtNum(s.end)}</div>
                      <div className="tnum mt-1 text-[0.75rem] font-semibold" style={{ color: gap >= 0 ? '#179fa0' : '#d24e46' }}>
                        {gap >= 0 ? `rammer målet, ${fmtSigned(gap)}` : `mangler ${fmtNum(-gap)}`}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Reveal>
        </div>
      </div>

      <div className="mt-5">
        <ChartCard title="Hvor mange flere blev vi hvert år?" subtitle="Ændring i alle medlemmer fra 31.12 til 31.12. Den røde streg er, hvad målet kræver hvert år.">
          <div className="relative mx-auto max-w-xl">
            <DivergingBars
              items={goal.yearlyGrowth.map((g) => ({ label: String(g.year), value: g.delta }))}
              height={190}
              width={420}
              positiveColor="#3a557d"
              negativeColor="#d24e46"
              valueFormat={fmtSigned}
            />
            <RequiredLine items={goal.yearlyGrowth.map((g) => g.delta)} required={goal.requiredPerYear} height={190} />
          </div>
        </ChartCard>
      </div>
    </>
  )
}

/** En tynd rød streg over søjlerne ved det tempo, målet kræver. Regnet med samme geometri som DivergingBars. */
function RequiredLine({ items, required, height }: { items: number[]; required: number; height: number }) {
  const pad = { top: 22, bottom: 40 }
  const innerH = height - pad.top - pad.bottom
  const maxPos = Math.max(...items, 0)
  const maxNeg = Math.max(-Math.min(...items, 0), 0)
  const zero = innerH * (maxPos / (maxPos + maxNeg || 1))
  const maxAbs = Math.max(1, ...items.map(Math.abs))
  const scale = Math.max(zero, innerH - zero) / maxAbs
  const y = pad.top + zero - required * scale
  if (y < 4) return null
  return (
    <svg viewBox={`0 0 420 ${height}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <line x1={8} x2={412} y1={y} y2={y} stroke="#d24e46" strokeWidth={1.5} strokeDasharray="6 4" />
      <text x={10} y={y - 5} textAnchor="start" fontSize={10} fontWeight={700} fill="#d24e46">Målet kræver {fmtNum(required)} om året</text>
    </svg>
  )
}
