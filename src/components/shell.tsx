/**
 * Rammen om dashboardet: afsender, den valgte måned og navigationen.
 *
 * Månedsvælgeren er den ene kontrol, hele siden retter sig efter. Vælger man
 * en tidligere måned, viser alle sektioner tallene, som de så ud dengang —
 * det er præcis det overblik ledergruppen fik den måned.
 */
import { motion } from 'framer-motion'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { cap, monthYear, type Snapshot } from '@/lib/data'

/* ── Afsendermærke ───────────────────────────────────────────────────────── */

export function Wordmark({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] font-serif text-[0.9375rem] font-bold leading-none"
        style={{ background: onDark ? '#df790d' : '#3a557d', color: '#fff' }}
        aria-hidden="true"
      >
        DP
      </div>
      <div className="leading-none">
        <div
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.15em]"
          style={{ color: onDark ? '#aebdd4' : '#7a8798' }}
        >
          Dansk Psykolog Forening
        </div>
        <div className="mt-1 font-serif text-[0.9375rem] font-semibold" style={{ color: onDark ? '#fff' : '#16233a' }}>
          Medlemsudvikling
        </div>
      </div>
    </div>
  )
}

/* ── Månedsvælger ────────────────────────────────────────────────────────── */

export function MonthPicker({
  snapshots, value, latest, onChange,
}: {
  snapshots: Snapshot[]; value: string; latest: string; onChange: (d: string) => void
}) {
  const i = snapshots.findIndex((s) => s.date === value)
  const canPrev = i > 0
  const canNext = i >= 0 && i < snapshots.length - 1
  const isLatest = value === latest
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Forrige måned"
        disabled={!canPrev}
        onClick={() => canPrev && onChange(snapshots[i - 1].date)}
        className="grid h-8 w-8 place-items-center rounded-full border border-dp-navy-200 text-dp-navy-700 transition hover:border-dp-navy-400 disabled:opacity-30"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Vælg måned"
          className="tnum h-8 appearance-none rounded-full border border-dp-navy-200 bg-white pl-3.5 pr-8 text-[0.8125rem] font-semibold text-dp-navy-900 outline-none transition focus:border-dp-orange"
        >
          {[...snapshots].reverse().map((s) => (
            <option key={s.date} value={s.date}>Pr. {cap(monthYear(s.date))}</option>
          ))}
        </select>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"
             className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-dp-navy-500">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <button
        type="button"
        aria-label="Næste måned"
        disabled={!canNext}
        onClick={() => canNext && onChange(snapshots[i + 1].date)}
        className="grid h-8 w-8 place-items-center rounded-full border border-dp-navy-200 text-dp-navy-700 transition hover:border-dp-navy-400 disabled:opacity-30"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {!isLatest && (
        <button
          type="button"
          onClick={() => onChange(latest)}
          className="ml-1 hidden text-[0.75rem] font-semibold text-dp-orange hover:underline sm:inline"
        >
          Til nyeste
        </button>
      )}
    </div>
  )
}

/* ── Sektionsnavigation ──────────────────────────────────────────────────── */

export interface SectionDef { id: string; label: string; group?: string }

export function SectionNav({ sections }: { sections: SectionDef[] }) {
  const [active, setActive] = useState(sections[0]?.id)
  const railRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
    )
    for (const s of sections) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [sections])

  useEffect(() => {
    const rail = railRef.current
    const el = rail?.querySelector<HTMLElement>(`[data-nav="${active}"]`)
    if (!rail || !el) return
    const target = el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2
    const max = rail.scrollWidth - rail.clientWidth
    rail.scrollTo({ left: Math.max(0, Math.min(max, target)), behavior: 'smooth' })
  }, [active])

  const jumpTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    e.preventDefault()
    const header = document.querySelector('header')
    const top = target.getBoundingClientRect().top + window.scrollY - (header?.getBoundingClientRect().height ?? 0) - 8
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    history.replaceState(null, '', `#${id}`)
    setActive(id)
  }

  const [edges, setEdges] = useState({ left: false, right: false })
  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const read = () => setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
    read()
    el.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read)
    return () => { el.removeEventListener('scroll', read); window.removeEventListener('resize', read) }
  }, [sections])

  return (
    <nav aria-label="Sektioner" className="relative">
      <div ref={railRef} className="thin-scroll -mx-1 flex items-center gap-1 overflow-x-auto px-1 py-1">
        {sections.map((s, i) => (
          <Fragment key={s.id}>
            {s.group && s.group !== sections[i - 1]?.group && (
              <span className="ml-1.5 mr-0.5 flex shrink-0 items-center gap-1.5 first:ml-0">
                {i > 0 && <span className="h-4 w-px bg-dp-navy-200" aria-hidden="true" />}
                <span className="text-[0.5625rem] font-bold uppercase tracking-[0.14em] text-dp-navy-400">{s.group}</span>
              </span>
            )}
            <a
              href={`#${s.id}`}
              data-nav={s.id}
              onClick={(e) => jumpTo(e, s.id)}
              className="relative shrink-0 rounded-full px-3.5 py-1.5 text-[0.75rem] font-semibold transition-colors duration-200"
              style={{ color: active === s.id ? '#fff' : '#4a5a72' }}
            >
              {active === s.id && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-full bg-dp-navy-600"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{s.label}</span>
            </a>
          </Fragment>
        ))}
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent transition-opacity duration-300" style={{ opacity: edges.left ? 1 : 0 }} />
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent transition-opacity duration-300" style={{ opacity: edges.right ? 1 : 0 }} />
    </nav>
  )
}

/* ── Sektionsramme ───────────────────────────────────────────────────────── */

export function Section({
  id, children, tone = 'light', className = '',
}: {
  id: string; children: ReactNode; tone?: 'light' | 'sunken' | 'dark'; className?: string
}) {
  const bg = tone === 'dark' ? '#16233a' : tone === 'sunken' ? '#f4f1f1' : '#ffffff'
  return (
    <section id={id} className={`scroll-mt-[7.5rem] ${className}`} style={{ background: bg }}>
      <div className="mx-auto w-full max-w-[80rem] px-4 py-14 sm:px-6 sm:py-20">{children}</div>
    </section>
  )
}
