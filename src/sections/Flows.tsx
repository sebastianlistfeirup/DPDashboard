/**
 * Ind- og udmeldelser fra medlemslisterne — hver måned siden 2022, og hvem
 * det er: kontingentgruppe, alder, anciennitet og årsag. Plus det tal, der
 * ligger forude: opsigelser med en udmeldelsesdato, der endnu ikke er nået.
 */
import { useMemo, useState } from 'react'
import { ChartCard, SectionHeading, Reveal } from '@/components/primitives'
import { DataTable } from '@/components/charts'
import { DivergingBars } from '@/components/lines'
import { StackedBars, Legend } from '@/components/stacked'
import { fmtNum, fmtPct, fmtSigned, monthYear, cap, type AsOf } from '@/lib/data'
import { GROUP_COLOR, GROUP_ORDER, REASON_COLOR, monthLabel, type Movements } from '@/lib/movements'


export function Flows({ mov, a }: { mov: Movements; a: AsOf }) {
  const asOfMonth = a.date.slice(0, 7)
  const all = mov.flows.filter((f) => f.month <= asOfMonth)
  const last12 = all.slice(-12)
  const years = [...new Set(all.map((f) => f.month.slice(0, 4)))]
  const [view, setView] = useState<'group' | 'age' | 'tenure' | 'reason'>('group')
  const labels = mov.meta.groupLabels
  const yearOf = (y: string) => all.filter((f) => f.month.startsWith(y))

  const in12 = last12.reduce((s, f) => s + f.ind, 0)
  const ud12 = last12.reduce((s, f) => s + f.ud, 0)
  const thisYear = yearOf(asOfMonth.slice(0, 4))
  const ytdIn = thisYear.reduce((s, f) => s + f.ind, 0)
  const ytdUd = thisYear.reduce((s, f) => s + f.ud, 0)
  const lyYtd = yearOf(String(Number(asOfMonth.slice(0, 4)) - 1)).filter((f) => f.month.slice(5) <= asOfMonth.slice(5))
  const lyIn = lyYtd.reduce((s, f) => s + f.ind, 0)
  const lyUd = lyYtd.reduce((s, f) => s + f.ud, 0)

  // Udmeldelser pr. år, fordelt
  const byYear = useMemo(() => years.map((y) => {
    const fs = yearOf(y)
    const merge = (key: 'udByGroup' | 'udByAge' | 'udByTenure' | 'udByReason') => {
      const o: Record<string, number> = {}
      for (const f of fs) for (const [k, v] of Object.entries(f[key])) o[k] = (o[k] ?? 0) + v
      return o
    }
    return { year: y, months: fs.length, ud: fs.reduce((s, f) => s + f.ud, 0), ind: fs.reduce((s, f) => s + f.ind, 0), group: merge('udByGroup'), age: merge('udByAge'), tenure: merge('udByTenure'), reason: merge('udByReason') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [all])

  const reasonKeys = useMemo(() => {
    const tot: Record<string, number> = {}
    for (const y of byYear) for (const [k, v] of Object.entries(y.reason)) tot[k] = (tot[k] ?? 0) + v
    return Object.entries(tot).sort((x, z) => z[1] - x[1]).map(([k]) => k)
  }, [byYear])
  const reasonLabels = Object.fromEntries(reasonKeys.map((k) => [k, k]))
  const ageKeys = mov.meta.ageBands
  const ageLabels = Object.fromEntries(ageKeys.map((k) => [k, k]))
  const ageColors = Object.fromEntries(ageKeys.map((k, i) => [k, ['#c4dcdb', '#8ebec0', '#4fa388', '#179fa0', '#4c7bbd', '#3a557d', '#4e4897', '#7e78bf', '#8299bb', '#aebdd4', '#d4dbe1', '#e2e6ea'][i] ?? '#e2e6ea']))
  const tenureKeys = mov.meta.tenureBands
  const tenureLabels = Object.fromEntries(tenureKeys.map((k) => [k, k]))
  const tenureColors = Object.fromEntries(tenureKeys.map((k, i) => [k, ['#d24e46', '#df790d', '#d8a90c', '#4fa388', '#4c7bbd', '#4e4897', '#aebdd4', '#e2e6ea'][i] ?? '#e2e6ea']))

  const cfg = {
    group: { keys: GROUP_ORDER, colors: GROUP_COLOR, labels, pick: (y: typeof byYear[number]) => y.group, title: 'Hvem melder sig ud? Efter kontingentgruppe', note: 'Studerende er den største gruppe i tal — men også den største bestand. Se udmeldelsesraten nedenfor.' },
    age: { keys: ageKeys, colors: ageColors, labels: ageLabels, pick: (y: typeof byYear[number]) => y.age, title: 'Efter alder', note: 'Alder ved udmeldelsen.' },
    tenure: { keys: tenureKeys, colors: tenureColors, labels: tenureLabels, pick: (y: typeof byYear[number]) => y.tenure, title: 'Efter anciennitet', note: 'Tid fra DP-indmeldelse til udmeldelse. For medlemmer fra før systemskiftet i december 2022 kendes ancienniteten ikke altid.' },
    reason: { keys: reasonKeys, colors: REASON_COLOR, labels: reasonLabels, pick: (y: typeof byYear[number]) => y.reason, title: 'Efter årsag', note: '"Anden årsag" og "Ukendt" er tilsammen omkring hver tredje. Der ligger et frit tekstfelt bag "anden årsag", som kan kodes.' },
  }[view]

  const rate = mov.churnRate

  return (
    <>
      <SectionHeading
        kicker="Ind- og udmeldelser"
        title={`${fmtNum(in12)} ind og ${fmtNum(ud12)} ud på tolv måneder`}
        lead={`Fra medlemslisterne, med DP-ind- og udmeldelsesdato som facit. Udmeldelsen tælles i den måned, den træder i kraft; medlemmet forsvinder fra listen måneden efter. Pr. ${cap(monthYear(a.date))}.`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={`Indmeldelser i ${asOfMonth.slice(0, 4)}`} value={fmtNum(ytdIn)} sub={lyIn ? `${fmtSigned(ytdIn - lyIn)} mod samme periode sidste år` : undefined} tone={ytdIn - lyIn} />
        <Kpi label={`Udmeldelser i ${asOfMonth.slice(0, 4)}`} value={fmtNum(ytdUd)} sub={lyUd ? `${fmtSigned(ytdUd - lyUd)} mod samme periode sidste år` : undefined} tone={-(ytdUd - lyUd)} />
        <Kpi label="Netto, seneste 12 måneder" value={fmtSigned(in12 - ud12)} tone={in12 - ud12} />
        <Kpi label="Opsagt, endnu ikke udmeldt" value={fmtNum(mov.pending.total)} sub="medlemmer med en udmeldelsesdato ude i fremtiden" tone={-1} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard
          title="Ind og ud, måned for måned"
          subtitle="Grøn op er indmeldelser, rød ned er udmeldelser. Fra januar 2023 — systemskiftet i december 2022 gør 2022 mindre pålideligt."
          legend={[{ label: 'Indmeldelser', color: '#179fa0' }, { label: 'Udmeldelser', color: '#d24e46' }]}
          table={<DataTable columns={[{ key: 'm', label: 'Måned' }, { key: 'i', label: 'Ind', align: 'right' }, { key: 'u', label: 'Ud', align: 'right' }, { key: 'n', label: 'Netto', align: 'right' }]}
                            rows={[...all].reverse().map((f) => ({ m: monthLabel(f.month), i: fmtNum(f.ind), u: fmtNum(f.ud), n: fmtSigned(f.net) }))} />}
        >
          <StackedBars
            items={all.filter((f) => f.month >= '2023-01').map((f) => ({ label: monthLabel(f.month), parts: { ind: f.ind, ud: f.ud } }))}
            keys={['ind', 'ud']} negativeKeys={['ud']} colors={{ ind: '#179fa0', ud: '#d24e46' }} labels={{ ind: 'Indmeldelser', ud: 'Udmeldelser' }}
            height={280} showTotals={false}
          />
          <p className="mt-2 text-[0.75rem] text-dp-navy-500">
            Årets rytme: studieoptaget i august–oktober giver flest indmeldelser; december og januar flest udmeldelser, når årsskiftets opsigelser og restancelukninger træder i kraft.
          </p>
        </ChartCard>

        <ChartCard title="Netto pr. år" subtitle="Indmeldelser minus udmeldelser. Indeværende år er til dato.">
          <DivergingBars items={byYear.filter((y) => y.year >= '2023').map((y) => ({ label: y.months < 12 ? `${y.year} (${y.months} mdr.)` : y.year, value: y.ind - y.ud }))}
                         height={200} width={420} positiveColor="#4c7bbd" valueFormat={fmtSigned} />
          <dl className="mt-3 space-y-1.5 text-[0.8125rem]">
            {byYear.filter((y) => y.year >= '2023').map((y) => (
              <div key={y.year} className="flex justify-between text-dp-navy-700">
                <dt>{y.year}</dt>
                <dd className="tnum"><span style={{ color: '#179fa0' }}>{fmtNum(y.ind)} ind</span> · <span style={{ color: '#d24e46' }}>{fmtNum(y.ud)} ud</span></dd>
              </div>
            ))}
          </dl>
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard
          title={cfg.title}
          subtitle={cfg.note}
          actions={
            <div className="flex flex-wrap gap-1.5">
              {([['group', 'Gruppe'], ['age', 'Alder'], ['tenure', 'Anciennitet'], ['reason', 'Årsag']] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}
                        className={`rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold transition ${view === k ? 'border-dp-navy-600 bg-dp-navy-600 text-white' : 'border-dp-navy-100 text-dp-navy-600 hover:border-dp-navy-300'}`}>{l}</button>
              ))}
            </div>
          }
          table={<DataTable columns={[{ key: 'k', label: 'Gruppe' }, ...byYear.map((y) => ({ key: y.year, label: y.year, align: 'right' as const }))]}
                            rows={cfg.keys.map((k) => ({ k: cfg.labels[k] ?? k, ...Object.fromEntries(byYear.map((y) => [y.year, fmtNum(cfg.pick(y)[k] ?? 0)])) }))} />}
        >
          <StackedBars items={byYear.map((y) => ({ label: y.months < 12 ? `${y.year}*` : y.year, parts: cfg.pick(y) }))}
                       keys={cfg.keys} colors={cfg.colors} labels={cfg.labels} height={260} width={520} />
          <Legend keys={cfg.keys.filter((k) => byYear.some((y) => cfg.pick(y)[k]))} colors={cfg.colors} labels={cfg.labels} />
          {byYear.some((y) => y.months < 12) && <p className="mt-2 text-[0.6875rem] text-dp-navy-400">* ikke et helt år</p>}
        </ChartCard>

        <ChartCard title="Udmeldelsesrate pr. gruppe" subtitle="Udmeldelser de seneste 12 måneder i procent af gruppens gennemsnitlige størrelse. Det er det tal, der er sammenligneligt på tværs.">
          <ul className="space-y-3">
            {GROUP_ORDER.filter((g) => rate[g]?.pct !== null && rate[g]?.pct !== undefined).sort((x, y) => (rate[y].pct ?? 0) - (rate[x].pct ?? 0)).map((g) => (
              <li key={g}>
                <div className="mb-1 flex items-baseline justify-between text-[0.8125rem]">
                  <span className="flex items-center gap-2 text-dp-navy-800"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: GROUP_COLOR[g] }} />{labels[g]}</span>
                  <span className="tnum font-semibold text-dp-navy-900">{fmtPct(rate[g].pct)} <span className="text-[0.6875rem] font-normal text-dp-navy-500">({fmtNum(rate[g].ud12)} af {fmtNum(rate[g].avgStock)})</span></span>
                </div>
                <div className="h-2 rounded-full bg-dp-navy-100"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (rate[g].pct ?? 0) / 20 * 100)}%`, background: GROUP_COLOR[g] }} /></div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">
            De fuldtidsbetalende mister vi sjældent: godt 2 % om året blandt normalansatte. Studerende er den utætte ende — knap hver femte forlader foreningen inden for et år, typisk ved studiestop eller når de glemmes ved dimission.
          </p>
        </ChartCard>
      </div>

      <div className="mt-5">
        <Reveal className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <h3 className="text-[1.0625rem] font-semibold text-dp-navy-900">Opsagt, men endnu ikke ude: {fmtNum(mov.pending.total)}</h3>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-dp-navy-600">
                Medlemmer på den seneste liste ({monthLabel(mov.meta.last)}), der har en udmeldelsesdato, som endnu ikke er nået. Det er de udmeldelser, der kommer i de næste måneder uanset hvad — og den gruppe, en fastholdelsesindsats skal ringe til nu.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(mov.pending.byGroup).sort((x, y) => y[1] - x[1]).map(([g, n]) => (
                <span key={g} className="tnum inline-flex items-center gap-1.5 rounded-full border border-dp-navy-100 px-2.5 py-1 text-[0.75rem] font-semibold text-dp-navy-800">
                  <span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLOR[g] }} />{labels[g]} {fmtNum(n)}
                </span>
              ))}
            </div>
          </div>
          {mov.pending.byMonth.length > 0 && (
            <div className="mt-4 max-w-md">
              <DivergingBars items={mov.pending.byMonth.slice(0, 8).map((p) => ({ label: monthLabel(p.month), value: p.n }))} height={160} width={420} positiveColor="#d24e46" />
            </div>
          )}
        </Reveal>
      </div>
    </>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: number }) {
  return (
    <div className="card p-4">
      <div className="text-[0.75rem] font-semibold text-dp-navy-500">{label}</div>
      <div className="tnum mt-1 font-serif text-[1.75rem] font-semibold leading-none" style={{ color: tone > 0 ? '#179fa0' : tone < 0 ? '#d24e46' : '#16233a' }}>{value}</div>
      {sub && <div className="mt-1.5 text-[0.6875rem] leading-snug text-dp-navy-500">{sub}</div>}
    </div>
  )
}
