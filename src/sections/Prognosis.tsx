/**
 * Prognose: kongeindikatoren 24 måneder frem, med usikkerhedsbånd — og
 * svaret på spørgsmålet "var den her måned som forventet, eller et signal?"
 */
import { ChartCard, SectionHeading, Reveal } from '@/components/primitives'
import { DataTable } from '@/components/charts'
import { DivergingBars, Lines, type Series } from '@/components/lines'
import { MONTHS_SHORT, fmtNum, fmtPct, fmtSigned, monthIndex, yearOf, type AsOf, type Dashboard } from '@/lib/data'
import { monthLabel, type Movements } from '@/lib/movements'

export function Prognosis({ data, mov }: { data: Dashboard; mov: Movements; a: AsOf }) {
  const p = mov.prognosis
  if (!p) return null
  const year = yearOf(mov.meta.last)

  // Faktisk kongeindikator i år (fra dashboardets egne tal), så prognosen hænger på det tal ledergruppen kender
  const kongeNow = (data.konge[String(year)] ?? []).filter((k) => k.date.slice(0, 7) <= mov.meta.last)
  const kongeAtLast = kongeNow[kongeNow.length - 1]?.value ?? 0
  // Prognosen: i år = kongeNow + ændring i bestanden; næste år nulstilles ved 31.12
  const fc = p.forecast
  const decStock: Record<number, number> = {}
  for (const f of fc) if (f.month.endsWith('-12')) decStock[Number(f.month.slice(0, 4))] = f.stock
  const kongeFc = fc.map((f) => {
    const y = Number(f.month.slice(0, 4))
    const base = y === year ? p.stockNow - kongeAtLast : decStock[y - 1]
    return { month: f.month, konge: base !== undefined ? f.stock - base : null, low: base !== undefined ? f.low - base : null, high: base !== undefined ? f.high - base : null }
  })

  // Tidsakse: årets måneder til dato + 24 måneder frem
  const xs: string[] = []
  for (let m = 1; m <= 12; m++) { const k = `${year}-${String(m).padStart(2, '0')}`; if (k <= mov.meta.last) xs.push(k) }
  for (const f of fc) xs.push(f.month)
  const idx = (m: string) => xs.indexOf(m)
  const series: Series[] = [
    { key: 'faktisk', label: `Faktisk: ${fmtSigned(kongeAtLast)}`, shortLabel: fmtSigned(kongeAtLast), color: '#df790d', width: 3, dots: true, endLabel: true,
      points: kongeNow.map((k) => ({ x: idx(k.date.slice(0, 7)), y: k.value })) },
    { key: 'high', label: 'Øvre', color: '#c9d2de', width: 1, dashed: true, points: kongeFc.map((k) => ({ x: idx(k.month), y: k.high })) },
    { key: 'low', label: 'Nedre', color: '#c9d2de', width: 1, dashed: true, points: kongeFc.map((k) => ({ x: idx(k.month), y: k.low })) },
    { key: 'forventet', label: 'Forventet', color: '#3a557d', width: 2.5, endLabel: true, shortLabel: 'Forventet',
      points: [{ x: idx(mov.meta.last), y: kongeAtLast }, ...kongeFc.map((k) => ({ x: idx(k.month), y: k.konge }))] },
  ]
  const yearEnds = kongeFc.filter((k) => k.month.endsWith('-12'))
  const endThisYear = yearEnds.find((k) => k.month.startsWith(String(year)))
  const endNextYear = yearEnds.find((k) => k.month.startsWith(String(year + 1)))

  // Som forventet eller signal: backtestens afvigelse måned for måned (ændring i bestanden)
  const bt = p.backtest.filter((b) => b.actual !== null)
  const diffs = bt.map((b, i) => {
    const prevExp = i ? bt[i - 1].expected : null, prevAct = i ? bt[i - 1].actual : null
    const expStep = prevExp !== null ? b.expected - prevExp : null
    const actStep = prevAct !== null && b.actual !== null ? b.actual - prevAct : null
    return { month: b.month, diff: expStep !== null && actStep !== null ? actStep - expStep : null, expStep, actStep }
  }).filter((d) => d.diff !== null)
  const signal = 2 * p.sd
  const lastDiff = diffs[diffs.length - 1]

  return (
    <>
      <SectionHeading
        kicker="Prognose"
        title={`Kongeindikatoren ventes at lande på ${fmtSigned(endThisYear?.konge ?? null)} ved årets udgang`}
        lead={`Og ${fmtSigned(endNextYear?.konge ?? null)} for ${year + 1}. Regnet på de planlagte kontingentskift (${fmtPct(p.conversion * 100, 0)} bliver fuldtidsbetalende), pensionsafgangen, og de seneste to års ind- og udmeldelser måned for måned. Båndet er, hvor langt prognosen har ramt ved siden af før.`}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard
          title="Kongeindikatoren, faktisk og forventet"
          subtitle={`Orange er året til dato. Blå er prognosen 24 måneder frem, nulstillet ved 31.12 som indikatoren selv. Det grå bånd er usikkerheden.`}
          legend={[{ label: 'Faktisk', color: '#df790d' }, { label: 'Forventet', color: '#3a557d' }, { label: 'Usikkerhed', color: '#c9d2de', dashed: true }]}
          table={<DataTable columns={[{ key: 'm', label: 'Måned' }, { key: 'k', label: 'Forventet', align: 'right' }, { key: 'b', label: 'Bånd', align: 'right' }, { key: 's', label: 'Skift', align: 'right' }, { key: 'i', label: 'Anden tilgang', align: 'right' }, { key: 'u', label: 'Afgang', align: 'right' }]}
                            rows={fc.map((f, i) => ({ m: monthLabel(f.month), k: fmtSigned(kongeFc[i].konge), b: `±${fmtNum(f.band)}`, s: fmtNum(f.skift), i: fmtNum(f.ind), u: fmtNum(f.ud) }))} />}
        >
          <Lines series={series} xLabels={xs.map((m) => (m.endsWith('-01') || m === xs[0] ? `${MONTHS_SHORT[monthIndex(m + '-01')]} ${m.slice(2, 4)}` : monthIndex(m + '-01') % 3 === 0 ? MONTHS_SHORT[monthIndex(m + '-01')] : ''))}
                 height={320} valueFormat={fmtSigned} xTickEvery={1} tooltipTitle={(i) => monthLabel(xs[i])} padRight={110}
                 xMarks={[{ x: idx(mov.meta.last), label: 'i dag', color: '#df790d' }]} />
          <p className="mt-2 text-[0.75rem] leading-relaxed text-dp-navy-500">
            Springene i februar og juli er kontingentskiftene: {fmtNum(fc.filter((f) => f.month.endsWith('-07'))[0]?.skift ?? 0)} kandidater skifter i juli {year + 1}. Faldet i januar er årsskiftets udmeldelser.
          </p>
        </ChartCard>

        <div className="grid gap-5">
          <Reveal className="card p-5 sm:p-6">
            <div className="text-[0.8125rem] font-semibold text-dp-navy-500">Var {monthLabel(mov.meta.last)} som forventet?</div>
            {lastDiff && (
              <>
                <div className="mt-1 font-serif text-[1.75rem] font-semibold leading-none" style={{ color: Math.abs(lastDiff.diff ?? 0) > signal ? ((lastDiff.diff ?? 0) > 0 ? '#179fa0' : '#d24e46') : '#16233a' }}>
                  {Math.abs(lastDiff.diff ?? 0) > signal ? ((lastDiff.diff ?? 0) > 0 ? 'Bedre end ventet' : 'Dårligere end ventet') : 'Som forventet'}
                </div>
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-dp-navy-600">
                  Fuldtidsbetalende ændrede sig {fmtSigned(lastDiff.actStep)} i måneden; prognosen sagde {fmtSigned(lastDiff.expStep)}. Afvigelsen er {fmtSigned(lastDiff.diff)} — et signal kræver mere end ±{fmtNum(Math.round(signal))} (to gange den normale månedsspredning).
                </p>
              </>
            )}
          </Reveal>
          <ChartCard title="Signal eller støj, de seneste 12 måneder" subtitle="Faktisk ændring minus forventet ændring i fuldtidsbetalende, måned for måned. Uden for de stiplede linjer er det et signal.">
            <div className="relative">
              <DivergingBars items={diffs.map((d) => ({ label: monthLabel(d.month), value: d.diff }))} height={190} width={420} positiveColor="#179fa0" negativeColor="#d24e46" valueFormat={fmtSigned} />
            </div>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-dp-navy-500">
              Prognosen for det forgangne år er regnet, som den ville have set ud dengang — uden de planlagte datoer, som først findes nu. Derfor undervurderede den juli-springet. Fremadrettet er den skarpere.
            </p>
          </ChartCard>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard title="Sidste års prognose mod virkeligheden" subtitle="Bestanden af fuldtidsbetalende: hvad modellen ville have sagt for et år siden, og hvad der skete.">
          <Lines series={[
            { key: 'act', label: 'Faktisk', color: '#df790d', width: 2.5, endLabel: true, points: bt.map((b, i) => ({ x: i, y: b.actual })) },
            { key: 'exp', label: 'Forventet', color: '#3a557d', dashed: true, endLabel: true, points: bt.map((b, i) => ({ x: i, y: b.expected })) },
          ]} xLabels={bt.map((b) => monthLabel(b.month))} height={220} xTickEvery={2} padRight={80} />
          <p className="mt-2 text-[0.75rem] leading-relaxed text-dp-navy-500">
            Efter 12 måneder ramte modellen {fmtSigned((bt[bt.length - 1]?.actual ?? 0) - (bt[bt.length - 1]?.expected ?? 0))} ved siden af — det er det, båndet på 24-måneders-prognosen bygger på.
          </p>
        </ChartCard>
        <ChartCard title="Hvad prognosen består af" subtitle="Tilgang og afgang til fuldtidsbetalende, de næste 12 måneder.">
          <DataTable columns={[{ key: 'm', label: 'Måned' }, { key: 's', label: 'Kontingentskift', align: 'right' }, { key: 'i', label: 'Nye, ledige der får job m.fl.', align: 'right' }, { key: 'u', label: 'Udmeldt, pension, ledig m.fl.', align: 'right' }, { key: 'n', label: 'Netto', align: 'right' }]}
                     rows={fc.slice(0, 12).map((f) => ({ m: monthLabel(f.month), s: fmtNum(f.skift), i: fmtNum(f.ind), u: fmtNum(f.ud), n: fmtSigned(f.skift + f.ind - f.ud) }))} />
          <p className="mt-2 text-[0.75rem] leading-relaxed text-dp-navy-500">
            Kontingentskift: systemets planlagte datoer × {fmtPct(p.conversion * 100, 0)}. Resten: gennemsnittet for samme kalendermåned de seneste 24 måneder.
          </p>
        </ChartCard>
      </div>
    </>
  )
}
