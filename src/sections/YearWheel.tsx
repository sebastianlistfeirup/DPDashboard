/**
 * Årshjulet — medlemsåret i én figur.
 *
 * En medlemsorganisation lever i en cirkel: optag i september, dimittender i
 * oktober, kontingentskift i juli, udmeldelser omkring nytår. Hjulet viser
 * den rytme, så spørgsmålet "hvad plejer der at ske her?" kan svares med et
 * blik.
 *
 * Vinklen er måneden. Afstanden fra midten er kongeindikatoren, så hvert år
 * bliver en spiral, der starter ved navet i januar og arbejder sig udad.
 * Langs kanten står månedens ændring i alle medlemmer som små søjler:
 * udad når vi blev flere, indad når vi blev færre.
 */
import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChartCard, SectionHeading } from '@/components/primitives'
import {
  MONTHS, MONTHS_SHORT, cap, computeMonthProfiles, fmtNum, fmtSigned, monthIndex, yearColor, yearOf,
  type AsOf, type Dashboard,
} from '@/lib/data'
import { motion as mo } from '@/design/tokens'

const SIZE = 640
const C = SIZE / 2
const R_OUT = 262
const R_MAX = 244
const R_HUB = 86
const R_MIN = R_HUB + 12

const angleAt = (m: number, frac = 0.5) => ((m + frac) / 12) * Math.PI * 2 - Math.PI / 2
const polar = (a: number, r: number) => ({ x: C + Math.cos(a) * r, y: C + Math.sin(a) * r })

function wedgePath(a0: number, a1: number, r0: number, r1: number) {
  const p1 = polar(a0, r1), p2 = polar(a1, r1), p3 = polar(a1, r0), p4 = polar(a0, r0)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M ${p1.x} ${p1.y} A ${r1} ${r1} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${r0} ${r0} 0 ${large} 0 ${p4.x} ${p4.y} Z`
}

export function YearWheel({ data, a }: { data: Dashboard; a: AsOf }) {
  const reduced = useReducedMotion()
  const year = yearOf(a.date)
  const years = Object.keys(data.konge).map(Number).filter((y) => y <= year).sort()
  const [activeYear, setActiveYear] = useState(year)
  const [ghost, setGhost] = useState<number[]>(years.filter((y) => y !== year))
  const [month, setMonth] = useState<number | null>(null)

  const pointsFor = (y: number) =>
    (data.konge[String(y)] ?? [])
      .filter((k) => k.value !== null && (y < year || k.date <= a.date))
      .map((k) => ({ m: monthIndex(k.date), v: k.value as number }))

  const shown = [activeYear, ...ghost]
  const domain = useMemo(() => {
    const vals = shown.flatMap((y) => pointsFor(y).map((p) => p.v))
    const lo = Math.min(0, ...vals)
    const hi = Math.max(50, ...vals)
    const step = hi - lo > 300 ? 100 : 50
    return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.join(','), data.konge, a.date])

  const rFor = (v: number) => R_MIN + ((v - domain.lo) / (domain.hi - domain.lo || 1)) * (R_MAX - R_MIN)

  const spiral = (y: number) => {
    const pts = pointsFor(y)
    if (!pts.length) return ''
    // Start ved nul i "0. januar" — hjulets nav — så spiralen har en begyndelse
    const start = polar(angleAt(-1, 0.5), rFor(0))
    let d = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`
    for (const p of pts) {
      const q = polar(angleAt(p.m), rFor(p.v))
      d += ` L ${q.x.toFixed(1)} ${q.y.toFixed(1)}`
    }
    return d
  }

  const profiles = useMemo(() => computeMonthProfiles(data), [data])
  const rimFor = (m: number) => profiles[m].totalDelta.find((d) => d.year === activeYear)?.value ?? null
  const maxRim = Math.max(1, ...profiles.flatMap((p) => p.totalDelta.map((d) => Math.abs(d.value))))

  const rings: number[] = []
  for (let v = domain.lo; v <= domain.hi; v += domain.step) rings.push(v)

  const activePts = pointsFor(activeYear)
  const focus = month
  const focusVal = focus !== null ? activePts.find((p) => p.m === focus)?.v ?? null : null
  const focusPrev = focus !== null ? (focus === 0 ? 0 : activePts.find((p) => p.m === focus - 1)?.v ?? null) : null
  const focusTotal = focus !== null ? data.totals.find((t) => yearOf(t.date) === activeYear && monthIndex(t.date) === focus) ?? null : null
  const lastPt = activePts[activePts.length - 1]

  const notes = useMemo(() => rhythmNotes(profiles), [profiles])

  return (
    <>
      <SectionHeading
        kicker="Årshjul"
        title="Medlemsåret har en rytme"
        lead="Vinklen er måneden, afstanden fra midten er kongeindikatoren. Hvert år er en spiral fra navet i januar og udad. Søjlerne langs kanten er månedens ændring i alle medlemmer: grøn når vi blev flere, rød når vi blev færre."
      />
      <ChartCard
        title={`Kongeindikatoren gennem året, ${activeYear}`}
        subtitle="Peg på en måned for at se dens tal. De grå spiraler er de andre år."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {years.map((y) => (
              <button key={y} type="button" aria-pressed={y === activeYear}
                      onClick={() => { setActiveYear(y); setGhost(years.filter((x) => x !== y)); setMonth(null) }}
                      className={`tnum rounded-full border px-3 py-1 text-[0.6875rem] font-semibold transition ${y === activeYear ? 'border-dp-navy-600 bg-dp-navy-600 text-white' : 'border-dp-navy-100 text-dp-navy-600 hover:border-dp-navy-300'}`}>
                {y}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="relative mx-auto w-full max-w-[40rem]">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" role="img" aria-label={`Årshjul for ${activeYear}`}>
              <defs>
                <radialGradient id="mw-hub" cx="50%" cy="42%" r="62%">
                  <stop offset="0%" stopColor="#2a4368" />
                  <stop offset="100%" stopColor="#16233a" />
                </radialGradient>
              </defs>

              {MONTHS.map((_, i) => {
                const active = focus === i
                return (
                  <motion.path
                    key={`w-${i}`}
                    d={wedgePath(angleAt(i, 0), angleAt(i, 1), R_HUB, R_OUT)}
                    stroke="#f0f3f6" strokeWidth="1" className="cursor-pointer"
                    animate={{ fill: active ? '#e4eaf6' : i % 2 === 0 ? '#fbfcfd' : '#ffffff' }}
                    transition={{ duration: 0.25 }}
                    onMouseEnter={() => setMonth(i)}
                    onMouseLeave={() => setMonth((m) => (m === i ? null : m))}
                    onClick={() => setMonth((m) => (m === i ? null : i))}
                  />
                )
              })}

              {rings.map((v, i) => {
                const r = rFor(v)
                const p = polar(-Math.PI / 2 - 0.3, r)
                return (
                  <g key={`r-${v}`}>
                    <circle cx={C} cy={C} r={r} fill="none" stroke={v === 0 ? '#aebdd4' : '#dde3e9'} strokeWidth={v === 0 ? 1.4 : 1}
                            strokeDasharray={i === rings.length - 1 || v === 0 ? '0' : '3 5'} />
                    <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fill="#8b98a8" fontWeight="700"
                          stroke="#fff" strokeWidth="3.2" paintOrder="stroke" className="tnum">
                      {fmtSigned(v)}
                    </text>
                  </g>
                )
              })}

              {/* Månedens ændring i alle medlemmer, langs kanten */}
              {MONTHS.map((_, i) => {
                const v = rimFor(i)
                if (v === null) return null
                const h = 3 + (Math.abs(v) / maxRim) * 22
                const a0 = angleAt(i, 0.08), a1 = angleAt(i, 0.92)
                return (
                  <motion.path
                    key={`rim-${i}`}
                    d={wedgePath(a0, a1, R_OUT + 3, R_OUT + 3 + h)}
                    fill={v >= 0 ? (focus === i ? '#179fa0' : '#c4dcdb') : (focus === i ? '#d24e46' : '#f1c7bb')}
                    initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 + i * 0.02 }}
                  >
                    <title>{`${cap(MONTHS[i])} ${activeYear}: ${fmtSigned(v)} medlemmer`}</title>
                  </motion.path>
                )
              })}

              {ghost.map((y) => (
                <motion.path key={`g-${y}`} d={spiral(y)} fill="none" stroke={yearColor(y)} strokeWidth="1.75" opacity="0.55"
                             strokeLinejoin="round" strokeLinecap="round"
                             initial={reduced ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }}
                             transition={{ duration: 1.2, ease: mo.ease }} />
              ))}
              {ghost.map((y) => {
                const p = pointsFor(y)
                const last = p[p.length - 1]
                if (!last) return null
                const q = polar(angleAt(last.m), rFor(last.v))
                return <text key={`gl-${y}`} x={q.x} y={q.y} dx={8} dy="0.32em" fontSize="10" fontWeight="700" fill={yearColor(y)} className="tnum">{y}</text>
              })}

              <motion.path d={spiral(activeYear)} fill="none" stroke={yearColor(activeYear) === '#8299bb' ? '#3a557d' : yearColor(activeYear)} strokeWidth="3.25"
                           strokeLinejoin="round" strokeLinecap="round"
                           initial={reduced ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }}
                           transition={{ duration: 1.6, ease: mo.ease, delay: 0.2 }} />
              {activePts.map((p) => {
                const q = polar(angleAt(p.m), rFor(p.v))
                const hot = focus === p.m
                return (
                  <g key={`p-${p.m}`}>
                    {hot && <line x1={C} y1={C} x2={q.x} y2={q.y} stroke="#df790d" strokeWidth="1" opacity="0.4" />}
                    <circle cx={q.x} cy={q.y} r={hot ? 6.5 : 4.5} fill={hot ? '#df790d' : '#fff'} stroke="#df790d" strokeWidth="2" />
                  </g>
                )
              })}

              {MONTHS_SHORT.map((label, i) => {
                const p = polar(angleAt(i), R_OUT + 42)
                return (
                  <text key={`l-${i}`} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700"
                        letterSpacing="0.1em" fill={focus === i ? '#16233a' : '#8299bb'} className="pointer-events-none select-none">
                    {label.toUpperCase()}
                  </text>
                )
              })}

              <circle cx={C} cy={C} r={R_HUB} fill="url(#mw-hub)" />
              <motion.circle cx={C} cy={C} r={R_HUB} fill="none" stroke="#df790d" strokeWidth="1.5"
                             animate={reduced ? {} : { r: [R_HUB, R_HUB + 9, R_HUB], opacity: [0.5, 0, 0.5] }}
                             transition={{ duration: 3.4, repeat: Infinity, ease: 'easeOut' }} />
              <text x={C} y={C - 26} textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="0.14em" fill="#8299bb">
                {focus !== null ? MONTHS[focus].toUpperCase() : `${activeYear}`}
              </text>
              <text x={C} y={C + 6} textAnchor="middle" fontSize="30" fontWeight="700" fill="#fff" fontFamily="IBM Plex Serif, Georgia, serif" className="tnum">
                {focus !== null ? fmtSigned(focusVal) : fmtSigned(lastPt?.v ?? null)}
              </text>
              <text x={C} y={C + 28} textAnchor="middle" fontSize="10.5" fill="#aebdd4">
                {focus !== null
                  ? (focusVal !== null && focusPrev !== null ? `${fmtSigned(focusVal - focusPrev)} i måneden` : 'ingen tal')
                  : 'kongeindikator'}
              </text>
              <text x={C} y={C + 46} textAnchor="middle" fontSize="10.5" fill="#8299bb" className="tnum">
                {focus !== null && focusTotal ? `${fmtNum(focusTotal.total)} medlemmer` : lastPt ? `pr. ${cap(MONTHS[lastPt.m])}` : ''}
              </text>
            </svg>
          </div>

          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={`m-${focus ?? 'all'}-${activeYear}`}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: mo.ease }}
                className="rounded-2xl border border-dp-navy-100 bg-dp-navy-50 p-4"
              >
                <p className="font-serif text-[1.0625rem] font-semibold text-dp-navy-900">
                  {focus !== null ? `${cap(MONTHS[focus])} ${activeYear}` : `Hele ${activeYear}`}
                </p>
                <dl className="mt-3 space-y-2">
                  {focus !== null ? (
                    <>
                      <Row label="Kongeindikator" value={fmtSigned(focusVal)} />
                      <Row label="Ændring i måneden" value={focusVal !== null && focusPrev !== null ? fmtSigned(focusVal - focusPrev) : '–'} />
                      <Row label="Alle medlemmer" value={focusTotal ? fmtNum(focusTotal.total) : '–'} />
                      <Row label="Ændring i alle" value={fmtSigned(rimFor(focus))} />
                      <Row label={`Samme måned, andre år`} value={profiles[focus].kongeStep.filter((k) => k.year !== activeYear).map((k) => `${k.year}: ${fmtSigned(k.value)}`).join(' · ') || '–'} small />
                    </>
                  ) : (
                    <>
                      <Row label="Kongeindikator nu" value={fmtSigned(lastPt?.v ?? null)} />
                      <Row label="Måneder med tal" value={String(activePts.length)} />
                      <Row label="Bedste måned" value={best(activePts)} />
                    </>
                  )}
                </dl>
                <p className="mt-3 border-t border-dp-navy-200/60 pt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">
                  {focus !== null ? 'Klik på måneden igen for at slippe den.' : 'Peg på en måned for at fremhæve den.'}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-4 rounded-2xl border border-dp-navy-100 bg-white p-4">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-dp-navy-400">Årets rytme</p>
              <ul className="mt-2.5 space-y-2 text-[0.8125rem] text-dp-navy-700">
                {notes.map((n) => (
                  <li key={n} className="flex gap-2">
                    <span className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-dp-orange" />
                    <span className="leading-snug">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </ChartCard>
    </>
  )
}

function Row({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[0.8125rem] text-dp-navy-600">{label}</dt>
      <dd className={`tnum text-right font-semibold text-dp-navy-900 ${small ? 'text-[0.75rem]' : 'text-[0.9375rem]'}`}>{value}</dd>
    </div>
  )
}

function best(pts: { m: number; v: number }[]) {
  if (!pts.length) return '–'
  let bestM = pts[0].m, bestD = pts[0].v
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i].v - pts[i - 1].v
    if (d > bestD) { bestD = d; bestM = pts[i].m }
  }
  return `${cap(MONTHS[bestM])} (${fmtSigned(bestD)})`
}

/** Hvad hjulet viser, sagt med ord — regnet ud fra alle år vi har. */
function rhythmNotes(profiles: ReturnType<typeof computeMonthProfiles>) {
  const avg = (xs: { value: number }[]) => (xs.length ? xs.reduce((s, x) => s + x.value, 0) / xs.length : null)
  const stepAvg = profiles.map((p) => ({ m: p.month, v: avg(p.kongeStep), n: p.kongeStep.length })).filter((x) => x.v !== null && x.n >= 2)
  const totalAvg = profiles.map((p) => ({ m: p.month, v: avg(p.totalDelta), n: p.totalDelta.length })).filter((x) => x.v !== null && x.n >= 1)
  const notes: string[] = []
  if (stepAvg.length) {
    const top = [...stepAvg].sort((a, b) => b.v! - a.v!)[0]
    notes.push(`${cap(MONTHS[top.m])} er kongeindikatorens store måned: i gennemsnit ${fmtSigned(Math.round(top.v!))} fuldtidsbetalende, når kandidaterne skifter kontingent.`)
    const low = [...stepAvg].sort((a, b) => a.v! - b.v!)[0]
    if (low.v! <= -10) notes.push(`${cap(MONTHS[low.m])} trækker typisk ned (${fmtSigned(Math.round(low.v!))}), når årets udmeldelser slår igennem.`)
  }
  if (totalAvg.length) {
    const top = [...totalAvg].sort((a, b) => b.v! - a.v!)[0]
    notes.push(`Flest nye medlemmer kommer i ${MONTHS[top.m]} (${fmtSigned(Math.round(top.v!))} i alt) — det er studieoptaget.`)
    const low = [...totalAvg].sort((a, b) => a.v! - b.v!)[0]
    if (low.v! < 0) notes.push(`Medlemstallet falder oftest i ${MONTHS[low.m]} (${fmtSigned(Math.round(low.v!))}).`)
  }
  return notes
}
