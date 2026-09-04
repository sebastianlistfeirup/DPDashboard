/**
 * Månedens tekst til ledergruppen — skrevet ud fra tallene i samme stil som
 * de mails, Sebastian plejer at sende. Siden sender ikke noget selv; teksten
 * vises, kopieres og sendes af et menneske.
 */
import {
  MONTHS, cap, fmtNum, fmtSigned, monthIndex, monthYear, ultimo, yearOf, ddmmyy,
  type AsOf, type Dashboard, type GoalPath,
} from './data'

export interface Report { subject: string; text: string; paragraphs: { title: string; body: string }[] }

const signed = (n: number) => fmtSigned(n)

export function buildReport(_data: Dashboard, a: AsOf, goal: GoalPath): Report {
  const m = MONTHS[monthIndex(a.date)]
  const y = yearOf(a.date)
  const paragraphs: { title: string; body: string }[] = []

  // 1. Samlet medlemstal
  {
    const d = a.totalPrev !== null ? a.total - a.totalPrev : null
    const head = d === null ? 'Medlemstallet' : d > 0 ? (d >= 40 ? 'Flere medlemmer' : 'Lille stigning i det samlede medlemstal') : d < 0 ? (d <= -40 ? 'Fald i medlemstallet' : 'Lille fald i det samlede medlemstal') : 'Uændret medlemstal'
    let body = a.prev
      ? `Vi er gået fra ${fmtNum(a.totalPrev)} medlemmer (${ultimo(a.prev.date)}) til ${fmtNum(a.total)} medlemmer (${ultimo(a.date)}), altså ${signed(d!)} medlemmer.`
      : `Vi er ${fmtNum(a.total)} medlemmer ${ultimo(a.date)}.`
    if (a.totalLy !== null) {
      body += ` Sammenlignet med samme tidspunkt sidste år (${m} ${y - 1}) er vi ${fmtNum(a.total - a.totalLy)} ${a.total >= a.totalLy ? 'flere' : 'færre'} medlemmer.`
    }
    paragraphs.push({ title: head, body })
  }

  // 2. Kongeindikator
  if (a.konge !== null) {
    let body = `Pr. ${ultimo(a.date)} er vi vokset med ${fmtNum(a.konge)} fuldtidsbetalende medlemmer i forhold til ${ddmmyy(a.snapshot.baseDate)}.`
    if (a.kongePrev !== null && a.prev && yearOf(a.prev.date) === y) {
      const step = a.konge - a.kongePrev
      body += ` Det var ${fmtNum(a.kongePrev)} ${ultimo(a.prev.date)}, så ${signed(step)} på en måned.`
    }
    const cmp: string[] = []
    if (a.kongeSameMonthLastYear !== null) cmp.push(`${fmtNum(a.kongeSameMonthLastYear)} i ${y - 1}`)
    if (a.kongeSameMonthTwoYears !== null) cmp.push(`${fmtNum(a.kongeSameMonthTwoYears)} i ${y - 2}`)
    if (cmp.length) {
      const ahead = a.kongeSameMonthLastYear !== null && a.konge > a.kongeSameMonthLastYear
      body += ` Samme måned lå vi på ${cmp.join(' og ')}, så ${ahead ? 'det tegner fortsat lovende' : 'vi ligger lidt efter sidste år'}.`
    }
    const parts = [...a.kongeParts].sort((p, q) => q.value - p.value)
    body += ` Væksten kommer fra ${parts.map((p) => `${p.label.toLowerCase()} (${signed(p.value)})`).join(', ')}.`
    paragraphs.push({ title: 'Kongeindikator', body })
  }

  // 3. 1. og 2. års kandidater
  {
    const k = a.kandidater
    if (k.ly !== null) {
      const d = k.now - k.ly
      const body = `${cap(ultimo(a.date.replace(String(y), String(y - 1))))} havde vi ${fmtNum(k.ly)} 1. og 2. års kandidater mod ${fmtNum(k.now)} ${ultimo(a.date)}, altså ${signed(d)}. `
        + `Kategorien er den primære driver bag væksten i kongeindikatoren, så ${d > 0 ? 'vi har et endnu større vækstpotentiale i de kommende år' : 'det er værd at holde øje med'} – hvis vi kan holde på medlemmerne over det kritiske kontingentskift.`
      paragraphs.push({ title: d > 0 ? 'Stigning i 1. og 2. års kandidater' : 'Status på 1. og 2. års kandidater', body })
    }
  }

  // 4. Ind- og udmeldelser
  {
    const f = a.flowThisMonth
    if (f && f.ind !== null && f.ud !== null) {
      const net = f.ind - f.ud
      let body = `I ${m} havde vi ${fmtNum(f.ind)} indmeldelser og ${fmtNum(f.ud)} udmeldelser, altså ${signed(net)} medlemmer.`
      const growth = a.totalPrev !== null ? a.total - a.totalPrev : null
      if (growth !== null && growth !== net) {
        body += ` Bemærk at forskellen til den samlede udvikling (${signed(growth)}) skyldes forskudte udmeldelser.`
      }
      const last6 = a.flowsToDate.slice(-6).reverse()
      if (last6.length > 1) {
        body += ` De seneste måneder: ${last6.map((x) => `${x.month.slice(5)}-${x.month.slice(2, 4)}: ${fmtNum(x.ind)}/${fmtNum(x.ud)} (${signed((x.ind ?? 0) - (x.ud ?? 0))})`).join(', ')}.`
      }
      paragraphs.push({ title: 'Ind- og udmeldelser', body })
    }
  }

  // 5. Målet
  {
    const gap = goal.gapToday
    const body = `Målet er ${fmtNum(goal.target)} medlemmer 31.12.29. Det kræver ${fmtNum(goal.requiredPerYear)} nye medlemmer om året fra ${fmtNum(goal.from.total)} ved udgangen af ${yearOf(goal.from.date)}. `
      + `Med ${fmtNum(a.total)} medlemmer ligger vi ${gap >= 0 ? `${fmtNum(gap)} foran` : `${fmtNum(-gap)} efter`} den lige linje mod målet.`
    paragraphs.push({ title: 'Mål 2029', body })
  }

  const text = [
    'Kære alle',
    '',
    `Så er det tid til en kort status på medlemsudviklingen i ${m}.`,
    '',
    ...paragraphs.flatMap((p) => [`${p.title}: ${p.body}`, '']),
    `Dashboardet med alle tal og grafer: ${SITE_URL}`,
  ].join('\n')

  return { subject: `Medlemsudvikling – status ${monthYear(a.date)}`, text, paragraphs }
}

export const SITE_URL = 'https://sebastianlistfeirup.github.io/DPDashboard/'
