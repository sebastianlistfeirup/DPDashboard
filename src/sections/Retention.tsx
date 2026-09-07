/**
 * Frafald og fastholdelse — nu med individdata bag.
 *
 * Fire spørgsmål, fire svar: Hvad sker der ved kontingentskiftet? Hvor stor
 * en del af en cand.psych.-årgang er stadig medlem to og tre år senere?
 * Hvad sker der med de studerende, når de bliver færdige? Og hvor mange
 * kontingentskift kommer der de næste to år?
 */
import { useState } from 'react'
import { ChartCard, SectionHeading, Reveal, SplitBand } from '@/components/primitives'
import { DataTable } from '@/components/charts'
import { DivergingBars, Lines, type Series } from '@/components/lines'
import { StackedBars, Legend, FlowMatrix } from '@/components/stacked'
import { MONTHS_SHORT, fmtNum, fmtPct, monthYear, cap, type AsOf } from '@/lib/data'
import { GROUP_COLOR, GROUP_ORDER, monthLabel, type Movements } from '@/lib/movements'

const num = (v: unknown) => (typeof v === 'number' ? v : 0)

export function Retention({ mov, a }: { mov: Movements; a: AsOf }) {
  const labels = mov.meta.groupLabels
  const asOfYear = Number(a.date.slice(0, 4))

  // Kontingentskiftet: udfald pr. år
  const outcomes = mov.shift.outcomeByYear.filter((o) => Number(o.year) <= asOfYear)
  const fulltime = (o: typeof outcomes[number]) => num(o.normal) + num(o.selv) + num(o.phd)
  const total = (o: typeof outcomes[number]) => GROUP_ORDER.reduce((s, g) => s + num(o[g]), 0) + num(o.ud)
  const allOut = outcomes.reduce((acc, o) => { for (const k of [...GROUP_ORDER, 'ud']) acc[k] = (acc[k] ?? 0) + num(o[k]); return acc }, {} as Record<string, number>)
  const allTotal = Object.values(allOut).reduce((s, v) => s + v, 0)
  const conv = allTotal ? ((allOut.normal + allOut.selv + allOut.phd) / allTotal) * 100 : 0

  // Kohorter: andel stadig medlem, måned for måned efter cand.psych.
  const cohortYears = Object.keys(mov.cohorts).filter((y) => Number(y) >= 2022 && Number(y) <= asOfYear).sort()
  const cohortColors: Record<string, string> = { '2022': '#aebdd4', '2023': '#8299bb', '2024': '#4c7bbd', '2025': '#df790d', '2026': '#d24e46' }
  const maxK = 42
  const cohortSeries: Series[] = cohortYears.map((y) => {
    const c = mov.cohorts[y]
    return {
      key: y, label: `${y} (${fmtNum(c.n)})`, shortLabel: y, color: cohortColors[y] ?? '#4e4897', endLabel: true, width: 2.25,
      points: c.series.filter((s) => s.k <= maxK).map((s) => {
        const seen = GROUP_ORDER.reduce((t, g) => t + num(s[g]), 0) + num(s.ud)
        return { x: s.k, y: seen >= c.n * 0.6 ? (GROUP_ORDER.reduce((t, g) => t + num(s[g]), 0) / seen) * 100 : null }
      }),
    }
  })
  const [cohortYear, setCohortYear] = useState(cohortYears[cohortYears.length - 2] ?? cohortYears[0])
  const cohort = mov.cohorts[cohortYear]
  const stackKeys = ['stud', 'kandidat', 'normal', 'selv', 'phd', 'ledig', 'andet', 'ud']

  // Studerende: hvad sker der, når de forlader kategorien
  const studOut = mov.students.outByYear.filter((o) => Number(o.year) >= 2023 && Number(o.year) <= asOfYear)
  const studKeys = ['kandidat', 'ledig', 'normal', 'ud', 'andet']

  const shiftTotal = mov.shift.monthsSinceCand.reduce((t, x) => t + x.n, 0)
  const shareAt25 = shiftTotal ? ((mov.shift.monthsSinceCand.find((x) => x.k === 25)?.n ?? 0) / shiftTotal) * 100 : 0

  // Kommende kontingentskift
  const plannedShift = (m: string) => (mov.students.planned ?? []).find((p) => p.month === m)
  const plannedN = (m: string, pairs: string[]) => { const p = plannedShift(m); return p ? pairs.reduce((t, k) => t + num(p[k]), 0) : 0 }
  const upcomingMonths = (() => {
    const start = a.date.slice(0, 7)
    const out: string[] = []
    let y = Number(start.slice(0, 4)), mo = Number(start.slice(5, 7))
    for (let i = 0; i < 24; i++) { mo++; if (mo > 12) { mo = 1; y++ } out.push(`${y}-${String(mo).padStart(2, '0')}`) }
    return out
  })()
  const upcomingItems = upcomingMonths.map((m) => {
    const planned = plannedN(m, ['kandidat→normal', 'kandidat→selv', 'kandidat→phd'])
    const computed = mov.shift.upcoming.find((u) => u.month === m)?.n ?? 0
    return { label: monthLabel(m), parts: { planlagt: planned, beregnet: computed } }
  })
  const upcomingTotal = upcomingItems.reduce((t, it) => t + it.parts.planlagt + it.parts.beregnet, 0)
  // Kandidattilgang: planlagte stud→kandidat + forventede dimissioner uden planlagt skift
  const gradItems = upcomingMonths.map((m) => {
    const planned = plannedN(m, ['stud→kandidat', 'ledig→kandidat'])
    const expected = mov.students.byExpectedMonth?.[m] ?? 0
    return { label: monthLabel(m), parts: { planlagt: planned, forventet: Math.max(0, expected - planned) } }
  })
  const gradTotal = gradItems.reduce((t, it) => t + it.parts.planlagt + it.parts.forventet, 0)
  const join = mov.students.joinYear ?? []
  const joinTotal = join.reduce((t, j) => t + j.students, 0) || 1

  // Bevægelser seneste 12 måneder som matrix
  const last12 = mov.transitions.filter((t) => t.month <= a.date.slice(0, 7)).slice(-12)
  const cell = (r: string, c: string) => last12.reduce((s, t) => s + (t.moves.find((m) => m.from_ === r && m.to === c)?.n ?? 0), 0)

  return (
    <>
      <SectionHeading
        kicker="Frafald og fastholdelse"
        title={`${fmtPct(conv, 0)} af kandidaterne bliver fuldtidsbetalende`}
        lead="Målt på hvert enkelt medlem: alle, der var 1.-2. års kandidat 24 måneder efter deres cand.psych.-dato, og hvad de var tre måneder senere. Det kritiske kontingentskift er ikke særlig kritisk — det er de studerende, vi taber."
        onDark
        color="#8ebec0"
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Kontingentskiftet, år for år" subtitle="Hvad kandidaterne blev til tre måneder efter, at de nåede 24 måneder. Ét medlem = én tælling.">
          <ul className="space-y-4">
            {outcomes.map((o) => {
              const t = total(o)
              return (
                <li key={o.year}>
                  <div className="mb-1.5 flex items-baseline justify-between text-[0.8125rem]">
                    <span className="font-semibold text-dp-navy-900">{o.year} <span className="font-normal text-dp-navy-500">· {fmtNum(t)} nåede skiftet</span></span>
                    <span className="tnum font-semibold" style={{ color: '#179fa0' }}>{fmtPct(t ? (fulltime(o) / t) * 100 : 0, 0)} fuldtidsbetalende</span>
                  </div>
                  <SplitBand height={12} segments={[
                    { value: num(o.normal), color: GROUP_COLOR.normal, label: `Normalansat ${num(o.normal)}` },
                    { value: num(o.selv), color: GROUP_COLOR.selv, label: `Selvstændig ${num(o.selv)}` },
                    { value: num(o.phd), color: GROUP_COLOR.phd, label: `Ph.d. ${num(o.phd)}` },
                    { value: num(o.ledig), color: GROUP_COLOR.ledig, label: `Ledig ${num(o.ledig)}` },
                    { value: num(o.kandidat), color: GROUP_COLOR.kandidat, label: `Stadig kandidat ${num(o.kandidat)}` },
                    { value: num(o.andet), color: GROUP_COLOR.andet, label: `Øvrige ${num(o.andet)}` },
                    { value: num(o.ud), color: GROUP_COLOR.ud, label: `Udmeldt ${num(o.ud)}` },
                  ]} />
                  <div className="tnum mt-1 text-[0.6875rem] text-dp-navy-500">
                    {fmtNum(num(o.normal))} normalansat · {fmtNum(num(o.selv))} selvstændig · {fmtNum(num(o.ledig))} ledig · {fmtNum(num(o.kandidat))} stadig kandidat · <span style={{ color: '#d24e46' }}>{fmtNum(num(o.ud))} udmeldt</span>
                  </div>
                </li>
              )
            })}
          </ul>
          <Legend keys={['normal', 'selv', 'phd', 'ledig', 'kandidat', 'andet', 'ud']} colors={GROUP_COLOR} labels={{ ...labels, kandidat: 'Stadig kandidat' }} />
        </ChartCard>

        <div className="grid gap-5">
          <ChartCard title="Hvornår på året sker skiftet?" subtitle="Kontingentskift pr. kalendermåned, alle år lagt sammen.">
            <DivergingBars items={mov.shift.byCalendarMonth.map((n, i) => ({ label: MONTHS_SHORT[i], value: n }))} height={150} width={420} positiveColor="#4e4897" />
            <p className="mt-2 text-[0.75rem] leading-relaxed text-dp-navy-500">
              {fmtPct(shareAt25, 0)} af skiftene sker præcis 25 måneder efter cand.psych.-datoen — to år efter dimissionen, med virkning fra den følgende måned. Fordi de fleste bliver færdige i januar og juni, lander skiftene i februar og juli. Det er derfor kongeindikatoren springer de to måneder.
            </p>
          </ChartCard>
          <ChartCard title={`Kommende kontingentskift: ${fmtNum(upcomingTotal)} på 24 måneder`} subtitle="Mørk: skift, medlemssystemet allerede har planlagt (fremtidig medlemstype). Lys: kandidater, der endnu ikke har fået en planlagt dato, fremskrevet 25 måneder fra cand.psych.-datoen. Med 94 % konvertering er det den sikreste forudsigelse af kongeindikatoren, vi har.">
            <StackedBars items={upcomingItems} keys={['planlagt', 'beregnet']} colors={{ planlagt: '#4e4897', beregnet: '#bcbbde' }} labels={{ planlagt: 'Planlagt i systemet', beregnet: 'Beregnet fra cand.psych.-dato' }} height={170} width={520} />
            <Legend keys={['planlagt', 'beregnet']} colors={{ planlagt: '#4e4897', beregnet: '#bcbbde' }} labels={{ planlagt: 'Planlagt i systemet', beregnet: 'Beregnet fra cand.psych.-dato' }} />
          </ChartCard>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ChartCard
          title="Årgange: hvor mange er stadig medlem?"
          subtitle="Alle med cand.psych. i samme år, der var medlem inden for et halvt år efter. Andel stadig medlem, måned for måned — knækket ved måned 24–25 er kontingentskiftet."
          table={<DataTable columns={[{ key: 'y', label: 'Årgang' }, { key: 'n', label: 'Medlemmer', align: 'right' }, { key: 'k12', label: '12 mdr.', align: 'right' }, { key: 'k24', label: '24 mdr.', align: 'right' }, { key: 'k30', label: '30 mdr.', align: 'right' }, { key: 'k36', label: '36 mdr.', align: 'right' }]}
                            rows={cohortSeries.map((s) => ({ y: s.key, n: fmtNum(mov.cohorts[s.key].n), k12: fmtPct(s.points.find((p) => p.x === 12)?.y ?? null, 0), k24: fmtPct(s.points.find((p) => p.x === 24)?.y ?? null, 0), k30: fmtPct(s.points.find((p) => p.x === 30)?.y ?? null, 0), k36: fmtPct(s.points.find((p) => p.x === 36)?.y ?? null, 0) }))} />}
        >
          <Lines series={cohortSeries} xLabels={Array.from({ length: maxK + 1 }, (_, i) => (i % 6 === 0 ? `${i} mdr.` : ''))} height={280}
                 valueFormat={(n) => fmtPct(n, 0)} yMin={60} yMax={100} xTickEvery={1} tooltipTitle={(i) => `${i} måneder efter cand.psych.`}
                 bands={[{ x0: 23.5, x1: 25.5, label: 'kontingentskift', color: '#4e4897' }]} padRight={110} />
          <p className="mt-2 text-[0.75rem] leading-relaxed text-dp-navy-500">
            Tre år efter dimissionen er omkring 85 % stadig medlem. Frafaldet er jævnt over hele perioden — det er ikke kontingentskiftet, der får dem til at gå.
          </p>
        </ChartCard>

        <ChartCard
          title={`Årgang ${cohortYear}, måned for måned`}
          subtitle="Hvad de er, fra cand.psych.-måneden og frem."
          actions={<div className="flex flex-wrap gap-1.5">{cohortYears.map((y) => (
            <button key={y} type="button" aria-pressed={y === cohortYear} onClick={() => setCohortYear(y)}
                    className={`tnum rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold transition ${y === cohortYear ? 'border-dp-navy-600 bg-dp-navy-600 text-white' : 'border-dp-navy-100 text-dp-navy-600 hover:border-dp-navy-300'}`}>{y}</button>
          ))}</div>}
        >
          {cohort && (
            <>
              <StackedBars items={cohort.series.filter((s) => s.k <= maxK && s.k % 3 === 0).map((s) => ({ label: `${s.k}`, parts: Object.fromEntries(stackKeys.map((k) => [k, num(s[k])])) }))}
                           keys={stackKeys} colors={GROUP_COLOR} labels={{ ...labels, ud: 'Udmeldt' }} height={230} width={420} percent />
              <Legend keys={stackKeys} colors={GROUP_COLOR} labels={{ ...labels, ud: 'Udmeldt' }} />
              <p className="mt-2 text-[0.6875rem] text-dp-navy-400">Måneder efter cand.psych. Kun hver tredje måned vist. {fmtNum(cohort.n)} medlemmer i årgangen.</p>
            </>
          )}
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ChartCard title={`Hvornår kommer de nye kandidater? ${fmtNum(gradTotal)} på 24 måneder`} subtitle="Mørk: flytninger til kandidat, som systemet allerede har planlagt. Lys: studerende med forventet slutdato i måneden, som endnu ikke har en planlagt flytning. Historisk bliver godt halvdelen af dem kandidater, resten ledige eller udmeldte."
                   table={<DataTable columns={[{ key: 'm', label: 'Måned' }, { key: 'p', label: 'Planlagt', align: 'right' }, { key: 'f', label: 'Forventet slutdato', align: 'right' }]}
                                     rows={gradItems.map((g) => ({ m: g.label, p: fmtNum(g.parts.planlagt), f: fmtNum(g.parts.forventet) }))} />}>
          <StackedBars items={gradItems} keys={['planlagt', 'forventet']} colors={{ planlagt: '#4fa388', forventet: '#c4dcdb' }} labels={{ planlagt: 'Planlagt flytning til kandidat', forventet: 'Forventet slutdato, ikke planlagt' }} height={200} />
          <Legend keys={['planlagt', 'forventet']} colors={{ planlagt: '#4fa388', forventet: '#c4dcdb' }} labels={{ planlagt: 'Planlagt flytning til kandidat', forventet: 'Forventet slutdato, ikke planlagt' }} />
          {mov.students.byLevel && (
            <p className="mt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">
              Studerende i dag: {fmtNum(mov.students.byLevel.kandidatdel)} på kandidatdelen og {fmtNum(mov.students.byLevel.bachelordel)} på bachelordelen. Toppene i januar og juni er de to dimissionsterminer.
            </p>
          )}
        </ChartCard>
        <ChartCard title="Hvornår i studiet melder de sig ind?" subtitle="Nuværende studerende, efter hvor langt de var i studiet, da de meldte sig ind i DP.">
          <ul className="space-y-2">
            {join.filter((j) => j.students > 0).map((j) => (
              <li key={j.band}>
                <div className="mb-0.5 flex justify-between text-[0.8125rem]"><span className="text-dp-navy-800">{j.band === 'før studiestart' ? 'Ved optaget, før studiestart' : j.band === 'i bachelordelen' ? 'I bachelordelen (år ukendt)' : j.band}</span><span className="tnum font-semibold text-dp-navy-900">{fmtNum(j.students)} <span className="text-[0.6875rem] font-normal text-dp-navy-500">{fmtPct((j.students / joinTotal) * 100, 0)}</span></span></div>
                <div className="h-1.5 rounded-full bg-dp-navy-100"><div className="h-full rounded-full" style={{ width: `${(j.students / Math.max(...join.map((x) => x.students))) * 100}%`, background: GROUP_COLOR.stud }} /></div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">
            To bølger: én ved studiestart og én ved overgangen til kandidatdelen. Årene imellem er stille — dér er der studerende, som endnu ikke er medlemmer.
          </p>
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Når de studerende bliver færdige"
          subtitle="Hvad studerende blev til i den måned, de forlod studenterkategorien. Det er her, frafaldet ligger."
          table={<DataTable columns={[{ key: 'y', label: 'År' }, ...studKeys.map((k) => ({ key: k, label: labels[k] ?? k, align: 'right' as const }))]}
                            rows={studOut.map((o) => ({ y: o.year, ...Object.fromEntries(studKeys.map((k) => [k, fmtNum(num(o[k]))])) }))} />}
        >
          <StackedBars items={studOut.map((o) => ({ label: o.year, parts: Object.fromEntries(studKeys.map((k) => [k, num(o[k])])) }))}
                       keys={studKeys} colors={GROUP_COLOR} labels={{ ...labels, ud: 'Udmeldt' }} height={230} width={420} />
          <Legend keys={studKeys} colors={GROUP_COLOR} labels={{ ...labels, ud: 'Udmeldt' }} />
          <p className="mt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">
            Hver tredje studerende, der forlader kategorien, forlader også foreningen. Dem, der bliver, går enten til kandidat-kontingent eller direkte til ledig. Studerende, der får rettet deres dimittenddato i tide, ender som kandidater — det er den indsats, der flyttede tallet i 2025.
          </p>
          {mov.students.byExpectedYear && (
            <div className="mt-4 rounded-xl bg-dp-navy-50 p-4">
              <div className="text-[0.75rem] font-semibold text-dp-navy-600">Studerende i dag efter forventet slutår</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(mov.students.byExpectedYear).filter(([k]) => /^\d{4}$/.test(k)).map(([y, n]) => (
                  <span key={y} className="tnum rounded-full bg-white px-2.5 py-1 text-[0.75rem] font-semibold text-dp-navy-800">{y}: {fmtNum(n)}</span>
                ))}
                {mov.students.byExpectedYear.overskredet && <span className="tnum rounded-full bg-dp-orange-15 px-2.5 py-1 text-[0.75rem] font-semibold text-dp-navy-800">slutdato overskredet: {fmtNum(mov.students.byExpectedYear.overskredet)}</span>}
              </div>
              <p className="mt-2 text-[0.6875rem] leading-snug text-dp-navy-500">De med overskredet slutdato er studerende, der formentlig er færdige, men stadig står som studerende. Det er den gruppe, der skal have rettet dimittenddato.</p>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Bevægelser mellem grupper, seneste 12 måneder" subtitle="Rækker er hvor medlemmet kom fra, kolonner hvor det endte. Jo mørkere, jo flere.">
          <FlowMatrix rows={['ind', ...GROUP_ORDER]} cols={[...GROUP_ORDER, 'ud']} cell={cell}
                      labels={{ ...labels, ind: 'Nye', ud: 'Udmeldt', normal: 'Normal', selv: 'Selv', phd: 'Ph.d.', kandidat: 'Kand.', stud: 'Stud.', ledig: 'Ledig', pens: 'Pens.', andet: 'Øvr.' }} colors={GROUP_COLOR} />
          <p className="mt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">
            Skift mellem kontingentgrupper er ikke ind- og udmeldelser — men de bestemmer kongeindikatoren. Kandidat → normalansat er den store bevægelse; ledig → normalansat den næststørste.
          </p>
        </ChartCard>
      </div>

      <div className="mt-5">
        <Reveal className="card p-5 sm:p-6">
          <h3 className="text-[1.0625rem] font-semibold text-dp-navy-900">Det siger individdata, som nettotallene ikke kunne</h3>
          <ul className="mt-3 grid gap-2.5 text-[0.875rem] leading-relaxed text-dp-navy-700 md:grid-cols-2">
            {[
              `${fmtPct(conv, 0)} af dem, der når kontingentskiftet, bliver fuldtidsbetalende. Kun ${fmtPct(allTotal ? (allOut.ud / allTotal) * 100 : 0, 1)} melder sig ud i den forbindelse.`,
              `Skiftet sker i måned 25 efter cand.psych. — i februar og juli. Der er ${fmtNum(upcomingTotal)} kontingentskift på vej de næste 24 måneder, og ${fmtNum(gradTotal)} nye kandidater.`,
              'Frafaldet i en cand.psych.-årgang er jævnt, omkring 5 % om året, og det er ikke højere omkring kontingentskiftet.',
              'Studerende er det utætte led: hver tredje, der forlader studenterkategorien, forlader foreningen. Og godt 500 står med overskredet slutdato.',
              'Restance er den enkeltstørste kendte udmeldelsesårsag efter "anden årsag" — og den slår igennem i december og marts.',
              `Pensionister udmeldes med ${fmtPct(mov.churnRate.pens?.pct ?? null, 0)} om året; det er en forudsigelig afgang, som målet for 2029 skal regne med.`,
            ].map((s) => (
              <li key={s} className="flex gap-2.5"><span className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-dp-orange" /><span>{s}</span></li>
            ))}
          </ul>
        </Reveal>
      </div>
    </>
  )
}

export { MONTHS_SHORT, monthYear, cap }
