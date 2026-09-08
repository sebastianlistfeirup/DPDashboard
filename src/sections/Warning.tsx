/**
 * Varsling: hvem er i risiko for at melde sig ud det næste år?
 *
 * Risikoen er målt, ikke gættet: af dem, der stod på listen i august
 * 2022, 2023, 2024 og 2025, hvor mange var væk tolv måneder senere — pr.
 * profil (gruppe × alder × anciennitet). Den rate lægges på den seneste
 * liste. Dashboardet viser kun antal; navnene trækkes i medlemssystemet.
 */
import { ChartCard, SectionHeading, Reveal } from '@/components/primitives'
import { DivergingBars } from '@/components/lines'
import { fmtNum, fmtPct } from '@/lib/data'
import { GROUP_COLOR, monthLabel, type Movements } from '@/lib/movements'

export function Warning({ mov }: { mov: Movements }) {
  const w = mov.warning
  if (!w) return null
  const labels = mov.meta.groupLabels
  const highN = w.high.reduce((t, c) => t + c.n, 0)
  const highExp = w.high.reduce((t, c) => t + (c.expected ?? 0), 0)
  const flagTotal = w.flags.reduce((t, f) => t + f.n, 0)

  return (
    <>
      <SectionHeading
        kicker="Varsling"
        title={`${fmtNum(w.expectedNext12)} udmeldelser ventes det næste år — ${fmtNum(highExp)} af dem fra ${fmtNum(highN)} medlemmer i risikozonen`}
        lead={`Risikoen er den målte udmeldelsesrate for hver profil af gruppe, alder og anciennitet over de seneste fire år, lagt på listen pr. ${monthLabel(mov.meta.last)}. Gennemsnittet er ${fmtPct(w.overallRate, 1)} om året; risikozonen er profiler med mindst halvanden gang så høj rate.`}
        onDark
        color="#e39687"
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <ChartCard title={`Fem lister at ringe til: ${fmtNum(flagTotal)} medlemmer`} subtitle="Konkrete grupper på den seneste liste, som kan trækkes direkte i medlemssystemet. Nogle medlemmer står på flere lister.">
          <ul className="space-y-3">
            {w.flags.map((f) => (
              <li key={f.key} className="flex items-start gap-3 rounded-xl border border-dp-navy-100 p-3">
                <span className="tnum shrink-0 rounded-lg bg-dp-navy-600 px-2.5 py-1 font-serif text-[1.125rem] font-semibold text-white">{fmtNum(f.n)}</span>
                <div>
                  <div className="text-[0.875rem] font-semibold text-dp-navy-900">{f.label}</div>
                  <div className="text-[0.75rem] leading-snug text-dp-navy-600">{f.why}</div>
                </div>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard title="Risikoprofiler" subtitle="Profiler med mindst 20 medlemmer i dag og mindst 40 i den historiske måling, sorteret efter målt udmeldelsesrate. 'Ventet' er antal × rate.">
          <div className="thin-scroll -mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[34rem] border-collapse text-[0.8125rem]">
              <thead><tr className="border-b border-dp-navy-100 text-dp-navy-500">
                <th className="py-2 pr-3 text-left font-semibold">Gruppe</th><th className="py-2 pr-3 text-left font-semibold">Alder</th><th className="py-2 pr-3 text-left font-semibold">Medlem i</th>
                <th className="py-2 pr-3 text-right font-semibold">Medlemmer</th><th className="py-2 pr-3 text-right font-semibold">Rate</th><th className="py-2 text-right font-semibold">Ventet ud</th>
              </tr></thead>
              <tbody>
                {w.high.slice(0, 16).map((c) => (
                  <tr key={`${c.group}${c.age}${c.tenure}`} className="border-b border-dp-navy-50 last:border-0">
                    <td className="py-1.5 pr-3"><span className="mr-1.5 inline-block h-2 w-2 rounded-[2px] align-middle" style={{ background: GROUP_COLOR[c.group] }} />{labels[c.group]}</td>
                    <td className="py-1.5 pr-3 text-dp-navy-800">{c.age}</td>
                    <td className="py-1.5 pr-3 text-dp-navy-800">{c.tenure}</td>
                    <td className="tnum py-1.5 pr-3 text-right font-semibold text-dp-navy-900">{fmtNum(c.n)}</td>
                    <td className="tnum py-1.5 pr-3 text-right font-semibold" style={{ color: (c.rate ?? 0) >= 10 ? '#d24e46' : '#df790d' }}>{fmtPct(c.rate, 1)}</td>
                    <td className="tnum py-1.5 text-right text-dp-navy-800">{fmtNum(c.expected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">
            Mønstret er tydeligt: det første medlemsår er det farligste i alle grupper (10–13 %), ledige med lang anciennitet og pensionister falder fra med 8–13 %, og de fuldtidsbetalende, der har været med i 3–10 år, ligger under 3 %.
          </p>
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard title="Måler indsatsen: udmeldelsesraten i risikozonen" subtitle="Andel af medlemmerne i risikoprofilerne, der var væk 12 måneder senere — år for år. Det er det tal, der skal falde, når sekretariatet begynder at ringe.">
          <DivergingBars items={w.riskTrend.filter((r) => r.rate !== null).map((r) => ({ label: `aug ${r.from_.slice(2, 4)} → aug ${String(Number(r.from_.slice(0, 4)) + 1).slice(2)}`, value: r.rate }))}
                         height={190} width={420} positiveColor="#d24e46" valueFormat={(n) => fmtPct(n, 1)} />
          <p className="mt-2 text-[0.75rem] leading-relaxed text-dp-navy-500">
            {fmtNum(w.riskTrend[w.riskTrend.length - 1]?.n ?? 0)} medlemmer var i risikozonen i {monthLabel(w.riskTrend[w.riskTrend.length - 1]?.from_ ?? mov.meta.last)}. Næste måling er august {Number(mov.meta.last.slice(0, 4)) + 1}: er raten faldet mod gennemsnittet på {fmtPct(w.overallRate, 1)}, virker det.
          </p>
        </ChartCard>
        <Reveal className="card p-5 sm:p-6">
          <h3 className="text-[1.0625rem] font-semibold text-dp-navy-900">Sådan bliver det til en ringeliste</h3>
          <ol className="mt-3 space-y-2 text-[0.875rem] leading-relaxed text-dp-navy-700">
            {[
              'Træk de fem lister i medlemssystemet efter samme kriterier som her (udmeldelsesdato i fremtiden; studerende med slutdato før i dag; ledig-kategori i over 24 måneder; DP-indmeldelse under 12 måneder og fuldtidskategori; 30–44 år, fuldtid, indmeldt for 1–3 år siden).',
              'Start med de to første — opsagte og studerende med overskredet slutdato. Det er de eneste, hvor én samtale kan ændre udfaldet med det samme.',
              'Notér i systemet, hvem der er kontaktet og hvornår. Så kan vi næste august måle udmeldelsesraten for kontaktede mod ikke-kontaktede i samme profil — det er den eneste måde at vide, om det virkede.',
              'Dashboardet opdateres med hver ny månedsliste; tallene her er antal, aldrig navne.',
            ].map((t, i) => (
              <li key={t} className="flex gap-3"><span className="tnum grid h-6 w-6 shrink-0 place-items-center rounded-full bg-dp-navy-600 text-[0.75rem] font-semibold text-white">{i + 1}</span><span>{t}</span></li>
            ))}
          </ol>
        </Reveal>
      </div>
    </>
  )
}
