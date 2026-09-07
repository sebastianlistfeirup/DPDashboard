/**
 * Bevægelsesdata: optællinger fra de månedlige medlemslister
 * (public/data/movements.json). Filen indeholder kun tal — ingen personer.
 */
import { useEffect, useState } from 'react'

export type Group = 'normal' | 'selv' | 'phd' | 'kandidat' | 'stud' | 'ledig' | 'pens' | 'andet' | 'ind' | 'ud' | 'ikke_endnu'

export interface FlowMonth {
  month: string
  ind: number
  ud: number
  net: number
  members: number | null
  indByGroup: Record<string, number>
  udByGroup: Record<string, number>
  indByAge: Record<string, number>
  udByAge: Record<string, number>
  udByTenure: Record<string, number>
  udByReason: Record<string, number>
  indByKreds: Record<string, number>
  udByKreds: Record<string, number>
  udBySex: Record<string, number>
  indBySex: Record<string, number>
}

export interface Movements {
  meta: {
    generatedAt: string; first: string; last: string; lists: number
    groupLabels: Record<string, string>; ageBands: string[]; tenureBands: string[]; note: string; migration?: string
  }
  flows: FlowMonth[]
  pending: { byMonth: { month: string; n: number }[]; byGroup: Record<string, number>; total: number }
  transitions: { month: string; gap: number; moves: { from_: string; to: string; n: number }[] }[]
  shift: {
    monthsSinceCand: { k: number; n: number }[]
    byCalendarMonth: number[]
    outcomeByYear: ({ year: string } & Record<string, number | string>)[]
    upcoming: { month: string; n: number }[]
    kandidatOutByYear: { year: string; to: string; n: number }[]
  }
  cohorts: Record<string, { n: number; series: ({ k: number } & Record<string, number>)[] }>
  students: {
    outByYear: ({ year: string } & Record<string, number | string>)[]
    byExpectedYear?: Record<string, number>
    byExpectedMonth?: Record<string, number>
    byUniversity?: Record<string, number>
  }
  members: {
    ageByGroup: Record<string, Record<string, number>>
    avgAge: Record<string, number | null>
    sexByGroup: Record<string, Record<string, number>>
    kreds: { kreds: string; n: number; ly: number; ind12: number; ud12: number }[]
    sektor: Record<string, number>
    ansaettelse: Record<string, number>
    university: Record<string, number>
    pensionByYear: Record<string, number>
  }
  reasons: { byYear: Record<string, Record<string, number>>; byGroup: Record<string, Record<string, number>> }
  churnRate: Record<string, { ud12: number; avgStock: number; pct: number | null }>
  sizes: { month: string; n: number }[]
}

declare global {
  interface Window { __DP_MOVEMENTS__?: Movements }
}

export function useMovements() {
  const [data, setData] = useState<Movements | null>(() => window.__DP_MOVEMENTS__ ?? null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    if (window.__DP_MOVEMENTS__) return
    fetch(`${import.meta.env.BASE_URL}data/movements.json?t=${Date.now()}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((d: Movements) => setData(d))
      .catch(() => setMissing(true))
  }, [])
  return { mov: data, missing }
}

export const GROUP_COLOR: Record<string, string> = {
  normal: '#4c7bbd', selv: '#df790d', phd: '#179fa0', kandidat: '#4e4897', stud: '#4fa388',
  ledig: '#d8a90c', pens: '#8299bb', andet: '#aebdd4', ind: '#179fa0', ud: '#d24e46', ikke_endnu: '#e2e6ea',
}
export const GROUP_ORDER: Group[] = ['normal', 'selv', 'phd', 'kandidat', 'stud', 'ledig', 'pens', 'andet']

export const REASON_COLOR: Record<string, string> = {
  'Pension': '#8299bb', 'Død': '#5e6e86', 'Restance': '#d24e46', 'For dyrt': '#df790d', 'Økonomi': '#e9a25f',
  'Utilfreds med DP': '#4e4897', 'Organiseret andet sted': '#7e78bf', 'Studiestop': '#4fa388', 'Udlandet': '#179fa0',
  'Skift af medlemstype': '#c4dcdb', 'Barsel': '#f2d57a', 'Sygdom': '#d8a90c', 'Adresseændring': '#aebdd4',
  'Efterløn': '#8299bb', 'Anden årsag': '#c9d2de', 'Ukendt': '#e2e6ea',
}

export const monthLabel = (m: string) => {
  const s = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  return `${s[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`
}
