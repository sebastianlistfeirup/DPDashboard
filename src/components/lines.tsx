/**
 * Linjediagram til medlemstal.
 *
 * Adskiller sig fra Ungapped-dashboardets LineChart på tre punkter, som
 * medlemstal kræver: aksen må gerne starte under nul (kongeindikatoren kan
 * være negativ i januar) og over nul (13.000 medlemmer på en akse fra nul er
 * en flad streg), en serie kan være stiplet (fremskrivning), og hver serie
 * kan få sit navn stående ved sit sidste punkt, så man ikke skal slå op i en
 * signaturforklaring for at se hvilket år der er hvilket.
 */
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChartTooltip, axisText, gridStroke, type TooltipRow } from './primitives'
import { motion as mo } from '@/design/tokens'
import { fmtNum } from '@/lib/data'

export interface Series {
  key: string
  label: string
  color: string
  /** x er en indeksposition (0..n-1) eller en streng blandt xs */
  points: { x: number; y: number | null }[]
  dashed?: boolean
  width?: number
  /** Skriv navnet ved sidste punkt */
  endLabel?: boolean
  /** Kortere navn til smalle skærme */
  shortLabel?: string
  /** Markér hvert punkt med en prik */
  dots?: boolean
  area?: boolean
}

export interface RefLine { y: number; label: string; color?: string; dashed?: boolean }
export interface RefBand { x0: number; x1: number; label?: string; color?: string }
export interface XMark { x: number; label: string; color?: string }

/**
 * Grafernes tegneflade følger skærmen. På en telefon er 760 enheder på 340 px
 * ulæseligt: teksten bliver 5 px. Så måles rammen, og på smalle skærme
 * tegnes der på en smallere flade, hvor tal og etiketter beholder deres
 * størrelse.
 */
function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setW(el.clientWidth)
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

/**
 * Én lytter pr. graf, på rammen om den. Safari på iPhone fyrer ikke
 * IntersectionObserver pålideligt på elementer inde i en <svg>, så en
 * whileInView på selve stregen kan lade den stå utegnet. Rammen er et
 * almindeligt HTML-element, og det virker overalt.
 */
function useSeen(ref: React.RefObject<HTMLDivElement | null>) {
  const inView = useInView(ref, { once: true, margin: '-40px' })
  // Sikkerhedsnet: skulle observeren aldrig fyre (gamle browsere, print), tegnes
  // grafen alligevel efter et par sekunder. Hellere en graf uden animation end ingen graf.
  const [forced, setForced] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setForced(true), 3500)
    return () => window.clearTimeout(id)
  }, [])
  return inView || forced
}

function niceStep(span: number, count: number) {
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10
}

export function Lines({
  series, xLabels, height = 280, valueFormat = fmtNum, yMin, yMax, zeroLine = true,
  refLines = [], bands = [], xMarks = [], tooltipTitle, xTickEvery, padRight, width,
}: {
  series: Series[]
  /** Etiketter for hver indeksposition på x-aksen */
  xLabels: string[]
  height?: number
  valueFormat?: (n: number | null) => string
  yMin?: number
  yMax?: number
  zeroLine?: boolean
  refLines?: RefLine[]
  bands?: RefBand[]
  xMarks?: XMark[]
  tooltipTitle?: (i: number) => string
  xTickEvery?: number
  padRight?: number
  /** viewBox-bredde. Smallere kort skal have et smallere viewBox, ellers bliver teksten bittesmå. */
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
  const reduced = useReducedMotion()
  const cw = useContainerWidth(ref)
  const seen = useSeen(ref)
  const narrow = cw > 0 && cw < 600

  const n = xLabels.length
  const anyEnd = series.some((s) => s.endLabel)
  const W = width ?? (narrow ? 440 : 760)
  const pad = { top: 18, right: narrow ? Math.min(padRight ?? 96, anyEnd ? 64 : 12) : (padRight ?? (anyEnd ? 96 : 18)), bottom: 28, left: 48 }
  // Højden følger bredden, så grafen ikke får tomrum over og under sig på små skærme.
  const H = narrow ? Math.round(height * 0.9) : height
  const innerH = H - pad.top - pad.bottom

  const domain = useMemo(() => {
    const vals = series.flatMap((s) => s.points.map((p) => p.y)).filter((v): v is number => v !== null)
    for (const r of refLines) vals.push(r.y)
    let lo = yMin ?? Math.min(...vals)
    let hi = yMax ?? Math.max(...vals)
    if (yMin === undefined && lo > 0 && lo / hi > 0.6) {
      // Tæt sammenpressede tal: zoom ind i stedet for at vise en flad linje
      const spread = hi - lo
      lo = lo - spread * 0.25
    } else if (yMin === undefined) {
      lo = Math.min(0, lo)
    }
    if (yMax === undefined) hi = hi + (hi - lo) * 0.08
    if (hi === lo) hi = lo + 1
    const step = niceStep(hi - lo, 5)
    lo = Math.floor(lo / step) * step
    hi = Math.ceil(hi / step) * step
    const ticks: number[] = []
    for (let v = lo; v <= hi + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000)
    return { lo, hi, ticks }
  }, [series, refLines, yMin, yMax])

  // Venstre margin følger de bredeste aksetal — "16.000" skal kunne stå der.
  pad.left = 14 + Math.max(...domain.ticks.map((t) => fmtNum(t).length)) * 6.6
  const innerW = W - pad.left - pad.right
  const xAt = (i: number) => (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const yAt = (y: number) => innerH - ((y - domain.lo) / (domain.hi - domain.lo)) * innerH

  const pathFor = (s: Series) => {
    let d = ''
    let open = false
    for (const p of s.points) {
      if (p.y === null) { open = false; continue }
      d += `${open ? 'L' : 'M'}${xAt(p.x).toFixed(1)},${yAt(p.y).toFixed(1)} `
      open = true
    }
    return d
  }
  const areaFor = (s: Series) => {
    const pts = s.points.filter((p) => p.y !== null)
    if (pts.length < 2) return ''
    const base = yAt(Math.max(domain.lo, 0))
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${xAt(p.x).toFixed(1)},${yAt(p.y!).toFixed(1)}`).join(' ')
    return `${line} L${xAt(pts[pts.length - 1].x).toFixed(1)},${base} L${xAt(pts[0].x).toFixed(1)},${base} Z`
  }

  // Etiketter kan være tynde (kun december i en månedsakse); trin regnes på dem der findes.
  const labelled = xLabels.map((l, i) => (l ? i : -1)).filter((i) => i >= 0)
  const maxLabels = narrow ? 6 : 12
  const every = xTickEvery ?? Math.max(1, Math.ceil(labelled.length / maxLabels))
  const stepK = narrow ? Math.max(every, Math.ceil(labelled.length / maxLabels)) : every
  // Tælles bagfra, så den sidste etiket altid er med og afstanden er jævn — ingen to oven i hinanden.
  const showLabel = new Set(labelled.filter((_, k) => (labelled.length - 1 - k) % stepK === 0))

  const onMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = ((e.clientX - rect.left) / rect.width) * innerW
    const i = Math.round((rel / innerW) * (n - 1))
    if (i >= 0 && i < n) setHover({ i, x: pad.left + xAt(i), y: pad.top + innerH / 2 })
  }, [innerW, innerH, n, pad.left, pad.top])

  const containerWidth = ref.current?.clientWidth ?? W
  const rows: TooltipRow[] = hover
    ? series.map((s) => {
        const p = s.points.find((q) => Math.abs(q.x - hover.i) < 0.5)
        return { label: s.label, value: valueFormat(p?.y ?? null), color: s.color }
      }).filter((r) => r.value !== '–')
    : []

  // Slutetiketter må ikke ligge oven i hinanden
  const endLabels = useMemo(() => {
    const items = series.filter((s) => s.endLabel).map((s) => {
      const last = [...s.points].reverse().find((p) => p.y !== null)
      return last ? { s, x: xAt(last.x), y: yAt(last.y!) } : null
    }).filter((v): v is { s: Series; x: number; y: number } => v !== null)
      .sort((a, b) => a.y - b.y)
    for (let i = 1; i < items.length; i++) {
      if (items[i].y - items[i - 1].y < 14) items[i].y = items[i - 1].y + 14
    }
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, domain, n])

  return (
    <div ref={ref} className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ height: 'auto', aspectRatio: `${W} / ${H}` }} role="img" aria-label="Udvikling over tid">
        <defs>
          {series.filter((s) => s.area).map((s) => (
            <linearGradient key={`g-${s.key}`} id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>
        <g transform={`translate(${pad.left},${pad.top})`}>
          {bands.map((b, i) => (
            <g key={`band-${i}`}>
              <rect x={xAt(b.x0)} y={0} width={Math.max(0, xAt(b.x1) - xAt(b.x0))} height={innerH}
                    fill={b.color ?? '#df790d'} opacity={0.07} />
              {b.label && (
                <text x={(xAt(b.x0) + xAt(b.x1)) / 2} y={-6} textAnchor="middle" fontSize={9.5} fontWeight={700}
                      letterSpacing="0.08em" fill={b.color ?? '#df790d'}>{b.label.toUpperCase()}</text>
              )}
            </g>
          ))}

          {domain.ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={innerW} y1={yAt(t)} y2={yAt(t)}
                    stroke={t === 0 && zeroLine ? '#aebdd4' : gridStroke} strokeWidth={1} />
              <text x={-8} y={yAt(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={axisText} className="tnum">
                {fmtNum(t)}
              </text>
            </g>
          ))}

          {refLines.map((r) => (
            <g key={`ref-${r.label}`}>
              <line x1={0} x2={innerW} y1={yAt(r.y)} y2={yAt(r.y)} stroke={r.color ?? '#d24e46'} strokeWidth={1.5}
                    strokeDasharray={r.dashed === false ? undefined : '6 4'} />
              <text x={4} y={yAt(r.y) - 6} textAnchor="start" fontSize={10} fontWeight={700} fill={r.color ?? '#d24e46'}>
                {r.label}
              </text>
            </g>
          ))}

          {xMarks.map((m) => (
            <g key={`xm-${m.x}`}>
              <line x1={xAt(m.x)} x2={xAt(m.x)} y1={0} y2={innerH} stroke={m.color ?? '#df790d'} strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
              <text x={xAt(m.x)} y={-6} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={m.color ?? '#df790d'}>{m.label}</text>
            </g>
          ))}

          {series.filter((s) => s.area).map((s) => (
            <motion.path key={`a-${s.key}`} d={areaFor(s)} fill={`url(#area-${s.key})`}
                         initial={reduced ? false : { opacity: 0 }} animate={seen || reduced ? { opacity: 1 } : undefined}
                         transition={{ duration: mo.slow, ease: mo.ease, delay: 0.3 }} />
          ))}

          {series.map((s, si) => (
            <motion.path
              key={s.key}
              d={pathFor(s)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width ?? 2.25}
              strokeDasharray={s.dashed ? '6 5' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              // En stiplet linje kan ikke "tegnes op": pathLength-animationen sætter
              // selv stroke-dasharray og ville gøre den fuldt optrukket. Den toner ind.
              initial={reduced ? false : s.dashed ? { opacity: 0 } : { pathLength: 0 }}
              animate={seen || reduced ? (s.dashed ? { opacity: 1 } : { pathLength: 1 }) : undefined}
              transition={{ duration: s.dashed ? 0.8 : 1.1, ease: mo.ease, delay: s.dashed ? 0.9 : si * 0.1 }}
            />
          ))}

          {series.filter((s) => s.dots).map((s) => s.points.filter((p) => p.y !== null).map((p) => (
            <circle key={`${s.key}-${p.x}`} cx={xAt(p.x)} cy={yAt(p.y!)} r={3} fill="#fff" stroke={s.color} strokeWidth={1.75} />
          )))}

          {endLabels.map(({ s, x, y }) => (
            <text key={`end-${s.key}`} x={x + 8} y={y} dy="0.32em" fontSize={11} fontWeight={700} fill={s.color}>
              {narrow ? (s.shortLabel ?? s.label) : s.label}
            </text>
          ))}

          {hover && series.map((s) => {
            const p = s.points.find((q) => Math.abs(q.x - hover.i) < 0.5)
            if (!p || p.y === null) return null
            return <circle key={`h-${s.key}`} cx={xAt(p.x)} cy={yAt(p.y)} r={5} fill="#fff" stroke={s.color} strokeWidth={2} />
          })}
          {hover && <line x1={xAt(hover.i)} x2={xAt(hover.i)} y1={0} y2={innerH} stroke="#aebdd4" strokeWidth={1} strokeDasharray="3 3" />}

          {xLabels.map((x, i) => (showLabel.has(i) ? (
            <text key={i} x={xAt(i)} y={innerH + 18} textAnchor="middle" fontSize={11} fill={axisText}>{x}</text>
          ) : null))}

          <rect x={0} y={0} width={innerW} height={innerH} fill="transparent"
                onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </g>
      </svg>
      {hover && rows.length > 0 && (
        <ChartTooltip
          x={(hover.x / W) * containerWidth}
          y={(hover.y / H) * (containerWidth * H / W)}
          title={tooltipTitle ? tooltipTitle(hover.i) : xLabels[hover.i]}
          rows={rows}
          containerWidth={containerWidth}
        />
      )}
    </div>
  )
}

/* ── Søjler op og ned fra en nullinje ───────────────────────────────────── */

export function DivergingBars({
  items, height = 220, positiveColor = '#179fa0', negativeColor = '#d24e46', valueFormat = fmtNum, showValues = true, width,
}: {
  items: { label: string; value: number | null; note?: string; up?: number; down?: number }[]
  height?: number
  positiveColor?: string
  negativeColor?: string
  valueFormat?: (n: number | null) => string
  showValues?: boolean
  width?: number
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const cw = useContainerWidth(ref)
  const seen = useSeen(ref)
  const narrow = cw > 0 && cw < 600
  const W = width ?? (narrow ? 440 : 760)
  const pad = { top: 22, right: 8, bottom: 40, left: 8 }
  const innerW = W - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const vals = items.map((i) => i.value ?? 0)
  const stack = items.some((i) => i.up !== undefined)
  const maxAbs = Math.max(1, ...vals.map(Math.abs), ...(stack ? items.flatMap((i) => [i.up ?? 0, i.down ?? 0]) : []))
  const zero = innerH * (stack ? 0.5 : (Math.max(...vals, 0) / (Math.max(...vals, 0) + Math.max(-Math.min(...vals, 0), 0) || 1)))
  const scale = stack ? (innerH / 2) / maxAbs : (Math.max(zero, innerH - zero) / maxAbs)
  const slot = innerW / Math.max(1, items.length)
  const bw = Math.min(46, slot * 0.62)

  return (
    <div ref={ref} className="w-full">
    <svg viewBox={`0 0 ${W} ${height}`} className="block w-full" style={{ height: 'auto', aspectRatio: `${W} / ${height}` }} role="img" aria-label="Søjler">
      <g transform={`translate(${pad.left},${pad.top})`}>
        <line x1={0} x2={innerW} y1={zero} y2={zero} stroke="#aebdd4" strokeWidth={1} />
        {items.map((it, i) => {
          const cx = slot * i + slot / 2
          if (stack) {
            const up = it.up ?? 0, down = it.down ?? 0
            return (
              <g key={it.label}>
                {/* Søjlen vokser fra nullinjen: fast geometri, animeret skalering. framer-motion
                    oversætter y/height til CSS-transform på SVG, som ikke ender samme sted i alle browsere. */}
                <motion.rect x={cx - bw / 2} y={zero - up * scale} width={bw} height={up * scale} rx={3} fill={positiveColor}
                             style={{ originX: 0.5, originY: 1 }}
                             initial={reduced ? false : { scaleY: 0 }}
                             animate={seen || reduced ? { scaleY: 1 } : undefined}
                             transition={{ duration: 0.8, ease: mo.ease, delay: i * 0.04 }} />
                <motion.rect x={cx - bw / 2} y={zero + 2} width={bw} height={down * scale} rx={3} fill={negativeColor}
                             style={{ originX: 0.5, originY: 0 }}
                             initial={reduced ? false : { scaleY: 0 }}
                             animate={seen || reduced ? { scaleY: 1 } : undefined}
                             transition={{ duration: 0.8, ease: mo.ease, delay: i * 0.04 }} />
                {showValues && (
                  <>
                    <text x={cx} y={zero - up * scale - 5} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#16233a" className="tnum">{fmtNum(up)}</text>
                    <text x={cx} y={zero + 2 + down * scale + 12} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#16233a" className="tnum">{fmtNum(down)}</text>
                  </>
                )}
                <text x={cx} y={innerH + 30} textAnchor="middle" fontSize={11} fill={axisText}>{it.label}</text>
              </g>
            )
          }
          const v = it.value ?? 0
          const h = Math.abs(v) * scale
          const y = v >= 0 ? zero - h : zero + 2
          return (
            <g key={it.label}>
              <motion.rect x={cx - bw / 2} y={y} width={bw} height={h} rx={3} fill={v >= 0 ? positiveColor : negativeColor}
                           style={{ originX: 0.5, originY: v >= 0 ? 1 : 0 }}
                           initial={reduced ? false : { scaleY: 0 }}
                           animate={seen || reduced ? { scaleY: 1 } : undefined}
                           transition={{ duration: 0.8, ease: mo.ease, delay: i * 0.04 }} />
              {showValues && it.value !== null && (
                <text x={cx} y={v >= 0 ? y - 5 : y + h + 12} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#16233a" className="tnum">
                  {valueFormat(it.value)}
                </text>
              )}
              <text x={cx} y={innerH + 30} textAnchor="middle" fontSize={11} fill={axisText}>{it.label}</text>
            </g>
          )
        })}
      </g>
    </svg>
    </div>
  )
}
