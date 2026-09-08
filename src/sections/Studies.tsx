/**
 * Psykologistudiet — optag, bestand, fuldførte og afbrudte fra ministeriets
 * datavarehus, holdt op mod DP's egne tal: hvor stor en del af de studerende
 * og de nyuddannede er medlemmer?
 */
import { ChartCard, SectionHeading, Reveal } from '@/components/primitives'
import { DataTable } from '@/components/charts'
import { Lines, type Series } from '@/components/lines'
import { StackedBars, Legend } from '@/components/stacked'
import { fmtNum, fmtPct, fmtSigned, yearOf, type Dashboard } from '@/lib/data'
import type { Movements } from '@/lib/movements'

const C = { bachelor: '#4fa388', kandidat: '#4e4897' }
const L = { bachelor: 'Bachelor', kandidat: 'Kandidat' }

export function Studies({ data, mov }: { data: Dashboard; mov: Movements | null }) {
  const st = data.meta.studies
  if (!st?.tilgang) return null
  const years = Object.keys(st.tilgang.bachelor).sort()
  type M = 'tilgang' | 'bestand' | 'afbrudte' | 'fuldførte'
  const at = (m: M, lvl: 'bachelor' | 'kandidat', y: string) => (st[m] as Record<string, Record<string, number>> | undefined)?.[lvl]?.[y] ?? null
  const lastY = years[years.length - 1]
  const firstY = years[0]

  const inst = st.byInstitution
  const unis = inst ? Object.keys(inst.tilgang?.bachelor ?? {}).concat(Object.keys(inst.tilgang?.kandidat ?? {})).filter((u, i, arr) => arr.indexOf(u) === i).sort() : []
  const short = (u: string) => u.replace('Københavns Universitet', 'KU').replace('Aarhus Universitet', 'AU').replace('Aalborg Universitet', 'AAU').replace('Syddansk Universitet', 'SDU').replace('Roskilde Universitet', 'RUC')
  const uniColor: Record<string, string> = { 'Københavns Universitet': '#4c7bbd', 'Aarhus Universitet': '#df790d', 'Aalborg Universitet': '#4fa388', 'Syddansk Universitet': '#4e4897', 'Roskilde Universitet': '#aebdd4' }
  const lastFullCohort = String(yearOf(data.meta.latest) - 1)

  const intakeItems = years.map((y) => ({ label: y, parts: { bachelor: at('tilgang', 'bachelor', y) ?? 0, kandidat: at('tilgang', 'kandidat', y) ?? 0 } }))

  const lineFor = (m: M, lvl: 'bachelor' | 'kandidat', dashed = false): Series => ({
    key: `${m}-${lvl}`, label: `${L[lvl]}, ${m}`, shortLabel: L[lvl], color: C[lvl], dashed, endLabel: true,
    points: years.map((y, i) => ({ x: i, y: at(m, lvl, y) })),
  })

  // DP's andel: studerende pr. 31.12 mod bestanden; nye kandidater i DP mod fuldførte kandidater
  const dpStudents = (y: string) => data.snapshots.find((s) => s.date === `${y}-12-31`)?.categories['Studerende DP']?.now ?? null
  const dpNewStudents = (y: string) => mov ? mov.flows.filter((f) => f.month.startsWith(y)).reduce((t, f) => t + (f.indByGroup.stud ?? 0), 0) : null
  const dpGraduates = (y: string) => mov?.cohorts[y]?.n ?? null
  const shareRows = years.filter((y) => Number(y) >= 2022).map((y) => {
    const bestand = (at('bestand', 'bachelor', y) ?? 0) + (at('bestand', 'kandidat', y) ?? 0)
    const students = dpStudents(y)
    const newStud = dpNewStudents(y)
    const intake = at('tilgang', 'bachelor', y)
    const grads = dpGraduates(y)
    const done = at('fuldførte', 'kandidat', y)
    const full = Number(y) < yearOf(data.meta.latest)
    return { y, bestand, students, studentShare: students && bestand ? (students / bestand) * 100 : null, newStud, intake, newShare: newStud && intake && full ? (newStud / intake) * 100 : null, grads, done, gradShare: grads && done && full ? (grads / done) * 100 : null, full }
  })

  return (
    <>
      <SectionHeading
        kicker="Psykologistudiet"
        title={`${fmtNum(at('tilgang', 'bachelor', lastY))} nye bachelorstuderende i ${lastY}`}
        lead={`Optag, bestand, fuldførte og frafald på psykologistudierne ${firstY}–${lastY} fra Uddannelses- og Forskningsministeriets datavarehus — holdt op mod DP's egne tal. Det er det marked, foreningen rekrutterer fra.`}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ChartCard
          title="Optaget, år for år"
          subtitle="Nye studerende på bachelor- og kandidatuddannelsen i psykologi. Kandidatoptaget følger bacheloroptaget tre år før."
          table={<DataTable columns={[{ key: 'y', label: 'År' }, { key: 'b', label: 'Bachelor', align: 'right' }, { key: 'k', label: 'Kandidat', align: 'right' }]}
                            rows={years.map((y) => ({ y, b: fmtNum(at('tilgang', 'bachelor', y)), k: fmtNum(at('tilgang', 'kandidat', y)) }))} />}
        >
          <StackedBars items={intakeItems} keys={['bachelor', 'kandidat']} colors={C} labels={L} height={260} />
          <Legend keys={['bachelor', 'kandidat']} colors={C} labels={L} />
          <p className="mt-2 text-[0.75rem] leading-relaxed text-dp-navy-500">
            Bacheloroptaget er vokset fra {fmtNum(at('tilgang', 'bachelor', firstY))} til {fmtNum(at('tilgang', 'bachelor', lastY))} ({fmtSigned((at('tilgang', 'bachelor', lastY) ?? 0) - (at('tilgang', 'bachelor', firstY) ?? 0))}). Kandidatoptaget ligger stabilt omkring 750 — det er loftet for, hvor mange nye psykologer der kommer om året.
          </p>
        </ChartCard>

        <ChartCard title="Bestand" subtitle="Indskrevne studerende pr. 1. oktober.">
          <Lines series={[lineFor('bestand', 'bachelor'), lineFor('bestand', 'kandidat')]} xLabels={years} height={230} width={420} xTickEvery={2} padRight={78} />
          <p className="mt-2 text-[0.75rem] leading-relaxed text-dp-navy-500">
            {fmtNum((at('bestand', 'bachelor', lastY) ?? 0) + (at('bestand', 'kandidat', lastY) ?? 0))} psykologistuderende i alt i {lastY}. Bacheloren vokser, kandidaten er flad.
          </p>
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <ChartCard title="Fuldførte og afbrudte" subtitle="Hvor mange bliver færdige, og hvor mange falder fra — pr. år.">
          <Lines series={[lineFor('fuldførte', 'bachelor'), lineFor('fuldførte', 'kandidat'), { ...lineFor('afbrudte', 'bachelor', true), label: 'Bachelor, afbrudte', shortLabel: 'Afbr. bach.' }, { ...lineFor('afbrudte', 'kandidat', true), label: 'Kandidat, afbrudte', shortLabel: 'Afbr. kand.' }]}
                 xLabels={years} height={240} width={420} xTickEvery={2} padRight={92} />
          <p className="mt-2 text-[0.75rem] leading-relaxed text-dp-navy-500">
            Omkring 700 nye cand.psych.'er om året. Frafaldet på kandidaten er faldet fra 57 til 20 om året; på bacheloren ligger det stabilt omkring 100.
          </p>
        </ChartCard>

        <ChartCard title="DP's andel af markedet" subtitle="Foreningens studerende og nyuddannede holdt op mod ministeriets tal. Kun hele år kan sammenlignes.">
          <div className="thin-scroll -mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[36rem] border-collapse text-[0.8125rem]">
              <thead><tr className="border-b border-dp-navy-100 text-dp-navy-500">
                <th className="py-2 pr-3 text-left font-semibold">År</th>
                <th className="py-2 pr-3 text-right font-semibold">Studerende<br /><span className="font-normal">DP / bestand</span></th>
                <th className="py-2 pr-3 text-right font-semibold">Nye studentermedlemmer<br /><span className="font-normal">DP / bacheloroptag</span></th>
                <th className="py-2 text-right font-semibold">Nyuddannede i DP<br /><span className="font-normal">cand.psych.-årgang / fuldførte</span></th>
              </tr></thead>
              <tbody>
                {shareRows.map((r) => (
                  <tr key={r.y} className="border-b border-dp-navy-50 last:border-0">
                    <td className="py-2 pr-3 font-semibold text-dp-navy-900">{r.y}{!r.full && <span className="ml-1 text-[0.6875rem] font-normal text-dp-navy-400">(til dato)</span>}</td>
                    <Cell a={r.students} b={r.bestand} share={r.studentShare} />
                    <Cell a={r.newStud} b={r.intake} share={r.newShare} />
                    <Cell a={r.grads} b={r.done} share={r.gradShare} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">
            Studerende-andelen er målt pr. 31.12 mod bestanden pr. 1. oktober. Nyuddannede er medlemmer med cand.psych.-dato i året, der var medlem inden for et halvt år efter. Bemærk at DP også optager studerende fra andre uddannelser, så "nye studentermedlemmer / bacheloroptag" kan overstige 100 %.
          </p>
        </ChartCard>
      </div>

      {inst && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <ChartCard
            title="Optaget pr. universitet"
            subtitle="Nye bachelorstuderende i psykologi pr. universitet. Roskilde havde en kandidatuddannelse frem til 2022."
            table={<DataTable columns={[{ key: 'y', label: 'År' }, ...unis.map((u) => ({ key: u, label: short(u), align: 'right' as const }))]}
                              rows={years.map((y) => ({ y, ...Object.fromEntries(unis.map((u) => [u, fmtNum(inst.tilgang?.bachelor?.[u]?.[y] ?? null)])) }))} />}
          >
            <StackedBars items={years.map((y) => ({ label: y, parts: Object.fromEntries(unis.map((u) => [u, inst.tilgang?.bachelor?.[u]?.[y] ?? 0])) }))}
                         keys={unis} colors={uniColor} labels={Object.fromEntries(unis.map((u) => [u, short(u)]))} height={240} />
            <Legend keys={unis} colors={uniColor} labels={Object.fromEntries(unis.map((u) => [u, short(u)]))} />
          </ChartCard>

          <ChartCard title="DP's andel pr. universitet" subtitle={`Studerende: DP's studentermedlemmer mod bestanden ${lastY}. Nyuddannede: cand.psych.-årgang ${lastFullCohort} i DP mod fuldførte kandidater samme år.`}>
            <div className="thin-scroll -mx-2 overflow-x-auto px-2">
              <table className="w-full min-w-[22rem] border-collapse text-[0.8125rem]">
                <thead><tr className="border-b border-dp-navy-100 text-dp-navy-500">
                  <th className="py-2 pr-3 text-left font-semibold">Universitet</th>
                  <th className="py-2 pr-3 text-right font-semibold">Studerende</th>
                  <th className="py-2 text-right font-semibold">Nyuddannede</th>
                </tr></thead>
                <tbody>
                  {unis.filter((u) => !/Roskilde/.test(u)).map((u) => {
                    const bestand = (inst.bestand?.bachelor?.[u]?.[lastY] ?? 0) + (inst.bestand?.kandidat?.[u]?.[lastY] ?? 0)
                    const dpStud = mov?.students.byUniversityAll?.[u] ? Object.values(mov.students.byUniversityAll[u]).reduce((t, v) => t + v, 0) : null
                    const done = inst.fuldførte?.kandidat?.[u]?.[lastFullCohort] ?? null
                    const dpGrad = mov?.cohorts[lastFullCohort]?.byUniversity?.[u] ?? null
                    return (
                      <tr key={u} className="border-b border-dp-navy-50 last:border-0">
                        <td className="py-2 pr-3 font-semibold" style={{ color: uniColor[u] }}>{short(u)}</td>
                        <Cell a={dpStud} b={bestand} share={dpStud && bestand ? (dpStud / bestand) * 100 : null} />
                        <Cell a={dpGrad} b={done} share={dpGrad && done ? (dpGrad / done) * 100 : null} />
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">
              Andelene svinger med, hvor godt dimittenddatoer og universitet er registreret i DP's system — men forskellene mellem universiteterne er større end støjen.
            </p>
          </ChartCard>
        </div>
      )}

      <div className="mt-5">
        <Reveal className="card p-5 sm:p-6">
          <h3 className="text-[1.0625rem] font-semibold text-dp-navy-900">Det siger tallene</h3>
          <ul className="mt-3 grid gap-2.5 text-[0.875rem] leading-relaxed text-dp-navy-700 md:grid-cols-2">
            {[
              `Der starter ${fmtNum(at('tilgang', 'bachelor', lastY))} på psykologi hvert år, og ${fmtNum(at('fuldførte', 'kandidat', lastY))} bliver færdige. Kandidatoptaget har ligget fast omkring 750 i ti år — det er loftet for tilgangen af nye psykologer, uanset hvor godt foreningen rekrutterer.`,
              shareRows.find((r) => r.gradShare)?.gradShare ? `Omkring ${fmtPct(shareRows.filter((r) => r.gradShare).slice(-1)[0].gradShare, 0)} af en cand.psych.-årgang er medlem inden for et halvt år. De øvrige ${fmtPct(100 - (shareRows.filter((r) => r.gradShare).slice(-1)[0].gradShare ?? 0), 0)} er det største uudnyttede potentiale i kongeindikatoren.` : '',
              shareRows.find((r) => r.studentShare)?.studentShare ? `${fmtPct(shareRows.filter((r) => r.studentShare).slice(-1)[0].studentShare, 0)} af de indskrevne psykologistuderende er medlem af DP. Andelen er højest på SDU og AAU og lavest på KU og AU — de to største universiteter er dér, der er mest at hente.` : '',
              'Frafaldet på studiet (omkring 100 på bacheloren, 20 på kandidaten om året) er langt mindre end DP\'s frafald blandt studentermedlemmer. Det er altså ikke studiestop, der forklarer udmeldelserne — det er dimission uden overgang.',
            ].filter(Boolean).map((s) => (
              <li key={s} className="flex gap-2.5"><span className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-dp-orange" /><span>{s}</span></li>
            ))}
          </ul>
        </Reveal>
      </div>
    </>
  )
}

function Cell({ a, b, share }: { a: number | null; b: number | null; share: number | null }) {
  return (
    <td className="tnum py-2 pr-3 text-right">
      <span className="font-semibold text-dp-navy-900">{share === null ? '–' : fmtPct(share, 0)}</span>
      <span className="ml-1.5 text-[0.6875rem] text-dp-navy-500">{fmtNum(a)} / {fmtNum(b)}</span>
    </td>
  )
}
