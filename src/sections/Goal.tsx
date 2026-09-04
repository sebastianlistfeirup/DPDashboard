/**
 * Målet: 15.000 medlemmer 31.12.29.
 *
 * Den lange kurve fra 2022 og frem, målstregen, den lige linje derhen og de
 * to fremskrivninger fra Sebastians regneark. Og et enkelt svar på det
 * spørgsmål ledergruppen vil stille: er vi foran eller bagud?
 */
import { ChartCard, SectionHeading, Reveal } from '@/components/primitives'
import { DataTable } from '@/components/charts'
import { Lines, type Series } from '@/components/lines'
import { DivergingBars } from '@/components/lines'
import { MONTHS_SHORT, fmtNum, fmtPct, fmtSigned, ddmmyy, yearOf, type AsOf, type Dashboard, type GoalPath } from '@/lib/data'

export function Goal({ data, a, goal }: { data: Dashboard; a: AsOf; goal: GoalPath }) {
  // Tidsakse: alle faktiske nedslag op til den valgte måned + hvert 31.12 frem til målet
  const actual = data.totals.filter((t) => t.date <= a.date)
  // Tidsaksen er én position pr. måned fra første nedslag til målet, så
  // fremskrivningen får samme afstand pr. år som historikken.
  const first = actual[0]?.date ?? goal.from.date
  const monthsBetween = (d: string) => (yearOf(d) - yearOf(first)) * 12 + (Number(d.slice(5, 7)) - Number(first.slice(5, 7)))
  const n = monthsBetween(goal.targetDate) + 1
  const xs = Array.from({ length: n }, (_, i) => {
    const y = yearOf(first) + Math.floor((Number(first.slice(5, 7)) - 1 + i) / 12)
    const m = ((Number(first.slice(5, 7)) - 1 + i) % 12) + 1
    return `${y}-${String(m).padStart(2, '0')}-${m === 12 ? '31' : '01'}`
  })
  const idx = (d: string) => monthsBetween(d)

  const proj = data.projection
  const projDates = proj?.dates ?? []

  const series: Series[] = [
    {
      key: 'faktisk', label: 'Faktisk', color: '#3a557d', width: 2.5, area: true, endLabel: false,
      points: actual.map((t) => ({ x: idx(t.date), y: t.total })),
    },
    {
      key: 'linje', label: 'Lige linje til målet', color: '#d24e46', dashed: true, endLabel: true,
      points: [{ x: idx(goal.from.date), y: goal.from.total }, ...goal.linear.map((l) => ({ x: idx(l.date), y: l.total }))]
        .filter((p) => p.x >= 0),
    },
  ]
  if (proj?.totalByCagr) {
    series.push({
      key: 'cagr', label: `Fremskrivning ${fmtPct(proj.totalByCagr.cagr * 100)}`, color: '#8299bb', dashed: true, endLabel: true,
      points: [{ x: idx(a.date), y: a.total }, ...proj.totalByCagr.path.map((v, i) => ({ x: idx(projDates[i]), y: v }))].filter((p) => p.x >= 0),
    })
  }
  if (proj?.totalBySum) {
    series.push({
      key: 'sum', label: 'Sum af kategorier', color: '#4fa388', dashed: true, endLabel: true,
      points: [{ x: idx(a.date), y: a.total }, ...proj.totalBySum.path.map((v, i) => ({ x: idx(projDates[i]), y: v }))].filter((p) => p.x >= 0),
    })
  }

  const xLabels = xs.map((d) => (d.slice(5, 7) === '12' ? `31.12.${d.slice(2, 4)}` : ''))
  const ahead = goal.gapToday >= 0
  const needed = goal.target - a.total
  const yearsLeft = (new Date(goal.targetDate).getTime() - new Date(a.date).getTime()) / (365.25 * 24 * 3600 * 1000)
  const pacePerYear = needed / yearsLeft
  const lastFullYear = goal.yearlyGrowth[goal.yearlyGrowth.length - 1]

  return (
    <>
      <SectionHeading
        kicker="Mål 2029"
        title={`${fmtNum(goal.target)} medlemmer den 31. december 2029`}
        lead={`Fra ${fmtNum(goal.from.total)} medlemmer ved udgangen af ${yearOf(goal.from.date)} kræver det ${fmtNum(goal.requiredPerYear)} nye medlemmer om året, eller ${fmtPct(goal.requiredCagr * 100)} årlig vækst.`}
        onDark
        color="#f2d57a"
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <ChartCard
          title="Medlemstal 2022 → 2029"
          subtitle="Fuldt optrukket er faktiske tal. Stiplet er veje frem: den lige linje til målet, og de to fremskrivninger fra regnearket."
          legend={[
            { label: 'Faktisk', color: '#3a557d' },
            { label: 'Lige linje til 15.000', color: '#d24e46', dashed: true },
            { label: 'Fremskrivning på totalens vækst', color: '#8299bb', dashed: true },
            { label: 'Sum af kategori-fremskrivninger', color: '#4fa388', dashed: true },
          ]}
          table={
            <DataTable
              columns={[{ key: 'd', label: 'Dato' }, { key: 't', label: 'Medlemmer', align: 'right' }, { key: 'k', label: 'Kilde' }]}
              rows={[
                ...actual.map((t) => ({ d: ddmmyy(t.date), t: fmtNum(t.total), k: t.source })),
                ...goal.linear.map((l) => ({ d: ddmmyy(l.date), t: fmtNum(l.total), k: 'lige linje til målet' })),
              ]}
            />
          }
        >
          <Lines
            series={series}
            xLabels={xLabels}
            height={340}
            xTickEvery={1}
            refLines={[{ y: goal.target, label: `Mål ${fmtNum(goal.target)}`, color: '#d24e46' }]}
            tooltipTitle={(i) => `${MONTHS_SHORT[Number(xs[i].slice(5, 7)) - 1]} ${yearOf(xs[i])}`}
            padRight={150}
          />
        </ChartCard>

        <div className="grid gap-5">
          <Reveal className="card p-5 sm:p-6" delay={0.05}>
            <div className="text-[0.8125rem] font-semibold text-dp-navy-500">Status pr. {ddmmyy(a.date)}</div>
            <div className="mt-2 font-serif text-[2.25rem] font-semibold leading-none" style={{ color: ahead ? '#179fa0' : '#d24e46' }}>
              {ahead ? `${fmtNum(goal.gapToday)} foran` : `${fmtNum(-goal.gapToday)} bagud`}
            </div>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-dp-navy-600">
              Den lige linje siger {fmtNum(goal.onTrackToday)} medlemmer i dag; vi har {fmtNum(a.total)}.
              Herfra mangler {fmtNum(needed)} på {yearsLeft.toLocaleString('da-DK', { maximumFractionDigits: 1 })} år — {fmtNum(pacePerYear)} om året.
              {lastFullYear && (
                <> Sidste hele år ({lastFullYear.year}) gav {fmtSigned(lastFullYear.delta)}, så tempoet {lastFullYear.delta >= pacePerYear ? 'rækker, hvis det holder' : 'skal op'}.</>
              )}
            </p>
          </Reveal>

          <ChartCard title="Vækst pr. kalenderår" subtitle="Ændring i alle medlemmer fra 31.12 til 31.12. Den røde streg er det tempo, målet kræver.">
            <div className="relative">
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
      <text x={10} y={y - 5} textAnchor="start" fontSize={10} fontWeight={700} fill="#d24e46">Målet kræver {fmtNum(required)} pr. år</text>
    </svg>
  )
}
