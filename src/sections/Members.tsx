/**
 * Medlemmerne — hvem de er på den seneste liste: alder, køn, geografi,
 * arbejdsplads, universitet. Og pensionsafgangen frem mod 2035.
 */
import { ChartCard, SectionHeading } from '@/components/primitives'
import { DataTable } from '@/components/charts'
import { DivergingBars } from '@/components/lines'
import { StackedBars, Legend } from '@/components/stacked'
import { fmtNum, fmtPct, fmtPctSigned, fmtSigned, pctChange } from '@/lib/data'
import { GROUP_COLOR, GROUP_ORDER, monthLabel, type Movements } from '@/lib/movements'

export function Members({ mov }: { mov: Movements }) {
  const labels = mov.meta.groupLabels
  const ageKeys = mov.meta.ageBands.filter((b) => b !== 'ukendt')
  const m = mov.members
  const ageItems = ageKeys.map((b) => ({ label: b, parts: Object.fromEntries(GROUP_ORDER.map((g) => [g, m.ageByGroup[g]?.[b] ?? 0])) }))
  const totalMembers = Object.values(m.ageByGroup).reduce((s, o) => s + Object.values(o).reduce((t, v) => t + v, 0), 0)

  const sexAll: Record<string, number> = {}
  for (const o of Object.values(m.sexByGroup)) for (const [k, v] of Object.entries(o)) sexAll[k] = (sexAll[k] ?? 0) + v
  const women = sexAll['Kvinde'] ?? 0
  const sexTotal = Object.values(sexAll).reduce((s, v) => s + v, 0) || 1

  const pensionYears = Object.entries(m.pensionByYear).filter(([k]) => /^\d{4}$/.test(k))
  const pensionTo2029 = pensionYears.filter(([y]) => Number(y) <= 2029).reduce((s, [, n]) => s + n, 0)

  const kreds = m.kreds.filter((k) => k.n >= 10)
  const sektor = Object.entries(m.sektor).filter(([k]) => k !== 'Ikke oplyst').slice(0, 10)
  const sektorTotal = Object.values(m.sektor).reduce((s, v) => s + v, 0) || 1
  const uni = Object.entries(m.university).slice(0, 8)
  const uniTotal = Object.values(m.university).reduce((s, v) => s + v, 0) || 1

  return (
    <>
      <SectionHeading
        kicker="Medlemmerne"
        title={`${fmtNum(totalMembers)} medlemmer — hvem er de?`}
        lead={`Fra medlemslisten pr. ${monthLabel(mov.meta.last)}. Alder, køn, geografi og arbejdsplads — og den afgang til pension, som ligger fast i fødselsårene.`}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard title="Alder og kontingentgruppe" subtitle="Hver søjle er en aldersgruppe, farvet efter kontingentgruppe."
                   table={<DataTable columns={[{ key: 'b', label: 'Alder' }, ...GROUP_ORDER.map((g) => ({ key: g, label: labels[g], align: 'right' as const }))]}
                                     rows={ageItems.map((it) => ({ b: it.label, ...Object.fromEntries(GROUP_ORDER.map((g) => [g, fmtNum(it.parts[g])])) }))} />}>
          <StackedBars items={ageItems} keys={GROUP_ORDER} colors={GROUP_COLOR} labels={labels} height={260} />
          <Legend keys={GROUP_ORDER} colors={GROUP_COLOR} labels={labels} />
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.75rem] text-dp-navy-600">
            {GROUP_ORDER.filter((g) => m.avgAge[g]).map((g) => (
              <span key={g}><span className="mr-1 inline-block h-2 w-2 rounded-[2px] align-middle" style={{ background: GROUP_COLOR[g] }} />{labels[g]}: <strong className="tnum text-dp-navy-900">{m.avgAge[g]} år</strong></span>
            ))}
          </div>
        </ChartCard>

        <div className="grid gap-5">
          <ChartCard title="Køn" subtitle="Hele medlemsskaren.">
            <div className="tnum font-serif text-[2.25rem] font-semibold leading-none text-dp-navy-900">{fmtPct((women / sexTotal) * 100, 0)} <span className="text-[1rem] font-normal text-dp-navy-500">kvinder</span></div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full">
              <div style={{ width: `${(women / sexTotal) * 100}%`, background: '#4e4897' }} />
              <div style={{ width: `${((sexAll['Mand'] ?? 0) / sexTotal) * 100}%`, background: '#4c7bbd' }} />
              <div className="flex-1" style={{ background: '#aebdd4' }} />
            </div>
            <dl className="mt-2 flex flex-wrap gap-x-4 text-[0.75rem] text-dp-navy-600">
              {Object.entries(sexAll).sort((x, y) => y[1] - x[1]).map(([k, v]) => <div key={k}><dt className="inline">{k}: </dt><dd className="tnum inline font-semibold text-dp-navy-900">{fmtNum(v)}</dd></div>)}
            </dl>
          </ChartCard>
          <ChartCard title={`Pensionsafgang: ${fmtNum(pensionTo2029)} frem til 2029`} subtitle="Normalansatte og selvstændige, der fylder 67 det pågældende år. De bliver typisk pensionistmedlemmer — og tæller ud af kongeindikatoren.">
            <DivergingBars items={pensionYears.map(([y, n]) => ({ label: y, value: n }))} height={170} width={420} positiveColor="#8299bb" />
            {m.pensionByYear['allerede over 67'] && (
              <p className="mt-2 text-[0.75rem] text-dp-navy-500">Derudover er {fmtNum(m.pensionByYear['allerede over 67'])} fuldtidsbetalende allerede over 67 og arbejder stadig.</p>
            )}
          </ChartCard>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ChartCard title="Kredse" subtitle="Medlemmer pr. kreds nu og for et år siden, og ind-/udmeldelser de seneste 12 måneder. Studerende har ingen kreds.">
          <div className="thin-scroll -mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[34rem] border-collapse text-[0.8125rem]">
              <thead><tr className="border-b border-dp-navy-100 text-dp-navy-500">
                <th className="py-2 pr-3 text-left font-semibold">Kreds</th><th className="py-2 pr-3 text-right font-semibold">Medlemmer</th><th className="py-2 pr-3 text-right font-semibold">År</th><th className="py-2 pr-3 text-right font-semibold">Ind 12 mdr.</th><th className="py-2 pr-3 text-right font-semibold">Ud 12 mdr.</th><th className="py-2 text-right font-semibold">Udm.-rate</th>
              </tr></thead>
              <tbody>
                {kreds.map((k) => {
                  const d = k.n - k.ly
                  return (
                    <tr key={k.kreds} className="border-b border-dp-navy-50 last:border-0">
                      <td className="py-1.5 pr-3 text-dp-navy-900">{k.kreds}</td>
                      <td className="tnum py-1.5 pr-3 text-right font-semibold text-dp-navy-900">{fmtNum(k.n)}</td>
                      <td className="tnum whitespace-nowrap py-1.5 pr-3 text-right" style={{ color: d > 0 ? '#179fa0' : d < 0 ? '#d24e46' : '#7a8798' }}>{fmtSigned(d)} <span className="text-[0.6875rem] opacity-70">{fmtPctSigned(pctChange(k.n, k.ly))}</span></td>
                      <td className="tnum py-1.5 pr-3 text-right text-dp-navy-700">{fmtNum(k.ind12)}</td>
                      <td className="tnum py-1.5 pr-3 text-right text-dp-navy-700">{fmtNum(k.ud12)}</td>
                      <td className="tnum py-1.5 text-right text-dp-navy-700">{fmtPct((k.ud12 / ((k.n + k.ly) / 2 || 1)) * 100, 1)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <div className="grid gap-5">
          <ChartCard title="Hvor arbejder de?" subtitle="Sektor for normalansatte, selvstændige, ph.d. og kandidater med registreret arbejdsplads.">
            <ul className="space-y-2">
              {sektor.map(([k, v]) => (
                <li key={k}>
                  <div className="mb-0.5 flex justify-between text-[0.8125rem]"><span className="text-dp-navy-800">{k}</span><span className="tnum font-semibold text-dp-navy-900">{fmtNum(v)} <span className="text-[0.6875rem] font-normal text-dp-navy-500">{fmtPct((v / sektorTotal) * 100, 0)}</span></span></div>
                  <div className="h-1.5 rounded-full bg-dp-navy-100"><div className="h-full rounded-full bg-dp-navy-600" style={{ width: `${(v / (sektor[0]?.[1] ?? 1)) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
            {m.sektor['Ikke oplyst'] && <p className="mt-2 text-[0.6875rem] text-dp-navy-400">{fmtNum(m.sektor['Ikke oplyst'])} uden registreret arbejdsplads.</p>}
          </ChartCard>
          <ChartCard title="Hvor er de uddannet?" subtitle="Cand.psych.-universitet for alle med registreret dato.">
            <ul className="space-y-1.5 text-[0.8125rem]">
              {uni.map(([k, v]) => (
                <li key={k} className="flex justify-between"><span className="text-dp-navy-800">{k}</span><span className="tnum font-semibold text-dp-navy-900">{fmtNum(v)} <span className="text-[0.6875rem] font-normal text-dp-navy-500">{fmtPct((v / uniTotal) * 100, 0)}</span></span></li>
              ))}
            </ul>
          </ChartCard>
        </div>
      </div>
    </>
  )
}
