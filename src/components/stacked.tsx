/**
 * Stablede søjler — én søjle pr. periode, farvet efter gruppe. Og en
 * fra→til-matrix til bevægelserne mellem grupper.
 */
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { axisText, gridStroke } from './primitives'
import { motion as mo } from '@/design/tokens'
import { fmtNum } from '@/lib/data'

function useSeen(ref: React.RefObject<HTMLDivElement | null>) {
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const [forced, setForced] = useState(false)
  useEffect(() => { const id = window.setTimeout(() => setForced(true), 3500); return () => window.clearTimeout(id) }, [])
  return inView || forced
}
function useWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const read = () => setW(el.clientWidth); read()
    const ro = new ResizeObserver(read); ro.observe(el); return () => ro.disconnect()
  }, [ref])
  return w
}

export function StackedBars({
  items, keys, colors, labels, height = 240, width, valueFormat = fmtNum, showTotals = true, negativeKeys = [], percent = false,
}: {
  items: { label: string; parts: Record<string, number> }[]
  keys: string[]
  colors: Record<string, string>
  labels: Record<string, string>
  height?: number
  width?: number
  valueFormat?: (n: number | null) => string
  showTotals?: boolean
  /** Nøgler der tegnes under nullinjen (fx udmeldelser) */
  negativeKeys?: string[]
  /** Hver søjle skaleres til 100 % */
  percent?: boolean
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const seen = useSeen(ref)
  const cw = useWidth(ref)
  const narrow = cw > 0 && cw < 600
  const W = width ?? (narrow ? 440 : 760)
  const pad = { top: 22, right: 8, bottom: 40, left: percent ? 34 : 8 }
  const innerW = W - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const [hover, setHover] = useState<number | null>(null)

  const pos = (it: typeof items[number]) => keys.filter((k) => !negativeKeys.includes(k)).reduce((s, k) => s + (it.parts[k] ?? 0), 0)
  const neg = (it: typeof items[number]) => keys.filter((k) => negativeKeys.includes(k)).reduce((s, k) => s + (it.parts[k] ?? 0), 0)
  const maxPos = percent ? 100 : Math.max(1, ...items.map(pos))
  const maxNeg = percent ? 0 : Math.max(0, ...items.map(neg))
  const zero = innerH * (maxPos / (maxPos + maxNeg || 1))
  const scale = (maxNeg ? Math.max(zero / maxPos, (innerH - zero) / maxNeg) : zero / maxPos)
  const slot = innerW / Math.max(1, items.length)
  const bw = Math.min(narrow ? 30 : 44, slot * 0.68)
  const labelEvery = Math.max(1, Math.ceil(items.length / (narrow ? 7 : 14)))

  return (
    <div ref={ref} className="relative w-full">
      <svg viewBox={`0 0 ${W} ${height}`} className="block w-full" style={{ height: 'auto', aspectRatio: `${W} / ${height}` }} role="img" aria-label="Stablede søjler">
        <g transform={`translate(${pad.left},${pad.top})`}>
          <line x1={0} x2={innerW} y1={zero} y2={zero} stroke="#aebdd4" strokeWidth={1} />
          {items.map((it, i) => {
            const cx = slot * i + slot / 2
            const total = pos(it)
            const f = percent && total ? 100 / total : 1
            let yUp = zero, yDown = zero + 2
            return (
              <g key={it.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={slot * i} y={0} width={slot} height={innerH} fill={hover === i ? '#f4f6f9' : 'transparent'} />
                {keys.map((k) => {
                  const v = (it.parts[k] ?? 0) * f
                  if (!v) return null
                  const h = v * scale
                  const isNeg = negativeKeys.includes(k)
                  const y = isNeg ? yDown : yUp - h
                  if (isNeg) yDown += h; else yUp -= h
                  return (
                    <motion.rect key={k} x={cx - bw / 2} y={y} width={bw} height={Math.max(0, h - 0.6)} fill={colors[k] ?? '#aebdd4'}
                                 style={{ originX: 0.5, originY: isNeg ? 0 : 1 }}
                                 initial={reduced ? false : { scaleY: 0 }} animate={seen || reduced ? { scaleY: 1 } : undefined}
                                 transition={{ duration: 0.7, ease: mo.ease, delay: i * 0.03 }}>
                      <title>{`${it.label} · ${labels[k] ?? k}: ${fmtNum(it.parts[k])}`}</title>
                    </motion.rect>
                  )
                })}
                {showTotals && !percent && total > 0 && (
                  <text x={cx} y={zero - total * scale - 5} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#16233a" className="tnum">{valueFormat(total)}</text>
                )}
                {showTotals && !percent && neg(it) > 0 && (
                  <text x={cx} y={zero + 2 + neg(it) * scale + 12} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#d24e46" className="tnum">{valueFormat(neg(it))}</text>
                )}
                {(i % labelEvery === 0 || (i === items.length - 1 && i % labelEvery >= labelEvery / 2)) && (
                  <text x={cx} y={innerH + 30} textAnchor="middle" fontSize={11} fill={axisText}>{it.label}</text>
                )}
              </g>
            )
          })}
          {percent && [0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={0} x2={innerW} y1={zero - t * scale} y2={zero - t * scale} stroke={gridStroke} />
              <text x={-2} y={zero - t * scale} dy="0.32em" textAnchor="end" fontSize={10} fill={axisText}>{t}%</text>
            </g>
          ))}
        </g>
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-lg border border-dp-navy-100 bg-white px-3 py-2 text-[0.75rem] shadow-md">
          <div className="font-semibold text-dp-navy-900">{items[hover].label}</div>
          {keys.filter((k) => items[hover].parts[k]).map((k) => (
            <div key={k} className="flex items-center gap-2 text-dp-navy-700">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: colors[k] }} />
              <span>{labels[k] ?? k}</span>
              <span className="tnum ml-auto pl-3 font-semibold">{fmtNum(items[hover].parts[k])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Legend({ keys, colors, labels }: { keys: string[]; colors: Record<string, string>; labels: Record<string, string> }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.75rem] text-dp-navy-700">
      {keys.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: colors[k] ?? '#aebdd4' }} />
          {labels[k] ?? k}
        </span>
      ))}
    </div>
  )
}

/** Fra → til. Rækker er hvor man kom fra, kolonner hvor man endte. */
export function FlowMatrix({
  rows, cols, cell, labels, colors,
}: {
  rows: string[]; cols: string[]; cell: (r: string, c: string) => number
  labels: Record<string, string>; colors: Record<string, string>
}) {
  const max = Math.max(1, ...rows.flatMap((r) => cols.map((c) => (r === c ? 0 : cell(r, c)))))
  return (
    <div className="thin-scroll -mx-2 overflow-x-auto px-2">
      <table className="border-collapse text-[0.75rem]">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white py-1 pr-3 text-left font-semibold text-dp-navy-500">Fra ↓ · Til →</th>
            {cols.map((c) => (
              <th key={c} className="px-1 py-1 text-center font-semibold" style={{ color: colors[c] ?? '#4a5a72' }}>{labels[c] ?? c}</th>
            ))}
            <th className="px-1 py-1 text-right font-semibold text-dp-navy-500">I alt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const total = cols.filter((c) => c !== r).reduce((s, c) => s + cell(r, c), 0)
            return (
              <tr key={r}>
                <td className="sticky left-0 whitespace-nowrap bg-white py-0.5 pr-3 font-medium" style={{ color: colors[r] ?? '#16233a' }}>{labels[r] ?? r}</td>
                {cols.map((c) => {
                  const v = r === c ? null : cell(r, c)
                  const t = v ? Math.min(1, v / max) ** 0.55 : 0
                  return (
                    <td key={c} className="p-0.5">
                      <div className="tnum grid h-8 w-14 place-items-center rounded-md text-[0.6875rem] font-semibold"
                           style={{ background: v === null ? '#f4f1f1' : `rgba(58,85,125,${0.06 + t * 0.85})`, color: t > 0.45 ? '#fff' : '#16233a' }}>
                        {v === null ? '' : v || '·'}
                      </div>
                    </td>
                  )
                })}
                <td className="tnum py-0.5 pl-2 text-right font-semibold text-dp-navy-900">{fmtNum(total)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
