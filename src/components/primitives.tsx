/**
 * Shared building blocks, all drawn from the designmanual's graphic language:
 * a big number over a horizontal band (side 14), centred labels, tone-in-tone
 * colour pairs (side 10), and the kicker rule above a heading.
 */
import {
  motion,
  useInView,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import {
  createContext, useContext, useEffect, useId, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react'
import { dp, ink, motion as mo } from '@/design/tokens'

/* ── Reveal ────────────────────────────────────────────────────────────────
 * One entrance for the whole dashboard: rise and fade, once, on first view.
 */
export function Reveal({
  children, delay = 0, y = 18, className, as = 'div',
}: {
  children: ReactNode; delay?: number; y?: number; className?: string; as?: 'div' | 'section' | 'li'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-12% 0px -8% 0px' })
  const reduced = useReducedMotion()
  const Tag = motion[as]
  return (
    <Tag
      ref={ref as never}
      className={className}
      initial={reduced ? false : { opacity: 0, y }}
      animate={inView || reduced ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: mo.base, ease: mo.ease, delay }}
    >
      {children}
    </Tag>
  )
}

/* ── Count-up ──────────────────────────────────────────────────────────────
 * Numbers arrive by counting, which is what makes a KPI feel alive. The value
 * is still rendered as text, so it is selectable and readable by assistive tech.
 */
export function useCountUp(value: number, { duration = 1.2 }: { duration?: number } = {}) {
  const reduced = useReducedMotion()
  const spring = useSpring(0, { duration: duration * 1000, bounce: 0 })
  useEffect(() => { spring.set(reduced ? value : value) }, [value, spring, reduced])
  useEffect(() => { if (reduced) spring.jump(value) }, [reduced, value, spring])
  return spring
}

export function AnimatedNumber({
  value, decimals = 0, suffix = '', prefix = '', className, duration = 1.2,
}: {
  value: number; decimals?: number; suffix?: string; prefix?: string; className?: string; duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(reduced ? value : 0)

  useEffect(() => {
    if (!inView) return
    if (reduced) { setShown(value); return }
    let raf = 0
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000))
      // Same decelerating feel as the CSS easing, approximated for JS.
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(from + (value - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, duration, reduced])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {shown.toLocaleString('da-DK', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  )
}

/* ── Bånd ──────────────────────────────────────────────────────────────────
 * The manual's signature infographic: a single figure sitting on a horizontal
 * band whose filled length *is* the proportion. Everything is centred.
 */
export function Band({
  value, max = 100, color, track, height = 10, className, delay = 0, rounded = true,
}: {
  value: number; max?: number; color: string; track?: string
  height?: number; className?: string; delay?: number; rounded?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-30px' })
  const reduced = useReducedMotion()
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div
      ref={ref}
      className={className}
      style={{ height, background: track ?? dp.lysBlaa, borderRadius: rounded ? height : 0, overflow: 'hidden' }}
      role="presentation"
    >
      <motion.div
        style={{ height: '100%', background: color, borderRadius: rounded ? height : 0, transformOrigin: 'left center' }}
        initial={reduced ? { scaleX: pct } : { scaleX: 0 }}
        animate={inView ? { scaleX: pct } : undefined}
        transition={{ duration: mo.slow, ease: mo.ease, delay }}
      />
    </div>
  )
}

/**
 * A two-part band, as on side 14 where 68 % orange sits against 32 % white.
 * Segments keep a 2px surface gap so adjacent fills never touch.
 */
export function SplitBand({
  segments, height = 12, className, delay = 0,
}: {
  segments: { value: number; color: string; label?: string }[]
  height?: number; className?: string; delay?: number
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  return (
    <div className={`flex w-full overflow-hidden rounded-full ${className ?? ''}`} style={{ height }}>
      {segments.map((s, i) => (
        <motion.div
          key={i}
          title={s.label}
          style={{ background: s.color, marginLeft: i ? 2 : 0 }}
          initial={{ width: 0 }}
          whileInView={{ width: `${(s.value / total) * 100}%` }}
          viewport={{ once: true, margin: '-30px' }}
          transition={{ duration: mo.slow, ease: mo.ease, delay: delay + i * 0.06 }}
        />
      ))}
    </div>
  )
}

/* ── Hero-tal ──────────────────────────────────────────────────────────────
 * "Fremstil dine tal dramatisk store" — designmanualen, side 27.
 */
export function HeroStat({
  value, suffix, decimals = 0, label, sub, color, share, onDark = false, delay = 0,
}: {
  value: number; suffix?: string; decimals?: number
  label: string; sub?: string; color: string; share?: number
  onDark?: boolean; delay?: number
}) {
  return (
    <Reveal delay={delay} className="text-center">
      <div
        className="font-serif font-semibold leading-none tracking-tightest tnum"
        style={{ color, fontSize: 'clamp(2.5rem, 5.5vw, 4rem)' }}
      >
        <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
      </div>
      {share !== undefined && (
        <Band
          value={share}
          color={color}
          track={onDark ? 'rgba(255,255,255,0.16)' : dp.lysBlaa}
          height={8}
          className="mx-auto mt-3 w-full max-w-[13rem]"
          delay={delay + 0.15}
        />
      )}
      <div
        className="mt-3 text-[0.9375rem] font-semibold"
        style={{ color: onDark ? ink.onDark : ink.primary }}
      >
        {label}
      </div>
      {sub && (
        <div className="mt-1 text-[0.8125rem]" style={{ color: onDark ? ink.onDarkSecondary : ink.muted }}>
          {sub}
        </div>
      )}
    </Reveal>
  )
}

/* ── Sektionsoverskrift ────────────────────────────────────────────────────*/
export function SectionHeading({
  kicker, title, lead, color, onDark = false, right,
}: {
  kicker: string; title: string; lead?: string; color?: string; onDark?: boolean
  right?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="max-w-2xl">
        <div className="kicker" style={{ color: color ?? (onDark ? '#8299bb' : '#df790d') }}>
          {kicker}
        </div>
        <h2
          className="mt-3 text-display-md font-semibold"
          style={{ color: onDark ? ink.onDark : ink.primary }}
        >
          {title}
        </h2>
        {lead && (
          <p
            className="mt-3 text-[0.9375rem] leading-relaxed"
            style={{ color: onDark ? ink.onDarkSecondary : ink.secondary }}
          >
            {lead}
          </p>
        )}
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </div>
  )
}

/* ── Badge ─────────────────────────────────────────────────────────────────*/
export function Badge({
  children, color, soft, style, className = '',
}: {
  children: ReactNode; color: string; soft?: string; style?: CSSProperties; className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold ${className}`}
      style={{ background: soft ?? `${color}1f`, color, ...style }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      {children}
    </span>
  )
}

/* ── Tooltip-lag til grafer ────────────────────────────────────────────────
 * A single shared tooltip renderer so every chart's hover layer looks alike.
 */
export interface TooltipRow { label: string; value: string; color?: string }

export function ChartTooltip({
  x, y, title, rows, containerWidth,
}: {
  x: number; y: number; title: string; rows: TooltipRow[]; containerWidth: number
}) {
  const flip = x > containerWidth - 190
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[9.5rem] rounded-xl border border-dp-navy-100 bg-white px-3 py-2.5 shadow-card backdrop-blur"
      style={{ left: flip ? x - 12 : x + 12, top: y, transform: `translate(${flip ? '-100%' : '0'}, -50%)` }}
    >
      <div className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-dp-navy-500">
        {title}
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-[1px]">
          <span className="flex items-center gap-1.5 text-[0.8125rem] text-dp-navy-700">
            {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="tnum text-[0.8125rem] font-semibold text-dp-navy-900">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Chart frame ───────────────────────────────────────────────────────────
 * Wraps a chart with its title, legend and an optional table view, so the
 * "identity is never colour alone" rule has one place to live.
 */
const TableViewContext = createContext(false)
export const useTableView = () => useContext(TableViewContext)

export function ChartCard({
  title, subtitle, legend, children, table, className = '', actions,
}: {
  title: string; subtitle?: string
  legend?: { label: string; color: string; dashed?: boolean }[]
  children: ReactNode
  table?: ReactNode
  className?: string
  actions?: ReactNode
}) {
  const [showTable, setShowTable] = useState(false)
  const id = useId()
  return (
    <section className={`card p-5 sm:p-6 ${className}`} aria-labelledby={id}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h3 id={id} className="text-[1.0625rem] font-semibold text-dp-navy-900">{title}</h3>
          {subtitle && <p className="mt-1 text-[0.8125rem] leading-snug text-dp-navy-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2.5">
          {actions}
          {table && (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="rounded-full border border-dp-navy-100 px-3 py-1 text-[0.6875rem] font-semibold text-dp-navy-600 transition hover:border-dp-navy-300 hover:text-dp-navy-900"
              aria-pressed={showTable}
            >
              {showTable ? 'Vis graf' : 'Vis tal'}
            </button>
          )}
        </div>
      </header>

      {legend && legend.length > 1 && (
        <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5 text-[0.75rem] text-dp-navy-600">
              {l.dashed
                ? <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: l.color }} />
                : <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: l.color }} />}
              {l.label}
            </li>
          ))}
        </ul>
      )}

      <TableViewContext.Provider value={showTable}>
        {showTable && table ? table : children}
      </TableViewContext.Provider>
    </section>
  )
}

/** Small helper for chart axes: a recessive gridline. */
export const gridStroke = '#e7ebef'
export const axisText = '#7a8798'

export type { MotionValue, useTransform }
