/**
 * Bevægelser: sektionerne, ind- og udmeldelser, og fastholdelsen over det
 * kritiske kontingentskift. Sidst en ærlig liste over, hvad der mangler af
 * data for at gå fra skøn til facit.
 */
import { useMemo } from 'react'
import { ChartCard, SectionHeading, Reveal } from '@/components/primitives'
import { DataTable } from '@/components/charts'
import { DivergingBars, Lines, type Series } from '@/components/lines'
import {
  MONTHS, MONTHS_SHORT, cap, computeTransitions, ddmmyy, fmtNum, fmtPct, fmtPctSigned, fmtSigned, monthIndex, pctChange, yearOf,
  type AsOf, type Dashboard,
} from '@/lib/data'

/* ── Sektioner ───────────────────────────────────────────────────────────── */

const SEC_SHORT: Record<string, string> = {
  'Kommunalt Ansatte Psykologers Sektion': 'Kommunalt ansatte',
  'Selvstændige Psykologers Sektion': 'Selvstændige',
  'Hospitalssektionen': 'Hospital',
  'Studentersektionen': 'Studerende',
  'Privat ansatte psykologers sektion': 'Privat ansatte',
  'Ledersektionen': 'Ledere',
  'Universitetssektionen': 'Universitet',
  'Pædagogiske Psykologers Sektion': 'Pædagogiske psykologer',
  'Ingen sektion': 'Ingen sektion',
  'Uden sektion': 'Uden sektion',
}
const secLabel = (k: string) => SEC_SHORT[k] ?? k

export function Sections({ data, a }: { data: Dashboard; a: AsOf }) {
  const rows = a.sections
  const max = Math.max(1, ...rows.map((r) => r.now))
  const snaps = data.snapshots.filter((s) => s.date <= a.date).slice(-14)
  const trend: Series[] = rows.filter((r) => !/Ingen|Uden/.test(r.key)).map((r, i) => ({
    key: r.key, label: secLabel(r.key), color: ['#4c7bbd', '#df790d', '#179fa0', '#4e4897', '#d24e46', '#4fa388', '#d8a90c', '#8299bb'][i % 8],
    endLabel: true,
    points: snaps.map((s, j) => {
      const now = s.sections[r.key]?.now ?? null
      const base = snaps[0].sections[r.key]?.now ?? null
      return { x: j, y: now === null || base === null || base === 0 ? null : ((now - base) / base) * 100 }
    }),
  }))
  return (
    <>
      <SectionHeading
        kicker="Sektioner"
        title="Hvor medlemmerne er organiseret"
        lead={`Sektionerne pr. ${ddmmyy(a.date)}, og hvordan de har flyttet sig siden samme måned sidste år.`}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <ChartCard title="Medlemmer pr. sektion" subtitle="Tal i parentes er ændringen mod samme måned sidste år.">
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.key}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-[0.8125rem]">
                  <span className="text-dp-navy-800">{secLabel(r.key)}</span>
                  <span className="tnum">
                    <strong className="text-dp-navy-900">{fmtNum(r.now)}</strong>
                    <span className="ml-1.5 text-[0.75rem] font-semibold" style={{ color: (r.dYear ?? 0) > 0 ? '#179fa0' : (r.dYear ?? 0) < 0 ? '#d24e46' : '#7a8798' }}>
                      ({fmtSigned(r.dYear)} · {fmtPctSigned(pctChange(r.now, r.ly))})
                    </span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-dp-navy-100">
                  <div className="h-full rounded-full bg-dp-navy-600" style={{ width: `${(r.now / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </ChartCard>
        <ChartCard
          title="Udvikling i sektionerne"
          subtitle={`Procentvis ændring siden ${ddmmyy(snaps[0].date)}, så små og store sektioner kan ses på samme akse. "Ingen/uden sektion" er udeladt.`}
          table={
            <DataTable
              columns={[{ key: 's', label: 'Sektion' }, ...snaps.map((s) => ({ key: s.date, label: `${MONTHS_SHORT[monthIndex(s.date)]} ${String(yearOf(s.date)).slice(2)}`, align: 'right' as const }))]}
              rows={rows.map((r) => ({ s: secLabel(r.key), ...Object.fromEntries(snaps.map((s) => [s.date, fmtNum(s.sections[r.key]?.now ?? null)])) }))}
            />
          }
        >
          <Lines series={trend} xLabels={snaps.map((s) => `${MONTHS_SHORT[monthIndex(s.date)]} ${String(yearOf(s.date)).slice(2)}`)}
                 height={300} valueFormat={(n) => fmtPctSigned(n)} xTickEvery={2} padRight={130} />
        </ChartCard>
      </div>
    </>
  )
}

/* ── Ind- og udmeldelser ─────────────────────────────────────────────────── */

export function Flows({ a }: { data: Dashboard; a: AsOf }) {
  const flows = a.flowsToDate.slice(-12)
  const label = (m: string) => `${MONTHS_SHORT[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`
  const sumIn = flows.reduce((s, f) => s + (f.ind ?? 0), 0)
  const sumOut = flows.reduce((s, f) => s + (f.ud ?? 0), 0)
  const monthsOfYear = flows.filter((f) => f.month.startsWith(String(yearOf(a.date))))
  const ytdIn = monthsOfYear.reduce((s, f) => s + (f.ind ?? 0), 0)
  const ytdOut = monthsOfYear.reduce((s, f) => s + (f.ud ?? 0), 0)
  const churnRate = a.total ? (sumOut / flows.length / a.total) * 100 : null

  return (
    <>
      <SectionHeading
        kicker="Ind- og udmeldelser"
        title={flows.length ? `${fmtSigned(sumIn - sumOut)} medlemmer på ${flows.length} måneder` : 'Ind- og udmeldelser'}
        lead="Bruttobevægelserne bag nettotallet. Udmeldelser bogføres ofte forskudt, så summen her rammer ikke måned for måned den samlede udvikling — men tendensen gør."
      />
      {flows.length === 0 ? (
        <div className="card p-6 text-[0.875rem] text-dp-navy-600">
          Ingen ind- og udmeldelser registreret endnu. Skriv dem i <code className="rounded bg-dp-navy-50 px-1">data/ind_udmeldelser.csv</code> — én linje pr. måned.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <ChartCard
            title="Ind- og udmeldelser pr. måned"
            subtitle="Grøn op er indmeldelser, rød ned er udmeldelser."
            legend={[{ label: 'Indmeldelser', color: '#179fa0' }, { label: 'Udmeldelser', color: '#d24e46' }]}
            table={
              <DataTable
                columns={[{ key: 'm', label: 'Måned' }, { key: 'i', label: 'Ind', align: 'right' }, { key: 'u', label: 'Ud', align: 'right' }, { key: 'n', label: 'Forskel', align: 'right' }, { key: 'note', label: 'Note' }]}
                rows={[...flows].reverse().map((f) => ({ m: label(f.month), i: fmtNum(f.ind), u: fmtNum(f.ud), n: fmtSigned((f.ind ?? 0) - (f.ud ?? 0)), note: f.note ?? '' }))}
              />
            }
          >
            <DivergingBars items={flows.map((f) => ({ label: label(f.month), value: (f.ind ?? 0) - (f.ud ?? 0), up: f.ind ?? 0, down: f.ud ?? 0 }))} height={260} />
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Mini label={`Indmeldelser, seneste ${flows.length} mdr.`} value={fmtNum(sumIn)} />
              <Mini label={`Udmeldelser, seneste ${flows.length} mdr.`} value={fmtNum(sumOut)} />
              <Mini label={`Netto i ${yearOf(a.date)}`} value={fmtSigned(ytdIn - ytdOut)} />
              <Mini label="Udmeldelser pr. måned, i % af medlemmer" value={fmtPct(churnRate, 2)} />
            </div>
          </ChartCard>
          <ChartCard title="Netto pr. måned" subtitle="Forskellen mellem ind- og udmeldelser.">
            <DivergingBars items={flows.map((f) => ({ label: label(f.month), value: (f.ind ?? 0) - (f.ud ?? 0) }))} height={220} width={420} positiveColor="#4c7bbd" valueFormat={fmtSigned} />
            <p className="mt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">
              Januar og februar har flest udmeldelser: det er årsskiftets opsigelser, der slår igennem. Til gengæld er nettotallet positivt fra marts og frem.
            </p>
          </ChartCard>
        </div>
      )}
    </>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-dp-navy-50 px-3 py-2.5">
      <div className="text-[0.6875rem] font-semibold text-dp-navy-500">{label}</div>
      <div className="tnum mt-0.5 text-[1.0625rem] font-semibold text-dp-navy-900">{value}</div>
    </div>
  )
}

/* ── Fastholdelse over kontingentskiftet ─────────────────────────────────── */

export function Retention({ data, a }: { data: Dashboard; a: AsOf }) {
  const transitions = useMemo(() => computeTransitions(data).filter((t) => t.to <= a.date), [data, a.date])
  // Kontingentskiftet: de måneder, hvor kandidat-kategorien tømmes markant
  const shifts = transitions.filter((t) => t.kandidaterDelta <= -40)
  // Dimittendflytningen: de måneder, hvor kandidat-kategorien fyldes markant
  const intake = transitions.filter((t) => t.kandidaterDelta >= 60)

  const lbl = (d: string) => `${cap(MONTHS[monthIndex(d)])} ${yearOf(d)}`

  return (
    <>
      <SectionHeading
        kicker="Frafald og fastholdelse"
        title="Det kritiske kontingentskift"
        lead="Efter to år som kandidat ryger kontingentet op på fuld pris. Der har vi ikke individdata endnu, men nettotallene viser bevægelsen: når kandidat-kategorien tømmes, hvor mange genfindes så som fuldtidsbetalende?"
        onDark
        color="#8ebec0"
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Når kandidaterne skifter kontingent" subtitle="Måneder hvor 1. og 2. års kandidater faldt med mindst 40, og hvad der skete med de fuldtidsbetalende samme måned.">
          {shifts.length === 0 ? (
            <p className="text-[0.8125rem] text-dp-navy-500">Ingen måneder med markant fald endnu.</p>
          ) : (
            <ul className="space-y-4">
              {shifts.map((t) => (
                <li key={t.to} className="rounded-xl border border-dp-navy-100 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-serif text-[1rem] font-semibold text-dp-navy-900">{lbl(t.to)}</span>
                    <span className="tnum text-[0.8125rem] text-dp-navy-500">alle medlemmer {Number.isNaN(t.totalDelta) ? '–' : fmtSigned(t.totalDelta)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <Kpi label="Kandidater" value={fmtSigned(t.kandidaterDelta)} color="#4e4897" />
                    <Kpi label="Fuldtidsbetalende" value={fmtSigned(t.fulltimeDelta)} color="#3a557d" />
                    <Kpi label="Genfundet, skøn" value={t.conversion === null ? '–' : fmtPct(t.conversion * 100, 0)} color={t.conversion !== null && t.conversion >= 0.8 ? '#179fa0' : '#df790d'} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[0.75rem] leading-relaxed text-dp-navy-500">
            "Genfundet" er stigningen i fuldtidsbetalende delt med faldet i kandidater. Det er et nettoskøn: andre bevægelser i de samme kategorier (nye indmeldelser, ledige der får job) tæller med. Med individdata bliver det et facit.
          </p>
        </ChartCard>

        <div className="grid gap-5">
          <ChartCard title="Når dimittenderne flyttes" subtitle="Måneder hvor kandidat-kategorien voksede med mindst 60 — typisk oktober, når sommerens kandidater får rettet dimittenddato.">
            {intake.length === 0 ? (
              <p className="text-[0.8125rem] text-dp-navy-500">Ingen endnu.</p>
            ) : (
              <ul className="space-y-2.5">
                {intake.map((t) => (
                  <li key={t.to} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-dp-navy-50 pb-2 last:border-0 text-[0.8125rem]">
                    <span className="font-semibold text-dp-navy-900">{lbl(t.to)}</span>
                    <span className="tnum text-dp-navy-700">
                      kandidater <strong style={{ color: '#4e4897' }}>{fmtSigned(t.kandidaterDelta)}</strong>
                      <span className="mx-1.5 text-dp-navy-300">·</span>
                      studerende <strong style={{ color: '#4fa388' }}>{fmtSigned(t.studerendeDelta)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>

          <Reveal className="card p-5 sm:p-6">
            <h3 className="text-[1.0625rem] font-semibold text-dp-navy-900">Det siger tallene indtil videre</h3>
            <ul className="mt-3 space-y-2.5 text-[0.875rem] leading-relaxed text-dp-navy-700">
              {insights(data, a).map((s) => (
                <li key={s} className="flex gap-2.5">
                  <span className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-dp-orange" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-[0.6875rem] font-semibold text-dp-navy-500">{label}</div>
      <div className="tnum mt-0.5 font-serif text-[1.375rem] font-semibold" style={{ color }}>{value}</div>
    </div>
  )
}

function insights(data: Dashboard, a: AsOf): string[] {
  const out: string[] = []
  const tr = computeTransitions(data).filter((t) => t.to <= a.date)
  const shifts = tr.filter((t) => t.conversion !== null)
  if (shifts.length) {
    const avg = shifts.reduce((s, t) => s + (t.conversion ?? 0), 0) / shifts.length
    out.push(`Ved kontingentskiftet genfindes i gennemsnit ${fmtPct(avg * 100, 0)} af faldet i kandidater som fuldtidsbetalende samme måned. Resten er den kritiske gruppe.`)
  }
  const k = a.kandidater
  if (k.ly !== null && k.now > k.ly) {
    out.push(`Der er ${fmtNum(k.now - k.ly)} flere 1. og 2. års kandidater end for et år siden. Dem, der blev kandidater i efteråret ${yearOf(a.date) - 1}, når kontingentskiftet i sommeren ${yearOf(a.date) + 1} — så potentialet i kongeindikatoren vokser to år frem.`)
  }
  const ledig = a.categories.find((c) => c.key === 'Ledig DP')
  if (ledig && ledig.dYear !== null && ledig.dYear < 0) {
    out.push(`Ledige er ${fmtNum(-ledig.dYear)} færre end for et år siden (${fmtPctSigned(pctChange(ledig.now, ledig.ly))}). Er det job — så dukker de op som normalansatte — eller er det udmeldelser? Det kan kun individdata svare på.`)
  }
  const dlf = a.categories.filter((c) => c.key.startsWith('DLF'))
  const dlfLoss = dlf.reduce((s, c) => s + (c.dYear ?? 0), 0)
  if (dlfLoss < 0) out.push(`DLF-dobbeltmedlemmerne bliver stille og roligt færre (${fmtSigned(dlfLoss)} på et år). Det er en gruppe, der er på vej ud af foreningen — ikke ind.`)
  const pens = a.categories.filter((c) => c.group === 'pensionister').reduce((s, c) => s + c.now, 0)
  const pensLy = a.categories.filter((c) => c.group === 'pensionister').reduce((s, c) => s + (c.ly ?? 0), 0)
  if (pens && pensLy) out.push(`Pensionister udgør ${fmtPct((pens / a.total) * 100, 1)} af medlemmerne og er ${fmtSigned(pens - pensLy)} på et år. Med aldersdata kunne vi se, hvor mange normalansatte der nærmer sig overgangen.`)
  return out
}

/* ── Hvad der mangler ────────────────────────────────────────────────────── */

export function DataNeeds({ data }: { data: Dashboard }) {
  const items: { title: string; why: string; how: string }[] = [
    {
      title: 'Ind- og udmeldelser for alle måneder, helst tilbage til januar 2024',
      why: 'Lige nu har vi seks måneder fra mailene. Med to hele år kan vi vise sæsonmønstret i udmeldelser og lave en rigtig frafaldsprocent pr. måned.',
      how: 'Én linje pr. måned i data/ind_udmeldelser.csv: Måned;Indmeldelser;Udmeldelser. Kan de opdeles på kontingentkategori, bliver det endnu bedre: ét ekstra ark pr. måned.',
    },
    {
      title: 'Udmeldelser fordelt på kontingentkategori og årsag',
      why: 'Så kan vi se, om de kritiske udmeldelser sker ved kontingentskiftet, blandt studerende, der aldrig bliver kandidater, eller blandt pensionister — tre helt forskellige indsatser.',
      how: 'Et udtræk fra medlemssystemet med: måned, kategori ved udmeldelse, evt. årsag (som medlemmet selv har angivet). Ingen navne, ingen cpr.',
    },
    {
      title: 'Bevægelser mellem kategorier (anonymiseret)',
      why: 'Det gør "genfundet"-skønnet til et facit: hvor stor en andel af kandidaterne skifter til fuldt kontingent, hvor mange melder sig ud, og hvor mange bliver ledige. Det samme for studerende → kandidat.',
      how: 'Et udtræk pr. måned med tre kolonner: fra-kategori, til-kategori, antal. Eller en liste af medlems-id (hashed) med kategori pr. måned.',
    },
    {
      title: 'Dimittendkohorter',
      why: 'Hvor mange kandidater rammer kontingentskiftet hver måned de næste 24 måneder? Det er den bedste forudsigelse af kongeindikatoren, vi kan lave.',
      how: 'Antal 1. og 2. års kandidater fordelt på dimittendmåned (år-måned). Ét ark, opdateres hvert kvartal.',
    },
    {
      title: 'Månedsfiler for juni 2025 og for 2024',
      why: 'Juni 2025 mangler helt, og 2024 findes kun for de fem hovedkategorier. Med dem kan hele tabellen og varmekortet gå to år tilbage.',
      how: 'Samme skabelon som de andre måneder, lagt i data/ultimo/. Har I kun tallene i en gammel mail, kan vi taste dem ind.',
    },
    {
      title: 'Alder og anciennitet',
      why: 'Hvor mange normalansatte når pensionsalderen de næste fem år? Det er en kendt, forudsigelig nedgang i kongeindikatoren, som målet for 2029 skal regne med.',
      how: 'Antal medlemmer pr. fødselsår og pr. kontingentkategori. Ét ark, én gang om året.',
    },
    {
      title: 'Kreds, køn og arbejdsplads-type',
      why: 'Kredslisten i arkene er tom. Med den kan vi vise geografien, og med arbejdsplads-type kan sektionsbilledet forklares.',
      how: 'Kolonner i det samme månedsark, som sektionerne allerede har.',
    },
    {
      title: 'Nye studentermedlemmer pr. semester mod optaget på universiteterne',
      why: 'Det giver en "markedsandel" blandt nye psykologistuderende — og et tidligt varsel om kandidat-kategorien tre-fem år frem.',
      how: 'Antal nye studentermedlemmer pr. semester (fra jeres data) og optagstal fra KU, AU, SDU og AAU (offentlige).',
    },
  ]
  return (
    <>
      <SectionHeading
        kicker="Næste skridt"
        title="Data, der ville gøre analyserne skarpere"
        lead="Alt ovenfor er bygget på månedsarkene. Det her er, hvad der skal til for at gå fra nettotal og skøn til rigtige frafalds- og fastholdelsesanalyser. I prioriteret rækkefølge."
      />
      <ol className="grid gap-4 md:grid-cols-2">
        {items.map((it, i) => (
          <li key={it.title} className="card flex gap-4 p-5">
            <span className="tnum grid h-8 w-8 shrink-0 place-items-center rounded-full bg-dp-navy-600 font-serif text-[0.9375rem] font-semibold text-white">{i + 1}</span>
            <div>
              <h3 className="text-[0.9375rem] font-semibold text-dp-navy-900">{it.title}</h3>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-dp-navy-700">{it.why}</p>
              <p className="mt-2 text-[0.75rem] leading-relaxed text-dp-navy-500"><strong className="text-dp-navy-600">Sådan:</strong> {it.how}</p>
            </div>
          </li>
        ))}
      </ol>
      {data.meta.warnings.length > 0 && (
        <div className="mt-6 rounded-2xl border border-dp-orange-30 bg-dp-orange-15 p-5">
          <h3 className="text-[0.9375rem] font-semibold text-dp-navy-900">Bemærkninger fra dataindlæsningen</h3>
          <ul className="mt-2 space-y-1 text-[0.8125rem] text-dp-navy-700">
            {data.meta.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}
    </>
  )
}
