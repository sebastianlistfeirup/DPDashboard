/**
 * Chart primitives, drawn as SVG so every mark follows DP's design language
 * rather than a library's defaults.
 *
 * Shared rules, applied here once so no chart can drift:
 *  · thin marks — 2px lines, ≥8px hover targets, 4px rounded data-ends
 *  · a 2px surface gap wherever two fills meet
 *  · recessive grid and axes; values in ink, never in the series colour
 *  · every chart has a hover layer, and the card around it offers a table view
 */
import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChartTooltip, axisText, gridStroke, type TooltipRow } from './primitives'
import { motion as mo } from '@/design/tokens'

const nf = new Intl.NumberFormat('da-DK')
export const fmtNum = (n: number | null | undefined) => (n === null || n === undefined ? '–' : nf.format(Math.round(n)))
export const fmtPct = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined ? '–' : `${n.toLocaleString('da-DK', { minimumFractionDigits: d, maximumFractionDigits: d })} %`

/** Et decimaltal med dansk komma. */
export const fmtDec = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined ? '–' : n.toLocaleString('da-DK', { minimumFractionDigits: d, maximumFractionDigits: d })

/** Et fortegnstal — plus eller rigtigt minustegn, ikke bindestreg. */
export const fmtDelta = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined ? '–' : `${n >= 0 ? '+' : '−'}${fmtDec(Math.abs(n), d)}`

/* ── Akse-hjælpere ───────────────────────────────────────────────────────── */

function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10
  const ticks: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}

/* ── Linje- / arealdiagram ───────────────────────────────────────────────── */

export interface LineSeries {
  key: string
  label: string
  color: string
  points: { x: string; y: number | null }[]
}

export interface ChartNote { x: string; text: string; local?: boolean }

export function LineChart({
  series, height = 260, yLabel = '%', valueFormat = fmtPct, area = true, xTickEvery,
  notes = [], onPickX, picking = false, revealOnScroll = true,
}: {
  series: LineSeries[]
  height?: number
  yLabel?: string
  valueFormat?: (n: number | null) => string
  area?: boolean
  xTickEvery?: number
  /** Noter på tidslinjen — det, der skete den måned. */
  notes?: ChartNote[]
  /** Sat, når man er ved at vælge en måned at skrive en note på. */
  onPickX?: (x: string) => void
  picking?: boolean
  /**
   * Kurven tegnes normalt, når man scroller ned til den. På ledelsessiden — og
   * på papir — er der ingen der scroller, så dér tegnes den ved indlæsning.
   * Ellers kunne en udskrift ende med en tom graf.
   */
  revealOnScroll?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
  const reduced = useReducedMotion()

  const xs = useMemo(() => {
    const all = new Set<string>()
    for (const s of series) for (const p of s.points) all.add(p.x)
    return [...all].sort()
  }, [series])

  const pad = { top: notes.length ? 26 : 14, right: 16, bottom: 26, left: 40 }
  const W = 760
  const H = height
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom

  const maxY = useMemo(() => {
    const vals = series.flatMap((s) => s.points.map((p) => p.y ?? 0))
    return Math.max(1, ...vals)
  }, [series])
  const ticks = niceTicks(maxY)
  const top = ticks[ticks.length - 1] || maxY

  const xAt = (x: string) => (xs.length <= 1 ? innerW / 2 : (xs.indexOf(x) / (xs.length - 1)) * innerW)
  const yAt = (y: number) => innerH - (y / top) * innerH

  const pathFor = (s: LineSeries) => {
    const pts = s.points.filter((p) => p.y !== null).sort((a, b) => a.x.localeCompare(b.x))
    if (!pts.length) return ''
    return pts.map((p, i) => `${i ? 'L' : 'M'}${xAt(p.x).toFixed(1)},${yAt(p.y!).toFixed(1)}`).join(' ')
  }
  const areaFor = (s: LineSeries) => {
    const pts = s.points.filter((p) => p.y !== null).sort((a, b) => a.x.localeCompare(b.x))
    if (pts.length < 2) return ''
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${xAt(p.x).toFixed(1)},${yAt(p.y!).toFixed(1)}`).join(' ')
    return `${line} L${xAt(pts[pts.length - 1].x).toFixed(1)},${innerH} L${xAt(pts[0].x).toFixed(1)},${innerH} Z`
  }

  const step = xTickEvery ?? Math.max(1, Math.ceil(xs.length / 8))

  const onMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = ((e.clientX - rect.left) / rect.width) * innerW
    const i = Math.round((rel / innerW) * (xs.length - 1))
    if (i >= 0 && i < xs.length) {
      setHover({ i, x: pad.left + xAt(xs[i]), y: pad.top + innerH / 2 })
    }
  }, [innerW, innerH, xs, pad.left, pad.top])

  const containerWidth = ref.current?.clientWidth ?? W
  const tooltipRows: TooltipRow[] = hover
    ? series.map((s) => {
        const p = s.points.find((q) => q.x === xs[hover.i])
        return { label: s.label, value: valueFormat(p?.y ?? null), color: s.color }
      }).filter((r) => r.value !== '–')
    : []

  return (
    <div ref={ref} className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img" aria-label="Udvikling over tid">
        <g transform={`translate(${pad.left},${pad.top})`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={innerW} y1={yAt(t)} y2={yAt(t)} stroke={gridStroke} strokeWidth={1} />
              <text x={-8} y={yAt(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={axisText}>
                {t}{yLabel === '%' ? '' : ''}
              </text>
            </g>
          ))}

          {area && series.length === 1 && (
            <>
              <defs>
                <linearGradient id="dp-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={series[0].color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={series[0].color} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <motion.path
                d={areaFor(series[0])}
                fill="url(#dp-area)"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: mo.slow, ease: mo.ease, delay: 0.35 }}
              />
            </>
          )}

          {series.map((s, si) => (
            <motion.path
              key={s.key}
              d={pathFor(s)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduced ? false : { pathLength: 0 }}
              {...(revealOnScroll
                ? { whileInView: { pathLength: 1 }, viewport: { once: true, margin: '-40px' } }
                : { animate: { pathLength: 1 } })}
              transition={{ duration: 1.1, ease: mo.ease, delay: si * 0.12 }}
            />
          ))}

          {hover && series.map((s) => {
            const p = s.points.find((q) => q.x === xs[hover.i])
            if (!p || p.y === null) return null
            return (
              <g key={`h-${s.key}`}>
                <circle cx={xAt(p.x)} cy={yAt(p.y)} r={5} fill="#fff" stroke={s.color} strokeWidth={2} />
              </g>
            )
          })}
          {hover && (
            <line x1={xAt(xs[hover.i])} x2={xAt(xs[hover.i])} y1={0} y2={innerH} stroke="#aebdd4" strokeWidth={1} strokeDasharray="3 3" />
          )}

          {xs.map((x, i) => (i % step === 0 ? (
            <text key={x} x={xAt(x)} y={innerH + 17} textAnchor="middle" fontSize={11} fill={axisText}>
              {x.replace(/^\d{2}(\d{2})-/, "'$1-").replace('-U', ' u')}
            </text>
          ) : null))}

          {/* Noter: hvad der skete den måned, sat på selve tidslinjen */}
          {notes.map((n) => {
            if (!xs.includes(n.x)) return null
            const nx = xAt(n.x)
            return (
              <g key={`note-${n.x}`} className="cursor-help">
                <line x1={nx} x2={nx} y1={-10} y2={innerH} stroke="#df790d" strokeWidth={1} strokeDasharray="4 3" opacity={0.75} />
                <motion.g
                  initial={reduced ? false : { opacity: 0, y: -6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, ease: mo.ease }}
                >
                  <circle cx={nx} cy={-11} r={7} fill="#df790d" />
                  <text x={nx} y={-11} dy="0.34em" textAnchor="middle" fontSize={9} fontWeight="700" fill="#fff">
                    i
                  </text>
                </motion.g>
                <title>{`${n.x}: ${n.text}`}</title>
              </g>
            )
          })}

          <rect
            x={0} y={0} width={innerW} height={innerH}
            fill="transparent"
            style={{ cursor: picking ? 'crosshair' : 'default' }}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            onClick={(e) => {
              if (!onPickX) return
              const rect = e.currentTarget.getBoundingClientRect()
              const rel = ((e.clientX - rect.left) / rect.width) * innerW
              const i = Math.round((rel / innerW) * (xs.length - 1))
              if (i >= 0 && i < xs.length) onPickX(xs[i])
            }}
          />
        </g>
      </svg>
      {hover && tooltipRows.length > 0 && (
        <ChartTooltip
          x={(hover.x / W) * containerWidth}
          y={(hover.y / H) * height}
          title={xs[hover.i]}
          rows={tooltipRows}
          containerWidth={containerWidth}
        />
      )}
    </div>
  )
}

/* ── Vandrette søjler ────────────────────────────────────────────────────── */

export function BarRows({
  rows, valueFormat = fmtPct, max, showValue = true, barHeight = 10, secondary,
}: {
  rows: { label: string; value: number | null; color: string; note?: string; n?: number }[]
  valueFormat?: (n: number | null) => string
  max?: number
  showValue?: boolean
  barHeight?: number
  secondary?: (row: { label: string; value: number | null; n?: number }) => ReactNode
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value ?? 0))
  return (
    <ul className="space-y-3.5">
      {rows.map((r, i) => (
        <li key={r.label} className="group">
          <div className="mb-1.5 flex items-baseline justify-between gap-4">
            <span className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-dp-navy-800">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} />
              <span className="truncate" title={r.label}>{r.label}</span>
              {r.n !== undefined && <span className="shrink-0 text-[0.6875rem] text-dp-navy-400">n={fmtNum(r.n)}</span>}
            </span>
            {showValue && (
              <span className="tnum shrink-0 text-[0.8125rem] font-semibold text-dp-navy-900">
                {valueFormat(r.value)}
              </span>
            )}
          </div>
          <div className="relative rounded-full bg-dp-navy-100" style={{ height: barHeight }}>
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              // En værdi på 1 % af en akse der går til 80 bliver til under en
              // pixel og ser ud som nul. Tallet står ved siden af, så søjlen
              // skal i det mindste kunne ses.
              style={{ background: r.color, minWidth: (r.value ?? 0) > 0 ? 3 : 0 }}
              initial={{ width: 0 }}
              whileInView={{ width: `${Math.max(0, Math.min(100, ((r.value ?? 0) / top) * 100))}%` }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ duration: 0.9, ease: mo.ease, delay: 0.05 * i }}
            />
          </div>
          {(r.note || secondary) && (
            <div className="mt-1 text-[0.6875rem] text-dp-navy-400">{r.note ?? secondary?.(r)}</div>
          )}
        </li>
      ))}
    </ul>
  )
}

/* ── Grupperede søjler ───────────────────────────────────────────────────── */

export function GroupedBars({
  categories, series, height = 240, valueFormat = fmtPct,
}: {
  categories: string[]
  series: { key: string; label: string; color: string; values: (number | null)[] }[]
  height?: number
  valueFormat?: (n: number | null) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const pad = { top: 12, right: 8, bottom: 46, left: 40 }
  const W = 760
  const innerW = W - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const maxY = Math.max(1, ...series.flatMap((s) => s.values.map((v) => v ?? 0)))
  const ticks = niceTicks(maxY)
  const top = ticks[ticks.length - 1] || maxY

  const slot = innerW / Math.max(1, categories.length)
  const groupW = Math.min(slot * 0.72, 90)
  const barW = Math.max(6, (groupW - 2 * (series.length - 1)) / series.length)

  return (
    <div ref={ref} className="relative w-full">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height }} role="img">
        <g transform={`translate(${pad.left},${pad.top})`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={innerW} y1={innerH - (t / top) * innerH} y2={innerH - (t / top) * innerH} stroke={gridStroke} />
              <text x={-8} y={innerH - (t / top) * innerH} dy="0.32em" textAnchor="end" fontSize={11} fill={axisText}>{t}</text>
            </g>
          ))}
          {categories.map((c, ci) => (
            <g key={c} transform={`translate(${ci * slot + slot / 2 - groupW / 2},0)`}
               onMouseEnter={() => setHover(ci)} onMouseLeave={() => setHover(null)}>
              <rect x={-slot * 0.14} y={0} width={slot} height={innerH} fill={hover === ci ? '#f3f5f7' : 'transparent'} />
              {series.map((s, si) => {
                const v = s.values[ci] ?? 0
                const h = Math.max(0, (v / top) * innerH)
                return (
                  <motion.rect
                    key={s.key}
                    x={si * (barW + 2)}
                    width={barW}
                    rx={4}
                    fill={s.color}
                    initial={{ height: 0, y: innerH }}
                    whileInView={{ height: h, y: innerH - h }}
                    viewport={{ once: true, margin: '-30px' }}
                    transition={{ duration: 0.8, ease: mo.ease, delay: 0.04 * ci + 0.06 * si }}
                  />
                )
              })}
              <text x={groupW / 2} y={innerH + 16} textAnchor="middle" fontSize={11} fill={axisText}>
                {c.length > 14 ? `${c.slice(0, 13)}…` : c}
              </text>
            </g>
          ))}
        </g>
      </svg>
      {hover !== null && (
        <ChartTooltip
          x={((pad.left + hover * slot + slot / 2) / W) * (ref.current?.clientWidth ?? W)}
          y={height / 2}
          title={categories[hover]}
          rows={series.map((s) => ({ label: s.label, value: valueFormat(s.values[hover] ?? null), color: s.color }))}
          containerWidth={ref.current?.clientWidth ?? W}
        />
      )}
    </div>
  )
}

/* ── Heatmap: ugedag × klokkeslæt ────────────────────────────────────────── */

export function HeatMap({
  cells, weekdayLabels, hours, valueKey = 'openRate', minCount = 1, color = '#3a557d',
}: {
  cells: { weekday: number; hour: number; count: number; openRate: number | null; clickRate: number | null }[]
  weekdayLabels: string[]
  hours: number[]
  valueKey?: 'openRate' | 'clickRate'
  minCount?: number
  color?: string
}) {
  const [hover, setHover] = useState<{ cell: (typeof cells)[number]; x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const values = cells.filter((c) => c.count >= minCount && c[valueKey] !== null).map((c) => c[valueKey]!)
  const lo = Math.min(...values, 0)
  const hi = Math.max(...values, 1)

  // One hue, light → dark: the sequential rule. Steps are DP's blue.
  const shade = (v: number | null, count: number) => {
    if (v === null || count < minCount) return '#f4f1f1'
    const t = hi > lo ? (v - lo) / (hi - lo) : 0.5
    const steps = ['#e7ebef', '#d4dbe1', '#aebdd4', '#8299bb', '#5a76a0', '#3a557d', '#2a4368', '#1e3050']
    return steps[Math.min(steps.length - 1, Math.round(t * (steps.length - 1)))]
  }
  void color

  const cellFor = (w: number, h: number) => cells.find((c) => c.weekday === w && c.hour === h)
  const order = [1, 2, 3, 4, 5, 6, 0] // mandag først

  return (
    <div ref={ref} className="relative">
      <div className="thin-scroll overflow-x-auto pb-1">
        <table className="border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th />
              {hours.map((h) => (
                <th key={h} className="pb-1 text-center text-[0.625rem] font-medium tabular-nums text-dp-navy-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.map((w) => (
              <tr key={w}>
                <th className="pr-2 text-right text-[0.6875rem] font-medium text-dp-navy-500">
                  {weekdayLabels[w].slice(0, 3)}
                </th>
                {hours.map((h) => {
                  const c = cellFor(w, h)
                  const v = c?.[valueKey] ?? null
                  return (
                    <td key={h}>
                      <motion.div
                        className="h-6 w-6 cursor-default rounded-[4px]"
                        style={{ background: shade(v, c?.count ?? 0) }}
                        initial={{ opacity: 0, scale: 0.6 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, ease: mo.ease, delay: 0.004 * (w * 24 + h) }}
                        onMouseEnter={(e) => {
                          if (!c) return
                          const r = (e.target as HTMLElement).getBoundingClientRect()
                          const p = ref.current!.getBoundingClientRect()
                          setHover({ cell: c, x: r.left - p.left + r.width / 2, y: r.top - p.top + r.height / 2 })
                        }}
                        onMouseLeave={() => setHover(null)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hover && (
        <ChartTooltip
          x={hover.x}
          y={hover.y}
          title={`${weekdayLabels[hover.cell.weekday]} kl. ${String(hover.cell.hour).padStart(2, '0')}`}
          rows={[
            { label: 'Udsendelser', value: fmtNum(hover.cell.count) },
            { label: 'Åbningsrate', value: fmtPct(hover.cell.openRate) },
            { label: 'Klikrate', value: fmtPct(hover.cell.clickRate) },
          ]}
          containerWidth={ref.current?.clientWidth ?? 600}
        />
      )}
      <div className="mt-3 flex items-center gap-2 text-[0.6875rem] text-dp-navy-400">
        <span>Lav</span>
        {['#e7ebef', '#d4dbe1', '#aebdd4', '#8299bb', '#5a76a0', '#3a557d', '#2a4368', '#1e3050'].map((c) => (
          <span key={c} className="h-3 w-5 rounded-[2px]" style={{ background: c }} />
        ))}
        <span>Høj {valueKey === 'openRate' ? 'åbningsrate' : 'klikrate'}</span>
        <span className="ml-auto">Grå = ingen udsendelser</span>
      </div>
    </div>
  )
}

/* ── Punktdiagram ────────────────────────────────────────────────────────── */

export function Scatter({
  points, xLabel, yLabel, height = 300, xFormat = fmtNum, yFormat = fmtPct,
}: {
  points: { x: number; y: number; label: string; color: string; size?: number }[]
  xLabel: string
  yLabel: string
  height?: number
  xFormat?: (n: number) => string
  yFormat?: (n: number) => string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const pad = { top: 14, right: 16, bottom: 36, left: 44 }
  const W = 760
  const innerW = W - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const maxX = Math.max(1, ...points.map((p) => p.x))
  const maxY = Math.max(1, ...points.map((p) => p.y))
  const xTicks = niceTicks(maxX)
  const yTicks = niceTicks(maxY)
  const topX = xTicks[xTicks.length - 1] || maxX
  const topY = yTicks[yTicks.length - 1] || maxY

  return (
    <div ref={ref} className="relative w-full">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height }} role="img">
        <g transform={`translate(${pad.left},${pad.top})`}>
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={0} x2={innerW} y1={innerH - (t / topY) * innerH} y2={innerH - (t / topY) * innerH} stroke={gridStroke} />
              <text x={-8} y={innerH - (t / topY) * innerH} dy="0.32em" textAnchor="end" fontSize={11} fill={axisText}>{t}</text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={`x${t}`} x={(t / topX) * innerW} y={innerH + 16} textAnchor="middle" fontSize={11} fill={axisText}>
              {xFormat(t)}
            </text>
          ))}
          {points.map((p, i) => (
            <motion.circle
              key={i}
              cx={(p.x / topX) * innerW}
              cy={innerH - (p.y / topY) * innerH}
              r={hover === i ? 8 : (p.size ?? 5)}
              fill={p.color}
              fillOpacity={0.72}
              stroke="#fff"
              strokeWidth={2}
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: mo.ease, delay: Math.min(0.5, i * 0.006) }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            />
          ))}
          <text x={innerW} y={innerH + 32} textAnchor="end" fontSize={11} fill={axisText}>{xLabel}</text>
          <text x={-34} y={-2} fontSize={11} fill={axisText}>{yLabel}</text>
        </g>
      </svg>
      {hover !== null && (
        <ChartTooltip
          x={((pad.left + (points[hover].x / topX) * innerW) / W) * (ref.current?.clientWidth ?? W)}
          y={pad.top + innerH - (points[hover].y / topY) * innerH}
          title={points[hover].label}
          rows={[
            { label: xLabel, value: xFormat(points[hover].x) },
            { label: yLabel, value: yFormat(points[hover].y) },
          ]}
          containerWidth={ref.current?.clientWidth ?? W}
        />
      )}
    </div>
  )
}

/* ── Donut ───────────────────────────────────────────────────────────────── */

export function Donut({
  slices, size = 180, thickness = 26, centreLabel, centreValue,
}: {
  slices: { label: string; value: number; color: string }[]
  size?: number
  thickness?: number
  centreLabel?: string
  centreValue?: string
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        <g transform={`translate(${size / 2},${size / 2}) rotate(-90)`}>
          {slices.map((s, i) => {
            const frac = s.value / total
            // A 2px gap keeps adjacent segments from touching.
            const len = Math.max(0, frac * c - 2)
            const el = (
              <motion.circle
                key={s.label}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: mo.ease, delay: i * 0.08 }}
              />
            )
            offset += frac * c
            return el
          })}
        </g>
      </svg>
      {(centreValue || centreLabel) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {centreValue && <div className="font-serif text-2xl font-semibold tnum text-dp-navy-900">{centreValue}</div>}
          {centreLabel && <div className="mt-0.5 max-w-[7rem] text-[0.6875rem] leading-tight text-dp-navy-500">{centreLabel}</div>}
        </div>
      )}
    </div>
  )
}

/* ── Sparkline ───────────────────────────────────────────────────────────── */

export function Sparkline({ values, color, width = 92, height = 26 }: {
  values: (number | null)[]; color: string; width?: number; height?: number
}) {
  const pts = values.filter((v): v is number => v !== null)
  if (pts.length < 2) return <div style={{ width, height }} />
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * width},${height - ((v - min) / span) * height}`).join(' ')
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={width}
        cy={height - ((pts[pts.length - 1] - min) / span) * height}
        r={2.75}
        fill={color}
      />
    </svg>
  )
}

/* ── Simpel tabel til "vis tal"-visningen ────────────────────────────────── */

export function DataTable({ columns, rows }: {
  columns: { key: string; label: string; align?: 'left' | 'right' }[]
  rows: Record<string, ReactNode>[]
}) {
  return (
    <div className="thin-scroll -mx-1 max-h-[26rem] overflow-auto px-1">
      <table className="w-full border-collapse text-[0.8125rem]">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-dp-navy-100">
            {columns.map((c) => (
              <th key={c.key} className={`py-2 pr-3 font-semibold text-dp-navy-500 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-dp-navy-50 last:border-0">
              {columns.map((c) => (
                <td key={c.key} className={`py-1.5 pr-3 ${c.align === 'right' ? 'tnum text-right' : ''}`}>{r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
