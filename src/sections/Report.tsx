/**
 * Månedens tekst — den mail, Sebastian plejer at skrive, skrevet af tallene.
 * Vises, kopieres, sendes af et menneske. Siden sender intet selv.
 */
import { useMemo, useState } from 'react'
import { SectionHeading } from '@/components/primitives'
import { buildReport } from '@/lib/report'
import { cap, monthYear, type AsOf, type Dashboard, type GoalPath } from '@/lib/data'

export function Report({ data, a, goal }: { data: Dashboard; a: AsOf; goal: GoalPath }) {
  const report = useMemo(() => buildReport(data, a, goal), [data, a, goal])
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report.text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard kan være lukket — teksten står stadig på siden */ }
  }
  return (
    <>
      <SectionHeading
        kicker="Månedens tekst"
        title={`Status på medlemsudviklingen, ${monthYear(a.date)}`}
        lead="Skrevet ud fra de samme tal som graferne, i samme form som de mails ledergruppen kender. Læs den igennem, ret hvad der skal rettes, og send den selv."
        right={
          <button type="button" onClick={copy}
                  className="inline-flex items-center gap-2 rounded-full bg-dp-navy-600 px-4 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-dp-navy-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {copied ? 'Kopieret' : 'Kopiér teksten'}
          </button>
        }
      />
      <article className="card mx-auto max-w-3xl p-6 sm:p-8">
        <p className="text-[0.8125rem] text-dp-navy-500">Emne: <span className="font-semibold text-dp-navy-800">{report.subject}</span></p>
        <p className="mt-5 text-[0.9375rem] text-dp-navy-900">Kære alle</p>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-dp-navy-800">Så er det tid til en kort status på medlemsudviklingen i {monthYear(a.date).split(' ')[0]}.</p>
        <dl className="mt-5 space-y-4">
          {report.paragraphs.map((p) => (
            <div key={p.title}>
              <dt className="font-semibold text-dp-navy-900">{cap(p.title)}:</dt>
              <dd className="mt-0.5 text-[0.9375rem] leading-relaxed text-dp-navy-800">{p.body}</dd>
            </div>
          ))}
        </dl>
      </article>
    </>
  )
}
