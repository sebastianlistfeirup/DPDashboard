/**
 * Kontingentet i kroner. Hver kategori har sin sats, så medlemstal og
 * bevægelser kan oversættes: hvad er kongeindikatoren værd, hvad koster en
 * udmeldelse, og hvad er 15.000 medlemmer værd om året.
 */
import { ChartCard, SectionHeading, Reveal } from '@/components/primitives'
import { DataTable } from '@/components/charts'
import { DivergingBars } from '@/components/lines'
import { GROUP_COLORS, catLabel, ddmmyy, fmtNum, fmtPctSigned, fmtSigned, pctChange, type AsOf, type Dashboard, type GoalPath } from '@/lib/data'

const kr = (n: number | null | undefined) => (n === null || n === undefined ? '–' : `${fmtNum(n)} kr.`)
const mio = (n: number) => `${(n / 1_000_000).toLocaleString('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mio. kr.`

export function Economy({ data, a, goal }: { data: Dashboard; a: AsOf; goal: GoalPath }) {
  const rates = data.meta.rates ?? {}
  const rate = (k: string) => rates[k]?.monthly ?? null
  const yearly = (k: string, n: number | null | undefined) => (rate(k) === null || n === null || n === undefined ? null : rate(k)! * 12 * n)

  const rows = a.categories.map((c) => ({ ...c, rate: rate(c.key), now: c.now, kr: yearly(c.key, c.now), krLy: yearly(c.key, c.ly), krBase: yearly(c.key, c.base) }))
  const known = rows.filter((r) => r.kr !== null)
  const unknown = rows.filter((r) => r.kr === null && r.now > 0)
  const total = known.reduce((s, r) => s + (r.kr ?? 0), 0)
  const totalLy = known.every((r) => r.krLy !== null) ? known.reduce((s, r) => s + (r.krLy ?? 0), 0) : null
  const totalBase = known.every((r) => r.krBase !== null) ? known.reduce((s, r) => s + (r.krBase ?? 0), 0) : null
  const membersKnown = known.reduce((s, r) => s + r.now, 0)
  const avgPerMember = membersKnown ? total / membersKnown : 0

  // Kongeindikatoren i kroner: væksten i fuldtidsbetalende × fuld sats
  const full = rate('Normaltansat over 19 timer') ?? 0
  const kongeKr = (a.konge ?? 0) * full * 12
  const kand = rate('1 og 2 års Kandidater') ?? 0
  const stud = rate('Studerende DP') ?? 0
  const ledig = rate('Ledig DP') ?? 0

  // Værdien af årets bevægelser pr. kategori (siden 31.12)
  const moves = rows.filter((r) => r.kr !== null && r.krBase !== null).map((r) => ({ label: r.label, value: (r.kr ?? 0) - (r.krBase ?? 0) })).filter((m) => Math.abs(m.value) >= 50_000).sort((x, y) => y.value - x.value)

  // Målet i kroner ved nuværende mix
  const goalKr = goal.target * avgPerMember
  const gapKr = (goal.target - a.total) * avgPerMember

  return (
    <>
      <SectionHeading
        kicker="Økonomi"
        title={`${mio(total)} i kontingent om året`}
        lead={`Medlemstallet pr. ${ddmmyy(a.date)} ganget med kontingentsatserne. Et regnestykke, ikke et regnskab: rabatter, restancer og periodisering er ikke med.`}
        onDark
        color="#f2d57a"
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ChartCard
          title="Kontingent pr. kategori, årligt"
          subtitle="Antal medlemmer × sats × 12. Kategorier uden kendt sats står nederst og er ikke med i totalen."
          table={<DataTable columns={[{ key: 'k', label: 'Kategori' }, { key: 's', label: 'Sats/md.', align: 'right' }, { key: 'n', label: 'Medlemmer', align: 'right' }, { key: 'kr', label: 'Kr./år', align: 'right' }]}
                            rows={rows.map((r) => ({ k: r.label, s: kr(r.rate), n: fmtNum(r.now), kr: kr(r.kr) }))} />}
        >
          <ul className="space-y-2.5">
            {known.filter((r) => (r.kr ?? 0) > 0).sort((x, y) => (y.kr ?? 0) - (x.kr ?? 0)).map((r) => (
              <li key={r.key}>
                <div className="mb-0.5 flex items-baseline justify-between gap-3 text-[0.8125rem]">
                  <span className="flex items-center gap-2 text-dp-navy-800"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: GROUP_COLORS[r.group] }} />{r.label} <span className="text-[0.6875rem] text-dp-navy-400">{fmtNum(r.now)} × {kr(r.rate)}</span></span>
                  <span className="tnum font-semibold text-dp-navy-900">{mio(r.kr ?? 0)} <span className="text-[0.6875rem] font-normal text-dp-navy-500">{r.krLy !== null ? fmtPctSigned(pctChange(r.kr, r.krLy)) : ''}</span></span>
                </div>
                <div className="h-1.5 rounded-full bg-dp-navy-100"><div className="h-full rounded-full" style={{ width: `${((r.kr ?? 0) / (known[0]?.kr ?? 1)) * 100}%`, background: GROUP_COLORS[r.group] }} /></div>
              </li>
            ))}
          </ul>
          {unknown.length > 0 && (
            <p className="mt-3 text-[0.75rem] text-dp-navy-500">
              Uden kendt sats: {unknown.map((r) => `${catLabel(r.key)} (${fmtNum(r.now)})`).join(', ')}. Skriv satserne i <code className="rounded bg-dp-navy-50 px-1">data/kontingent.csv</code>, så kommer de med.
            </p>
          )}
        </ChartCard>

        <div className="grid gap-5">
          <Reveal className="card p-5 sm:p-6">
            <div className="text-[0.8125rem] font-semibold text-dp-navy-500">Kongeindikatoren i kroner</div>
            <div className="tnum mt-1 font-serif text-[2rem] font-semibold leading-none text-dp-navy-900">{fmtSigned(kongeKr / 1000)} t.kr.</div>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-dp-navy-600">
              {fmtSigned(a.konge)} fuldtidsbetalende siden {ddmmyy(a.snapshot.baseDate)} × {kr(full)} × 12. Det er den årlige indtægt, årets vækst i fuldtidsbetalende svarer til.
            </p>
            <dl className="mt-4 space-y-2 border-t border-dp-navy-100 pt-3 text-[0.8125rem]">
              {[
                ['Ét kontingentskift (kandidat → fuld sats)', (full - kand) * 12],
                ['Én studerende, der bliver kandidat', (kand - stud) * 12],
                ['Én ledig, der får job', (full - ledig) * 12],
                ['Én fuldtidsbetalende, der melder sig ud', -full * 12],
                ['Én studerende, der melder sig ud', -stud * 12],
              ].map(([l, v]) => (
                <div key={String(l)} className="flex justify-between gap-3"><dt className="text-dp-navy-600">{l}</dt><dd className="tnum font-semibold" style={{ color: (v as number) >= 0 ? '#179fa0' : '#d24e46' }}>{fmtSigned(v as number)} kr./år</dd></div>
              ))}
            </dl>
          </Reveal>

          <Reveal className="card p-5 sm:p-6" delay={0.05}>
            <div className="text-[0.8125rem] font-semibold text-dp-navy-500">Målet i kroner</div>
            <div className="tnum mt-1 font-serif text-[2rem] font-semibold leading-none text-dp-navy-900">{mio(goalKr)}</div>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-dp-navy-600">
              {fmtNum(goal.target)} medlemmer med samme fordeling som i dag ({kr(Math.round(avgPerMember))} pr. medlem i gennemsnit om året). De {fmtNum(goal.target - a.total)}, der mangler, er {mio(gapKr)} om året — eller {mio((goal.target - a.total) * full * 12)}, hvis de alle var fuldtidsbetalende.
            </p>
          </Reveal>
        </div>
      </div>

      {moves.length > 0 && (
        <div className="mt-5">
          <ChartCard title={`Årets bevægelser i kroner, siden ${ddmmyy(a.snapshot.baseDate)}`} subtitle="Ændringen i hver kategoris kontingent på årsbasis. Positivt er flere kroner, negativt færre. Kategorier under 50.000 kr. er udeladt.">
            <DivergingBars items={moves.map((m) => ({ label: m.label.length > 22 ? m.label.slice(0, 20) + '…' : m.label, value: Math.round(m.value / 1000) }))} height={230} positiveColor="#179fa0" negativeColor="#d24e46" valueFormat={(n) => `${fmtSigned(n)} t.kr.`} />
            <p className="mt-2 text-[0.75rem] text-dp-navy-500">
              I alt {fmtSigned(Math.round(((totalBase !== null ? total - totalBase : 0)) / 1000))} t.kr. på årsbasis siden årsskiftet{totalLy !== null ? `, og ${fmtSigned(Math.round((total - totalLy) / 1000))} t.kr. mod samme måned sidste år` : ''}.
            </p>
          </ChartCard>
        </div>
      )}
    </>
  )
}
