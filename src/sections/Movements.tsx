/**
 * Bevægelser: sektionerne, ind- og udmeldelser, og fastholdelsen over det
 * kritiske kontingentskift. Sidst en ærlig liste over, hvad der mangler af
 * data for at gå fra skøn til facit.
 */
import { ChartCard, SectionHeading } from '@/components/primitives'
import { DataTable } from '@/components/charts'
import { Lines, type Series } from '@/components/lines'
import { MONTHS_SHORT, ddmmyy, fmtNum, fmtPctSigned, fmtSigned, monthIndex, pctChange, yearOf, type AsOf, type Dashboard } from '@/lib/data'

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

/* ── Hvad der mangler ────────────────────────────────────────────────────── */

export function DataNeeds({ data }: { data: Dashboard }) {
  const items: { title: string; why: string; how: string }[] = [
    {
      title: 'Teksten bag "Anden årsag" ved udmeldelse',
      why: '"Anden årsag" og "Ukendt" er tilsammen omkring hver tredje udmeldelse. Kan de kodes i fem-seks kategorier, får vi et rigtigt billede af, hvorfor folk går.',
      how: 'Et udtræk af fritekstfeltet for udmeldelser siden 2023, uden navne. Vi koder det i første omgang i hånden og laver derefter en fast liste.',
    },
    {
      title: 'Restancelukninger: hvem og hvornår',
      why: 'Restance er den største kendte årsag (over 100 om året) og rammer i december og marts. Hvis vi ved, hvor mange rykkere der går ud, og hvor mange der betaler, kan vi måle en indsats mod det.',
      how: 'Antal rykkere pr. måned og antal lukninger pr. måned, fordelt på kontingentgruppe.',
    },
    {
      title: 'De 500 studerende med overskredet slutdato',
      why: 'De står som studerende, men er formentlig færdige. Enten skal de være kandidater (og tælle mod kongeindikatoren om to år), eller også er de på vej ud.',
      how: 'En liste (kun antal pr. universitet og forventet slutår) til den ansvarlige for dimittendflytning — og et fast månedligt tjek.',
    },
    {
      title: 'Optaget på psykologistudierne',
      why: 'Med KU, AU, SDU og AAU-optagstallene kan vi sætte vores nye studentermedlemmer i forhold til, hvor mange der starter — en markedsandel og et varsel om kandidatårgangene 2030+.',
      how: 'Offentlige tal fra uddannelsesministeriet, ét tal pr. universitet pr. år.',
    },
    {
      title: 'Hvad de ledige bliver til',
      why: 'Ledig → normalansat er den næststørste bevægelse ind i kongeindikatoren. Hvor længe er de ledige, og hvor mange melder sig ud undervejs?',
      how: 'Det kan vi regne på listerne allerede — sig til, så laver vi en varighedsanalyse for ledige.',
    },
    {
      title: 'Kontingentsatser pr. gruppe',
      why: 'Så kan bevægelserne oversættes til kroner: hvad et kontingentskift, en udmeldelse og en pensionering betyder for kontingentindtægten — og hvad 15.000 medlemmer er værd.',
      how: 'Én linje pr. kontingenttype: årligt kontingent. Ligger formentlig i et regneark i økonomi.',
    },
  ]
  return (
    <>
      <SectionHeading
        kicker="Næste skridt"
        title="Det, der kan blive endnu skarpere"
        lead="Bevægelserne, kohorterne og udmeldelserne bygger nu på de månedlige medlemslister. Det her er, hvad der stadig kan løfte analyserne. I prioriteret rækkefølge."
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
