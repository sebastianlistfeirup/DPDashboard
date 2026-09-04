/**
 * Hovedkontingentkategorierne, år over år — det, der var vedhæftet mailen
 * som "visualiseringer". Fem små figurer med samme akse-logik, så øjet kan
 * gå fra den ene til den anden uden at skulle læse akserne om.
 */
import { ChartCard, SectionHeading } from '@/components/primitives'
import { DataTable } from '@/components/charts'
import { Lines, type Series } from '@/components/lines'
import {
  MAIN_COLORS, MONTHS_SHORT, MONTHS, cap, catLabel, fmtNum, fmtSigned, monthIndex, yearColor, yearOf,
  type AsOf, type Dashboard,
} from '@/lib/data'

const ORDER = ['Normaltansat over 19 timer', 'Selvstændig', '1 og 2 års Kandidater', 'Studerende DP', 'Ph.d. studerende']

const NOTES: Record<string, string> = {
  'Normaltansat over 19 timer': 'Springet i juli er kandidater, der efter to år skifter til fuldt kontingent.',
  'Selvstændig': 'Vokser jævnt hele året — og fik et ekstra ryk i 2026.',
  '1 og 2 års Kandidater': 'Fyldes op i oktober, når sommerens dimittender flyttes; tømmes i juli, når de ældste skifter kontingent.',
  'Studerende DP': 'Nyt optag i september. Faldet i oktober er studerende, der bliver kandidater.',
  'Ph.d. studerende': 'Lille kategori — tæller med i kongeindikatoren, men flytter den sjældent.',
}

export function MainCats({ data, a }: { data: Dashboard; a: AsOf }) {
  const year = yearOf(a.date)
  const byDate = new Map(data.monthlyMain.map((m) => [m.date, m.categories]))
  const years = [...new Set(data.monthlyMain.map((m) => yearOf(m.date)))].filter((y) => y <= year).sort()

  const seriesFor = (cat: string): Series[] => years.map((y) => ({
    key: `${cat}-${y}`, label: String(y), color: yearColor(y), endLabel: true, width: y === year ? 3 : 2,
    dots: y === year,
    points: Array.from({ length: 12 }, (_, m) => {
      const d = data.monthlyMain.find((r) => yearOf(r.date) === y && monthIndex(r.date) === m)?.date
      const v = d && (y < year || d <= a.date) ? byDate.get(d)?.[cat] ?? null : null
      return { x: m, y: v }
    }),
  }))

  const cats = ORDER.filter((c) => data.monthlyMain.some((m) => m.categories[c] !== undefined))

  return (
    <>
      <SectionHeading
        kicker="Hovedkategorier"
        title="Fem kategorier, tre år, samme måned"
        lead="Hver figur viser én kontingentkategori med ét år pr. kurve. Sæsonmønstret går igen fra år til år, så det interessante er afstanden mellem kurverne."
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cats.map((cat) => {
          const s = seriesFor(cat)
          const now = a.snapshot.categories[cat]
          return (
            <ChartCard
              key={cat}
              title={catLabel(cat)}
              subtitle={NOTES[cat]}
              actions={
                <span className="tnum rounded-full px-2.5 py-1 text-[0.75rem] font-semibold text-white" style={{ background: MAIN_COLORS[cat] ?? '#3a557d' }}>
                  {fmtNum(now?.now)} · {fmtSigned(now && now.ly !== null && now.now !== null ? now.now - now.ly : null)} å/å
                </span>
              }
              table={
                <DataTable
                  columns={[{ key: 'm', label: 'Måned' }, ...years.map((y) => ({ key: String(y), label: String(y), align: 'right' as const }))]}
                  rows={Array.from({ length: 12 }, (_, m) => ({
                    m: cap(MONTHS[m]),
                    ...Object.fromEntries(years.map((y) => [String(y), fmtNum(s.find((x) => x.label === String(y))?.points[m].y ?? null)])),
                  }))}
                />
              }
            >
              <Lines series={s} xLabels={MONTHS_SHORT} height={220} width={420} xTickEvery={2} tooltipTitle={(i) => cap(MONTHS[i])} padRight={44} />
            </ChartCard>
          )
        })}
      </div>
    </>
  )
}
