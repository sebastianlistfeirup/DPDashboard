/**
 * Organisationsgrad — hvor stor en del af Danmarks psykologer er medlem?
 * DP's egne organisationsgrader 2012–2024, Sundhedsdatastyrelsens
 * arbejdsstyrketal og DST's beskæftigelsestal, holdt op mod medlemslisten.
 */
import { ChartCard, SectionHeading, Reveal } from '@/components/primitives'
import { DataTable } from '@/components/charts'
import { Lines, type Series } from '@/components/lines'
import { StackedBars, Legend } from '@/components/stacked'
import { GROUP_COLOR, REASON_COLOR } from '@/lib/movements'
import { fmtNum, fmtPct, fmtPctSigned, type Dashboard } from '@/lib/data'
import type { Movements } from '@/lib/movements'

export function Market({ data, mov }: { data: Dashboard; mov: Movements | null }) {
  const mk = data.meta.market
  if (!mk?.orgRate) return null
  const years = Object.keys(mk.orgRate).sort()
  const last = years[years.length - 1]
  const first = years[0]
  const r = (y: string) => mk.orgRate![y]

  const series: Series[] = [
    { key: 'faerdig', label: 'Færdiguddannede', color: '#3a557d', width: 2.5, endLabel: true, points: years.map((y, i) => ({ x: i, y: r(y).faerdig })) },
    { key: 'besk', label: 'Beskæftigede', color: '#4c7bbd', endLabel: true, points: years.map((y, i) => ({ x: i, y: r(y).beskaeftigede })) },
    { key: 'stud', label: 'Studerende (danske)', shortLabel: 'Stud. dk', color: '#4fa388', endLabel: true, points: years.map((y, i) => ({ x: i, y: r(y).studerendeDk })) },
    { key: 'studAlle', label: 'Studerende (alle)', shortLabel: 'Stud. alle', color: '#8ebec0', dashed: true, endLabel: true, points: years.map((y, i) => ({ x: i, y: r(y).studerendeAlle })) },
  ]

  // Aldersfordeling: DST's bestand af psykologuddannede (alle, også uden for
  // arbejdsstyrken) mod DP's medlemmer uden studerende, i samme aldersbånd.
  const emp = mk.employment
  const dstAge = (keys: string[]) => emp ? keys.reduce((t, k) => t + Object.entries(emp.byAgeLatest[k] ?? {}).filter(([st]) => st !== 'Diskretioneret').reduce((u, [, v]) => u + v, 0), 0) : null
  const dpAgeDist = mov?.members.ageNonStudentByYear?.[emp?.latest ?? ''] ?? null
  const dpAge = (bands: string[]) => dpAgeDist ? bands.reduce((u, b) => u + (dpAgeDist[b] ?? 0), 0) : null
  const ageRows: { label: string; dp: number | null; sds: number | null; share: number | null }[] = ([
    ['under 30', ['–24', '25–29'], ['<30 år']],
    ['30–34', ['30–34'], ['30-34 år']], ['35–39', ['35–39'], ['35-39 år']], ['40–44', ['40–44'], ['40-44 år']],
    ['45–49', ['45–49'], ['45-49 år']], ['50–54', ['50–54'], ['50-54 år']], ['55–59', ['55–59'], ['55-59 år']],
    ['60–64', ['60–64'], ['60-64 år']], ['65+', ['65–69', '70+'], ['65-66 år', '67 år og derover']],
  ] as [string, string[], string[]][]).map(([label, dpB, dstB]) => {
    const dp = dpAge(dpB), sds = dstAge(dstB)
    return { label, dp, sds, share: dp !== null && sds ? (dp / sds) * 100 : null }
  })
  const wf = mk.workforce

  // Sektor: SDS 2023 mod DP's arbejdende medlemmer
  const sdsSek = wf?.sektor?.['2023'] ?? {}
  const dpSek = mov?.members.sektor ?? {}
  const dpSum = (pred: (k: string) => boolean) => Object.entries(dpSek).filter(([k]) => pred(k)).reduce((t, [, v]) => t + v, 0)
  const sekRows = [
    { label: 'Kommuner', dp: dpSum((k) => k === 'Kommuner'), sds: sdsSek['Kommuner'] ?? null },
    { label: 'Regioner', dp: dpSum((k) => k.startsWith('Region')), sds: sdsSek['Regioner/Amter'] ?? null },
    { label: 'Stat', dp: dpSum((k) => k === 'Staten'), sds: sdsSek['Stat'] ?? null },
    { label: 'Privat (inkl. selvstændige)', dp: dpSum((k) => /Privat|Selvstændig/.test(k)), sds: (sdsSek['Private sektor'] ?? 0) + (sdsSek['Non-profit organisationer'] ?? 0) },
  ].map((x) => ({ ...x, share: x.dp && x.sds ? (x.dp / x.sds) * 100 : null }))

  // Region: SDS arbejdsstedsregion 2023 mod DP's arbejdsplads-region
  const dpReg = mov?.members.regionWork ?? {}
  const regRows = Object.entries(wf?.region ?? {}).map(([k, v]) => {
    const short = k.replace('Region ', '')
    const dp = dpReg[short] ?? null
    return { label: short, dp, sds: v['2023'] ?? null, share: dp && v['2023'] ? (dp / v['2023']) * 100 : null }
  })

  // DST: bestanden af psykologuddannede pr. år og status
  const empYears = emp ? Object.keys(emp.byYear).sort() : []
  const empKeys = ['Lønmodtagere', 'Selvstændige', 'Arbejdsløse', 'Uden for arbejdsstyrken']
  const empColors: Record<string, string> = { 'Lønmodtagere': '#4c7bbd', 'Selvstændige': '#df790d', 'Arbejdsløse': '#d24e46', 'Uden for arbejdsstyrken': '#aebdd4' }
  const empTotal = (y: string) => Object.values(emp?.byYear[y] ?? {}).reduce((t, v) => t + v, 0)
  const empLast = empYears[empYears.length - 1]
  const unemp = (y: string) => { const o = emp?.byYear[y] ?? {}; const lab = (o['Lønmodtagere'] ?? 0) + (o['Selvstændige'] ?? 0) + (o['Arbejdsløse'] ?? 0); return lab ? ((o['Arbejdsløse'] ?? 0) / lab) * 100 : null }

  const trend = (r(last).faerdig ?? 0) - (r(first).faerdig ?? 0)

  // De 30–44-årige
  const mid = mov?.middle
  const l30 = mid?.loss['30–44'] ?? {}
  const loss30 = { total: Object.values(l30.group ?? {}).reduce((t, v) => t + v, 0), group: l30.group ?? {}, sinceCand: l30.sinceCand ?? {}, reason: l30.reason ?? {} }
  const rw = mid?.reentry.returnedWithin24 ?? []
  const returnRate = rw.length ? (rw.reduce((t, x) => t + x.returned, 0) / Math.max(1, rw.reduce((t, x) => t + x.left, 0))) * 100 : null
  const org3044 = Object.entries(emp?.byAgeYear ?? {}).filter(([y]) => mid?.dp30to44ByYear[y]).map(([y, ages]) => {
    const pop = (ages['30-34 år'] ?? 0) + (ages['35-39 år'] ?? 0) + (ages['40-44 år'] ?? 0)
    const dp = mid!.dp30to44ByYear[y]
    return { year: y, dp, pop, share: pop ? (dp / pop) * 100 : null }
  }).sort((a, b) => a.year.localeCompare(b.year))

  return (
    <>
      <SectionHeading
        kicker="Organisationsgrad"
        title={`${fmtPct(r(last).faerdig, 1)} af de færdiguddannede psykologer er medlem`}
        lead={`Organisationsgraden for færdiguddannede er faldet ${fmtPct(-trend, 1).replace(' %', '')} procentpoint siden ${first}: markedet vokser hurtigere end foreningen. Blandt studerende går det den anden vej. Kilder: DP's egne organisationsgrader, Sundhedsdatastyrelsen (2023) og Danmarks Statistik (${empLast}).`}
        onDark
        color="#f2d57a"
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard
          title={`Organisationsgrad ${first}–${last}`}
          subtitle="Andel af psykologer i Danmark, der er medlem af DP. Færdiguddannede = alle med en psykologuddannelse; beskæftigede = dem i arbejde; studerende mod indskrevne på psykologistudiet."
          table={<DataTable columns={[{ key: 'y', label: 'År' }, { key: 'f', label: 'Færdiguddannede', align: 'right' }, { key: 'b', label: 'Beskæftigede', align: 'right' }, { key: 's', label: 'Stud. (dk)', align: 'right' }, { key: 'sa', label: 'Stud. (alle)', align: 'right' }]}
                            rows={years.map((y) => ({ y, f: fmtPct(r(y).faerdig, 1), b: fmtPct(r(y).beskaeftigede, 1), s: fmtPct(r(y).studerendeDk, 1), sa: fmtPct(r(y).studerendeAlle, 0) }))} />}
        >
          <Lines series={series} xLabels={years} height={300} valueFormat={(n) => fmtPct(n, 1)} yMin={30} yMax={95} xTickEvery={2} padRight={130} />
          <p className="mt-2 text-[0.75rem] leading-relaxed text-dp-navy-500">
            Færdiguddannede: {fmtPct(r(first).faerdig, 1)} → {fmtPct(r(last).faerdig, 1)}. Beskæftigede holder bedre ({fmtPct(r(last).beskaeftigede, 1)}). Studerende: {fmtPct(r(first).studerendeDk, 1)} → {fmtPct(r(last).studerendeDk, 1)} — {last} var det bedste år i rækken.
          </p>
        </ChartCard>

        <ChartCard title="Hvem er ikke medlem?" subtitle={`Organisationsgrad efter alder: DP's medlemmer (uden studerende) mod alle psykologuddannede i Danmark, også dem uden for arbejdsstyrken. Danmarks Statistik, ${emp?.latest ?? ''}.`}>
          <ul className="space-y-2">
            {ageRows.map((a) => (
              <li key={a.label}>
                <div className="mb-0.5 flex justify-between text-[0.8125rem]"><span className="text-dp-navy-800">{a.label} år</span><span className="tnum font-semibold text-dp-navy-900">{fmtPct(a.share, 0)} <span className="text-[0.6875rem] font-normal text-dp-navy-500">{fmtNum(a.dp)} / {fmtNum(a.sds)}</span></span></div>
                <div className="h-2 rounded-full bg-dp-navy-100"><div className="h-full rounded-full" style={{ width: `${Math.min(100, a.share ?? 0)}%`, background: (a.share ?? 0) >= 80 ? '#179fa0' : (a.share ?? 0) >= 65 ? '#4c7bbd' : '#df790d' }} /></div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">
            Begge tal er pr. ultimo {emp?.latest}. DP's medlemmer omfatter også psykologer uddannet i udlandet og enkelte med andre uddannelser, så andelen kan overstige DST's bestand i et bånd. Under 30 år trækkes ned af nyuddannede, der endnu ikke er meldt ind; over 65 af dem, der har forladt faget.
          </p>
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <ChartCard title="Efter sektor" subtitle="DP's arbejdende medlemmer mod Sundhedsdatastyrelsens tal, 2023.">
          <Rows rows={sekRows} />
        </ChartCard>
        <ChartCard title="Efter region" subtitle="Arbejdsstedsregion. DP: registreret arbejdsplads; SDS: 2023.">
          <Rows rows={regRows} />
        </ChartCard>
        <ChartCard title="Bestanden af psykologer" subtitle={`Alle med en psykologuddannelse i Danmark, efter beskæftigelse. Danmarks Statistik, ultimo november.`}>
          {emp && (
            <>
              <StackedBars items={empYears.filter((y) => Number(y) >= Number(empLast) - 7).map((y) => ({ label: y.slice(2), parts: Object.fromEntries(empKeys.map((k) => [k, emp.byYear[y][k] ?? 0])) }))}
                           keys={empKeys} colors={empColors} labels={Object.fromEntries(empKeys.map((k) => [k, k]))} height={190} width={420} />
              <Legend keys={empKeys} colors={empColors} labels={Object.fromEntries(empKeys.map((k) => [k, k]))} />
              <p className="mt-2 text-[0.75rem] leading-relaxed text-dp-navy-500">
                {fmtNum(empTotal(empLast))} psykologuddannede i {empLast}, {fmtPctSigned(((empTotal(empLast) / empTotal(empYears[0])) - 1) * 100, 0)} siden {empYears[0]}. Ledigheden er {fmtPct(unemp(empLast), 1)} af arbejdsstyrken. {fmtNum(emp.byYear[empLast]['Uden for arbejdsstyrken'])} står uden for arbejdsstyrken — det er den gruppe, der er sværest at holde på.
              </p>
            </>
          )}
        </ChartCard>
      </div>

      {mid && (
        <div className="mt-5">
          <div className="mb-4 max-w-3xl">
            <h3 className="font-serif text-[1.375rem] font-semibold text-white">De 30–44-årige: hvornår i karrieren taber vi dem?</h3>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-dp-navy-300">
              {fmtNum(loss30.total)} medlemmer mellem 30 og 44 har meldt sig ud siden 2023. Her er, hvem de var, hvor langt de var i karrieren — og hvor mange af dem, der kommer tilbage.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <ChartCard title="Hvad var de, da de gik?" subtitle="Kontingentgruppe ved udmeldelsen, 30–44-årige, 2023 og frem.">
              <Bars rows={loss30.group} colors={GROUP_COLOR} labels={{ ...mov!.meta.groupLabels, ud: 'Udmeldt' }} />
            </ChartCard>
            <ChartCard title="Hvor langt efter cand.psych.?" subtitle="Tid fra cand.psych.-dato til udmeldelse.">
              <Bars rows={loss30.sinceCand} colors={{ 'under 2 år': '#4e4897', '2–5 år': '#4c7bbd', '5–10 år': '#3a557d', 'over 10 år': '#8299bb', 'ingen cand.psych.': '#aebdd4', 'før cand.psych.': '#4fa388' }} labels={{}} order={['før cand.psych.', 'under 2 år', '2–5 år', '5–10 år', 'over 10 år', 'ingen cand.psych.']} />
              <p className="mt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">Tabet sker ikke ved kontingentskiftet — det sker 2–10 år inde i karrieren, når man er etableret og overenskomsten føles fjern.</p>
            </ChartCard>
            <ChartCard title="Hvorfor?" subtitle="Registreret udmeldelsesårsag, 30–44-årige.">
              <Bars rows={loss30.reason} colors={REASON_COLOR} labels={{}} />
              <p className="mt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">"For dyrt" og "økonomi" er tilsammen den største kendte årsag i denne aldersgruppe — det er også dem med de højeste kontingenter og de laveste indkomster relativt til livsfasen.</p>
            </ChartCard>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <ChartCard title={`Genindmeldelse: ${fmtPct(returnRate, 0)} kommer tilbage inden for to år`} subtitle="Medlemmer, der forsvandt fra listen, og som dukkede op igen. Af dem, der forlod foreningen 2022–2024, hvor mange var tilbage senest 24 måneder efter?">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <ul className="space-y-2">
                    {mid.reentry.returnedWithin24.map((r) => (
                      <li key={r.year}>
                        <div className="mb-0.5 flex justify-between text-[0.8125rem]"><span className="text-dp-navy-800">Forlod os i {r.year}</span><span className="tnum font-semibold text-dp-navy-900">{fmtPct((r.returned / (r.left || 1)) * 100, 0)} <span className="text-[0.6875rem] font-normal text-dp-navy-500">{fmtNum(r.returned)} / {fmtNum(r.left)}</span></span></div>
                        <div className="h-2 rounded-full bg-dp-navy-100"><div className="h-full rounded-full bg-dp-navy-600" style={{ width: `${(r.returned / (r.left || 1)) * 100}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-[0.8125rem] text-dp-navy-700">
                  <div className="font-semibold text-dp-navy-900">Hvor hurtigt?</div>
                  <ul className="mt-1 space-y-1">
                    {['under 1 år', '1–2 år', 'over 2 år'].map((g) => <li key={g} className="flex justify-between"><span>{g}</span><span className="tnum font-semibold">{fmtNum(mid.reentry.gap[g] ?? 0)}</span></li>)}
                  </ul>
                  <div className="mt-3 font-semibold text-dp-navy-900">Seneste 12 måneder</div>
                  <p className="mt-1 leading-relaxed">{fmtNum(mid.reentry.last12.genindmeldt)} genindmeldte mod {fmtNum(mid.reentry.last12.nye)} helt nye — hver sjette indmeldelse er et tidligere medlem.</p>
                </div>
              </div>
              <p className="mt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">
                Målt på stamkortnummer: samme nummer, væk fra listen i mindst to måneder, tilbage igen. Genindmeldte kommer oftest tilbage som normalansatte ({fmtNum(mid.reentry.toGroup.normal ?? 0)} af {fmtNum(mid.reentry.n)}) — de fik et job, hvor det igen gav mening. Det er et argument for at holde kontakten i stedet for at lukke døren.
              </p>
            </ChartCard>
            <ChartCard title="Organisationsgrad 30–44 år over tid" subtitle="DP's medlemmer 30–44 (uden studerende, pr. december) mod Danmarks Statistiks bestand samme år.">
              <ul className="space-y-2.5">
                {org3044.map((r) => (
                  <li key={r.year}>
                    <div className="mb-0.5 flex justify-between text-[0.8125rem]"><span className="text-dp-navy-800">{r.year}</span><span className="tnum font-semibold text-dp-navy-900">{fmtPct(r.share, 0)} <span className="text-[0.6875rem] font-normal text-dp-navy-500">{fmtNum(r.dp)} / {fmtNum(r.pop)}</span></span></div>
                    <div className="h-2 rounded-full bg-dp-navy-100"><div className="h-full rounded-full bg-dp-navy-600" style={{ width: `${Math.min(100, r.share ?? 0)}%` }} /></div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">
                {org3044.length ? `${fmtNum((org3044[org3044.length - 1].pop ?? 0) - (org3044[org3044.length - 1].dp ?? 0))} psykologer mellem 30 og 44 var ikke medlem i ${org3044[org3044.length - 1].year}.` : ''} DST's tal kommer med to års forsinkelse; DP's tal for de seneste år står i Medlemmerne.
              </p>
            </ChartCard>
          </div>
        </div>
      )}

      <div className="mt-5">
        <Reveal className="card p-5 sm:p-6">
          <h3 className="text-[1.0625rem] font-semibold text-dp-navy-900">Det siger tallene</h3>
          <ul className="mt-3 grid gap-2.5 text-[0.875rem] leading-relaxed text-dp-navy-700 md:grid-cols-2">
            {[
              `Der bliver flere psykologer, end DP får medlemmer: bestanden af psykologuddannede er vokset ${fmtPctSigned(((empTotal(empLast) / empTotal(empYears[0])) - 1) * 100, 0)} siden ${empYears[0]}, mens organisationsgraden for færdiguddannede er faldet fra ${fmtPct(r(first).faerdig, 0)} til ${fmtPct(r(last).faerdig, 0)}. Målet om 15.000 er i den forstand beskedent — markedet er der.`,
              `Hullet sidder hos de 30–44-årige, hvor organisationsgraden er omkring ${fmtPct(Math.min(...ageRows.slice(1, 4).map((x) => x.share ?? 0)), 0)}, og hos de over 65 (${fmtPct(ageRows[ageRows.length - 1]?.share ?? null, 0)}). Fra 50 år og op til pensionen ligger den omkring ${fmtPct(Math.max(...ageRows.slice(5, 8).map((x) => x.share ?? 0)), 0)}. De 30–44-årige er ${fmtNum(ageRows.slice(1, 4).reduce((t, x) => t + ((x.sds ?? 0) - (x.dp ?? 0)), 0))} psykologer, der ikke er medlem — den største enkeltgruppe at hente.`,
              `Blandt beskæftigede holder DP ${fmtPct(r(last).beskaeftigede, 0)}. Faldet i den samlede organisationsgrad kommer fra dem uden for arbejdsstyrken — pensionerede, emigrerede og folk, der har forladt faget.`,
              `Studerende er lyspunktet: ${fmtPct(r(last).studerendeDk, 1)} i ${last}, det højeste i rækken. Den indsats, der løftede studentertallet, virker — og den fylder kandidatårgangene op to-fem år frem.`,
            ].map((s) => (
              <li key={s} className="flex gap-2.5"><span className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-dp-orange" /><span>{s}</span></li>
            ))}
          </ul>
        </Reveal>
      </div>
    </>
  )
}

function Bars({ rows, colors, labels, order }: { rows: Record<string, number>; colors: Record<string, string>; labels: Record<string, string>; order?: string[] }) {
  const entries = (order ? order.filter((k) => rows[k]).map((k) => [k, rows[k]] as [string, number]) : Object.entries(rows).sort((a, b) => b[1] - a[1])).slice(0, 7)
  const total = Object.values(rows).reduce((t, v) => t + v, 0) || 1
  const max = Math.max(1, ...entries.map(([, v]) => v))
  return (
    <ul className="space-y-2">
      {entries.map(([k, v]) => (
        <li key={k}>
          <div className="mb-0.5 flex justify-between text-[0.8125rem]"><span className="text-dp-navy-800">{labels[k] ?? k}</span><span className="tnum font-semibold text-dp-navy-900">{fmtNum(v)} <span className="text-[0.6875rem] font-normal text-dp-navy-500">{fmtPct((v / total) * 100, 0)}</span></span></div>
          <div className="h-1.5 rounded-full bg-dp-navy-100"><div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: colors[k] ?? '#8299bb' }} /></div>
        </li>
      ))}
    </ul>
  )
}

function Rows({ rows }: { rows: { label: string; dp: number | null; sds: number | null; share: number | null }[] }) {
  return (
    <ul className="space-y-2.5">
      {rows.filter((x) => x.sds).map((a) => (
        <li key={a.label}>
          <div className="mb-0.5 flex justify-between text-[0.8125rem]"><span className="text-dp-navy-800">{a.label}</span><span className="tnum font-semibold text-dp-navy-900">{fmtPct(a.share, 0)} <span className="text-[0.6875rem] font-normal text-dp-navy-500">{fmtNum(a.dp)} / {fmtNum(a.sds)}</span></span></div>
          <div className="h-2 rounded-full bg-dp-navy-100"><div className="h-full rounded-full bg-dp-navy-600" style={{ width: `${Math.min(100, a.share ?? 0)}%` }} /></div>
        </li>
      ))}
    </ul>
  )
}
