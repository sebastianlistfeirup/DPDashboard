/**
 * Medlemsdashboard for Dansk Psykolog Forening.
 *
 * Én side, i den rækkefølge mailen til ledergruppen altid har haft: hvad
 * skete der, kongeindikatoren, kandidaterne — og så hele baggrunden.
 */
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { MonthPicker, Section, SectionNav, Wordmark, type SectionDef } from '@/components/shell'
import { Hero } from '@/sections/Hero'
import { Konge } from '@/sections/Konge'
import { Goal } from '@/sections/Goal'
import { MainCats } from '@/sections/MainCats'
import { YearWheel } from '@/sections/YearWheel'
import { Categories } from '@/sections/Categories'
import { DataNeeds, Sections } from '@/sections/Movements'
import { Flows } from '@/sections/Flows'
import { Retention } from '@/sections/Retention'
import { Members } from '@/sections/Members'
import { useMovements } from '@/lib/movements'
import { computeGoal, ddmmyy, useAsOf, useDashboard } from '@/lib/data'
import { motion as mo } from '@/design/tokens'

const SECTIONS: SectionDef[] = [
  { id: 'status', label: 'Status', group: 'Overblik' },
  { id: 'kongeindikator', label: 'Kongeindikator', group: 'Overblik' },
  { id: 'maal', label: 'Mål 2029', group: 'Udvikling' },
  { id: 'hovedkategorier', label: 'Hovedkategorier', group: 'Udvikling' },
  { id: 'aarshjul', label: 'Årshjul', group: 'Udvikling' },
  { id: 'kategorier', label: 'Alle kategorier', group: 'Segmenter' },
  { id: 'sektioner', label: 'Sektioner', group: 'Segmenter' },
  { id: 'medlemmerne', label: 'Medlemmerne', group: 'Segmenter' },
  { id: 'bevaegelser', label: 'Ind og ud', group: 'Bevægelser' },
  { id: 'frafald', label: 'Frafald', group: 'Bevægelser' },
  { id: 'data', label: 'Næste skridt', group: 'Bevægelser' },
]

/** Den valgte måned lever i URL'en, så et link til "april" viser april. */
function useMonthParam(latest: string | null) {
  const read = () => new URLSearchParams(window.location.search).get('m')
  const [m, setM] = useState<string | null>(read)
  const set = (d: string) => {
    setM(d)
    const url = new URL(window.location.href)
    if (latest && d === latest) url.searchParams.delete('m')
    else url.searchParams.set('m', d)
    history.replaceState(null, '', url.toString())
  }
  return [m, set] as const
}

export default function App() {
  const { data, error, embedded } = useDashboard()
  const { mov } = useMovements()
  const [month, setMonth] = useMonthParam(data?.meta.latest ?? null)
  const a = useAsOf(data, month)
  const goal = useMemo(() => (data && a ? computeGoal(data, a) : null), [data, a])

  useEffect(() => {
    if (a) document.title = `Medlemsudvikling pr. ${ddmmyy(a.date)} · Dansk Psykolog Forening`
  }, [a])

  if (error && !data) return <LoadError message={error} />
  if (!data || !a || !goal) return <Splash />

  return (
    <div className="min-h-screen overflow-x-clip bg-white">
      <header className="sticky top-0 z-50 border-b border-dp-navy-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[80rem] px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
            <Wordmark />
            <div className="flex flex-wrap items-center gap-3">
              <MonthPicker snapshots={data.snapshots} value={a.date} latest={data.meta.latest} onChange={setMonth} />
              <span className="hidden text-[0.75rem] text-dp-navy-500 lg:inline">
                {embedded ? 'Fast øjebliksbillede' : `Nyeste tal: ${ddmmyy(data.meta.latest)}`}
              </span>
            </div>
          </div>
          <div className="border-t border-dp-navy-50 py-2">
            <SectionNav sections={SECTIONS} />
          </div>
        </div>
      </header>

      <main>
        <div id="status" className="scroll-mt-[7.5rem]">
          <Hero data={data} a={a} goal={goal} />
        </div>
        <Section id="kongeindikator"><Konge data={data} a={a} /></Section>
        <Section id="maal" tone="dark"><Goal data={data} a={a} goal={goal} /></Section>
        <Section id="hovedkategorier"><MainCats data={data} a={a} /></Section>
        <Section id="aarshjul" tone="sunken"><YearWheel data={data} a={a} /></Section>
        <Section id="kategorier"><Categories data={data} a={a} /></Section>
        <Section id="sektioner" tone="sunken"><Sections data={data} a={a} /></Section>
        {mov && <Section id="medlemmerne"><Members mov={mov} /></Section>}
        {mov && <Section id="bevaegelser" tone="sunken"><Flows mov={mov} a={a} /></Section>}
        {mov && <Section id="frafald" tone="dark"><Retention mov={mov} a={a} /></Section>}
        <Section id="data" tone="sunken"><DataNeeds data={data} /></Section>
      </main>

      <footer className="border-t border-dp-navy-100 bg-white">
        <div className="mx-auto flex w-full max-w-[80rem] flex-wrap items-center justify-between gap-4 px-4 py-8 text-[0.75rem] text-dp-navy-500 sm:px-6">
          <Wordmark />
          <p className="max-w-xl leading-relaxed">
            Tallene kommer fra de månedlige udtræk af medlemssystemet ({data.meta.months} måneder, {ddmmyy(data.meta.first)} → {ddmmyy(data.meta.latest)}).
            Data samlet {new Date(data.meta.generatedAt).toLocaleString('da-DK', { dateStyle: 'medium', timeStyle: 'short' })}.
            Ingen persondata — kun optællinger.
          </p>
        </div>
      </footer>
    </div>
  )
}

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-white">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: mo.base, ease: mo.ease }} className="text-center">
        <Wordmark />
        <p className="mt-6 text-[0.8125rem] text-dp-navy-500">Henter medlemstal…</p>
      </motion.div>
    </div>
  )
}

function LoadError({ message }: { message: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-white px-4">
      <div className="card max-w-md p-6 text-center">
        <Wordmark />
        <h1 className="mt-5 text-[1.125rem] font-semibold text-dp-navy-900">Kunne ikke hente medlemstallene</h1>
        <p className="mt-2 text-[0.875rem] text-dp-navy-600">{message}. Filen data/members.json mangler eller kunne ikke læses. Kør <code className="rounded bg-dp-navy-50 px-1">python3 scripts/build_data.py</code> og udgiv igen.</p>
      </div>
    </div>
  )
}
