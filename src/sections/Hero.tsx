/**
 * Forsiden: månedens fire tal, som ledergruppen plejer at få i mailens første
 * linjer — medlemstal, kongeindikator, 1.-2. års kandidater og målet.
 */
import { motion } from 'framer-motion'
import { AnimatedNumber, Reveal } from '@/components/primitives'
import { Sparkline } from '@/components/charts'
import {
  cap, fmtNum, fmtPctSigned, fmtSigned, monthYear, pctChange, ultimo, yearOf, ddmmyy,
  type AsOf, type Dashboard, type GoalPath,
} from '@/lib/data'
import { motion as mo } from '@/design/tokens'

export function Hero({ data, a, goal }: { data: Dashboard; a: AsOf; goal: GoalPath }) {
  const dMonth = a.totalPrev !== null ? a.total - a.totalPrev : null
  const dYear = a.totalLy !== null ? a.total - a.totalLy : null
  const kStep = a.kongePrev !== null && a.konge !== null && a.prev && yearOf(a.prev.date) === yearOf(a.date) ? a.konge - a.kongePrev : null
  const kand = a.kandidater
  const totalsSpark = data.snapshots.slice(Math.max(0, a.index - 11), a.index + 1).map((s) => s.total.now)
  const year = yearOf(a.date)

  return (
    <div className="relative overflow-hidden bg-dp-navy-900 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-32 -top-40 h-[34rem] w-[34rem] rounded-full opacity-20 blur-3xl"
             style={{ background: 'radial-gradient(circle, #4c7bbd, transparent 65%)' }} />
        <div className="absolute -bottom-48 left-1/3 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl"
             style={{ background: 'radial-gradient(circle, #df790d, transparent 65%)' }} />
      </div>

      <div className="relative mx-auto w-full max-w-[80rem] px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
        <Reveal>
          <div className="kicker text-dp-orange">Medlemsudvikling · {cap(ultimo(a.date))}</div>
          <h1 className="mt-4 max-w-3xl text-display-lg font-semibold text-white">
            {dMonth === null
              ? `${fmtNum(a.total)} medlemmer`
              : dMonth > 0
                ? `${fmtNum(dMonth)} flere medlemmer i ${monthYear(a.date).split(' ')[0]}, og kongeindikatoren står i ${fmtSigned(a.konge)}`
                : dMonth < 0
                  ? `${fmtNum(-dMonth)} færre medlemmer i ${monthYear(a.date).split(' ')[0]}, mens kongeindikatoren står i ${fmtSigned(a.konge)}`
                  : `Uændret medlemstal i ${monthYear(a.date).split(' ')[0]}, kongeindikatoren står i ${fmtSigned(a.konge)}`}
          </h1>
          <p className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-dp-navy-300">
            Alle tal er pr. {ddmmyy(a.date)}. Kongeindikatoren er væksten i fuldtidsbetalende medlemmer
            (normalansatte over 19 timer, selvstændige og ph.d.-studerende) siden {ddmmyy(a.snapshot.baseDate)}.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            delay={0.05}
            label="Alle medlemmer"
            value={a.total}
            color="#ffffff"
            rows={[
              dMonth !== null ? { k: `mod ${ultimo(a.prev!.date)}`, v: fmtSigned(dMonth), tone: dMonth } : null,
              dYear !== null ? { k: `mod samme måned ${year - 1}`, v: `${fmtSigned(dYear)} (${fmtPctSigned(pctChange(a.total, a.totalLy))})`, tone: dYear } : null,
            ]}
            spark={totalsSpark}
            sparkColor="#8da6d6"
          />
          <Stat
            delay={0.12}
            label="Kongeindikator"
            value={a.konge ?? 0}
            signed
            color="#f2d57a"
            rows={[
              kStep !== null ? { k: `mod ${ultimo(a.prev!.date)}`, v: fmtSigned(kStep), tone: kStep } : null,
              a.kongeSameMonthLastYear !== null ? { k: `samme måned ${year - 1}`, v: fmtSigned(a.kongeSameMonthLastYear), tone: 0 } : null,
            ]}
            spark={(data.konge[String(year)] ?? []).filter((k) => k.date <= a.date).map((k) => k.value)}
            sparkColor="#f2d57a"
          />
          <Stat
            delay={0.19}
            label="1. og 2. års kandidater"
            value={kand.now}
            color="#bcbbde"
            rows={[
              kand.ly !== null ? { k: `mod samme måned ${year - 1}`, v: fmtSigned(kand.now - kand.ly), tone: kand.now - kand.ly } : null,
              kand.base !== null ? { k: `siden ${ddmmyy(a.snapshot.baseDate)}`, v: fmtSigned(kand.now - kand.base), tone: kand.now - kand.base } : null,
            ]}
            spark={data.snapshots.slice(Math.max(0, a.index - 11), a.index + 1).map((s) => s.categories['1 og 2 års Kandidater']?.now ?? null)}
            sparkColor="#bcbbde"
          />
          <GoalStat goal={goal} total={a.total} delay={0.26} />
        </div>
      </div>
    </div>
  )
}

function Stat({
  label, value, signed = false, color, rows, spark, sparkColor, delay,
}: {
  label: string; value: number; signed?: boolean; color: string
  rows: ({ k: string; v: string; tone: number } | null)[]
  spark: (number | null)[]; sparkColor: string; delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: mo.base, ease: mo.ease, delay }}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[0.8125rem] font-semibold text-dp-navy-300">{label}</div>
        <Sparkline values={spark} color={sparkColor} width={80} height={22} />
      </div>
      <div className="tnum mt-2 font-serif text-[2.75rem] font-semibold leading-none" style={{ color }}>
        {signed && value > 0 && <span className="mr-0.5 text-[1.75rem] align-top">+</span>}
        {signed && value < 0 && <span className="mr-0.5 text-[1.75rem] align-top">−</span>}
        <AnimatedNumber value={Math.abs(value)} />
      </div>
      <dl className="mt-4 space-y-1.5 border-t border-white/10 pt-3">
        {rows.filter((r): r is NonNullable<typeof r> => r !== null).map((r) => (
          <div key={r.k} className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
            <dt className="text-dp-navy-400">{r.k}</dt>
            <dd className="tnum font-semibold" style={{ color: r.tone > 0 ? '#8ebec0' : r.tone < 0 ? '#e39687' : '#d4dbe1' }}>{r.v}</dd>
          </div>
        ))}
      </dl>
    </motion.div>
  )
}

function GoalStat({ goal, total, delay }: { goal: GoalPath; total: number; delay: number }) {
  const overall = Math.max(0, Math.min(100, (total / goal.target) * 100))
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: mo.base, ease: mo.ease, delay }}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
    >
      <div className="text-[0.8125rem] font-semibold text-dp-navy-300">Mål: {fmtNum(goal.target)} medlemmer 31.12.29</div>
      <div className="tnum mt-2 font-serif text-[2.75rem] font-semibold leading-none text-white">
        <AnimatedNumber value={overall} decimals={1} suffix=" %" />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div className="h-full rounded-full" style={{ background: '#df790d' }}
                    initial={{ width: 0 }} animate={{ width: `${overall}%` }}
                    transition={{ duration: mo.slow, ease: mo.ease, delay: delay + 0.2 }} />
      </div>
      <dl className="mt-4 space-y-1.5 border-t border-white/10 pt-3">
        <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
          <dt className="text-dp-navy-400">mangler</dt>
          <dd className="tnum font-semibold text-dp-navy-100">{fmtNum(goal.target - total)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
          <dt className="text-dp-navy-400">ift. lige linje mod målet</dt>
          <dd className="tnum font-semibold" style={{ color: goal.gapToday >= 0 ? '#8ebec0' : '#e39687' }}>
            {fmtSigned(goal.gapToday)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
          <dt className="text-dp-navy-400">vækst i år</dt>
          <dd className="tnum font-semibold" style={{ color: total - goal.from.total >= 0 ? '#8ebec0' : '#e39687' }}>{fmtSigned(total - goal.from.total)}</dd>
        </div>
      </dl>
    </motion.div>
  )
}
