#!/usr/bin/env python3
"""
Bygger public/data/movements.json ud af de månedlige medlemslister.

Listerne ligger i data/medlemslister/ (ignoreres af git — de indeholder
personoplysninger) og læses via scripts/parse_lists.py, der kun beholder de
kolonner analyserne bruger. Denne fil skriver KUN optællinger. Ingen
medlemsnumre, datoer på personer eller andet, der kan føres tilbage til én,
ender i JSON'en.

Definitioner:
  Indmeldelse i måned M   = DP Indm.dato ligger i M (master-feltet).
  Udmeldelse i måned M    = DP Udm.dato ligger i M. Medlemmet står stadig på
                            listen ultimo M og er væk fra listen ultimo M+1 —
                            det er derfor "man kigger måneden før".
  Bevægelse               = samme stamkort med forskellig kontingentgruppe
                            på to lister lige efter hinanden.
  Kontingentskift         = kandidat → normalansat/selvstændig; sker 24–25
                            måneder efter cand.psych.-datoen.
  Kohorte                 = alle med cand.psych. i samme år, fulgt måned for
                            måned fra cand.psych.-måneden.

Kør:  python3 scripts/parse_lists.py && python3 scripts/build_movements.py
"""
from __future__ import annotations

import collections
import json
import os
import pickle
import re
import sys
from datetime import date, datetime, timezone

from openpyxl import load_workbook

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'medlemslister')
CACHE = os.path.join(ROOT, '.cache', 'lists.pkl')
OUT = os.path.join(ROOT, 'public', 'data', 'movements.json')
OUT_MONTHS = os.path.join(ROOT, 'data', 'liste_maaneder.json')

# Kontingenttype → gruppe. Grupperne er dem, bevægelserne fortælles i.
GROUP = {
    'Normaltansat over 19 timer': 'normal', 'Selvstændig': 'selv', 'Ph.d. studerende': 'phd',
    '1 og 2 års Kandidater': 'kandidat', 'Studerende DP': 'stud', 'Psykologistuderende': 'stud',
    'Ledig DP': 'ledig', 'Ledig ikke ret til dagpenge': 'ledig', 'Med løntilskud': 'ledig', 'Orlov uden løn DP': 'ledig',
    'Pensionist DP': 'pens', 'Pensionist DP - Udland': 'pens', 'Efterløn DP': 'pens',
}
GROUP_LABEL = {
    'normal': 'Normalansat', 'selv': 'Selvstændig', 'phd': 'Ph.d.', 'kandidat': '1.-2. års kandidat',
    'stud': 'Studerende', 'ledig': 'Ledig/orlov', 'pens': 'Pensionist', 'andet': 'Øvrige',
    'ind': 'Indmeldt', 'ud': 'Udmeldt',
}
def grp(t): return GROUP.get(t, 'andet')

AGE_BANDS = [(0, 24, '–24'), (25, 29, '25–29'), (30, 34, '30–34'), (35, 39, '35–39'), (40, 44, '40–44'),
             (45, 49, '45–49'), (50, 54, '50–54'), (55, 59, '55–59'), (60, 64, '60–64'), (65, 69, '65–69'), (70, 200, '70+')]
def age_band(age):
    if age is None: return 'ukendt'
    for lo, hi, lab in AGE_BANDS:
        if lo <= age <= hi: return lab
    return 'ukendt'

TENURE_BANDS = [(0, 11, '<1 år'), (12, 23, '1–2 år'), (24, 59, '2–5 år'), (60, 119, '5–10 år'), (120, 239, '10–20 år'), (240, 10**6, '20+ år')]
def tenure_band(months):
    if months is None: return 'ukendt'
    for lo, hi, lab in TENURE_BANDS:
        if lo <= months <= hi: return lab
    return 'ukendt'

def ym(d: date) -> str: return f'{d.year}-{d.month:02d}'
def months_between(a: str, b: str) -> int:
    ay, am = map(int, a.split('-')); by, bm = map(int, b.split('-'))
    return (by - ay) * 12 + (bm - am)
def add_months(k: str, n: int) -> str:
    y, m = map(int, k.split('-')); m += n
    return f'{y + (m - 1) // 12}-{(m - 1) % 12 + 1:02d}'

# Systemskiftet 1.–2. december 2022: alle daværende medlemmer fik DP Udm.dato
# 01.12.22 og DP Indm.dato 02.12.22. De to datoer er ikke bevægelser.
MIGRATION_UD = date(2022, 12, 1)
MIGRATION_IN = date(2022, 12, 2)
def is_migration_in(d): return d == MIGRATION_IN
def is_migration_ud(d): return d == MIGRATION_UD

KREDS_CLEAN = {'Nordsjælland ': 'Nordsjælland', 'Viborg "Limfjord"': 'Viborg', 'Kreds Trekantsområdet': 'Trekantsområdet',
               'Dansk Psykolog Forening': 'Uden kreds (studerende m.fl.)'}
def kreds(k): return KREDS_CLEAN.get(k, k) if k else 'Ukendt'


def load_reasons() -> dict[str, str]:
    """IndUdm: stamkort → udmeldelsesårsag. Kun årsagen bruges."""
    path = os.path.join(SRC, 'IndUdm_07_09_26.xlsx')
    out = {}
    if not os.path.exists(path): return out
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    reason = None
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i < 4: continue
        if r[1]: reason = str(r[1]).strip()
        if r[2]: out[str(r[2]).strip()] = reason or 'Årsag ukendt'
    return out

REASON_LABEL = {
    'Årsag Ukendt': 'Ukendt', 'Anden årsag': 'Anden årsag', 'Pension': 'Pension', 'Lukket grundet restance': 'Restance',
    'Medlemskab for dyrt': 'For dyrt', 'Skift af medlemstype': 'Skift af medlemstype', 'Økonomiske problemer': 'Økonomi',
    'Utilfreds med DP': 'Utilfreds med DP', 'Organiseret andet sted': 'Organiseret andet sted', 'Død': 'Død',
    'Studiestop': 'Studiestop', 'Flytter til udlandet': 'Udlandet', 'Barsel': 'Barsel', 'Længerevarende sygdom': 'Sygdom',
    'Adresseænding': 'Adresseændring', 'Efterløn': 'Efterløn',
}


def load_students(L: dict, latest: dict) -> dict:
    """Uddannelseslisten: nuværende studerende efter niveau og forventet slutdato,
    de planlagte overgange (Fremtidig medlemstype/dato) og hvornår i studiet
    medlemmerne meldte sig ind. Kun optællinger kommer ud."""
    path = os.path.join(SRC, 'MedlemslisteUddannelse_07_09_26.xlsx')
    if not os.path.exists(path): return {}
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    it = ws.iter_rows(values_only=True)
    hdr = list(next(it))
    ix = {h: i for i, h in enumerate(hdr) if h}
    def dd(v):
        if isinstance(v, datetime): return v.date()
        return v if isinstance(v, date) else None
    by_year = collections.Counter(); by_month = collections.Counter(); by_level_month = collections.defaultdict(collections.Counter)
    uni = collections.Counter(); level = collections.Counter(); uni_all = collections.defaultdict(collections.Counter)
    planned = collections.defaultdict(collections.Counter)   # måned → (fra→til) → n
    planned_pairs = collections.Counter()
    planned_sk = set()
    join_year = collections.Counter()   # studieår ved indmeldelse, for nuværende studerende
    join_year_all = collections.Counter()  # for alle med kendt studiestart
    seen = set()
    today = date(2026, 9, 7)
    for r in it:
        if len(r) < len(hdr): r = tuple(r) + (None,) * (len(hdr) - len(r))
        sk = str(r[ix['Stamkort Person']]).strip() if r[ix['Stamkort Person']] else None
        if not sk: continue
        mtype = r[ix['Medlemstype']]
        # Planlagte overgange (systemets egne)
        ft, fdt = r[ix['Fremtidig Medlemstype']], dd(r[ix['Fremtidig Dato']])
        if ft and fdt and fdt >= today and (sk, 'p') not in seen:
            seen.add((sk, 'p'))
            pair = f"{grp(mtype)}→{grp(ft)}"
            planned[ym(fdt)][pair] += 1; planned_pairs[pair] += 1
            planned_sk.add(sk)
        # Hvornår i studiet meldte de sig ind? (studiestart → DP-indmeldelse)
        start = dd(r[ix['Uddannelse startdato']])
        rec = latest.get(sk)
        if start and start.year > 1950 and rec and rec[1]['dpin'] and not is_migration_in(rec[1]['dpin']) and r[ix['Uddannelse']] in ('Bachelor i psykologi', 'Cand. psych.'):
            k = months_between(ym(start), ym(rec[1]['dpin']))
            # Rækken er enten bachelordelen eller kandidatdelen; studiestart gælder den del.
            if r[ix['Uddannelse']] == 'Bachelor i psykologi':
                band = 'før studiestart' if k < 0 else '1. år' if k < 12 else '2. år' if k < 24 else '3. år' if k < 36 else 'senere'
            else:
                band = 'i bachelordelen' if k < 0 else '4. år' if k < 12 else '5. år' if k < 24 else 'senere'
            if (sk, 'j') not in seen:
                seen.add((sk, 'j')); join_year_all[band] += 1
                if mtype == 'Studerende DP': join_year[band] += 1
        if mtype != 'Studerende DP' or (sk, 's') in seen: continue
        seen.add((sk, 's'))
        lvl = 'kandidatdel' if r[ix['Uddannelse']] == 'Cand. psych.' else 'bachelordel' if r[ix['Uddannelse']] == 'Bachelor i psykologi' else 'andet'
        level[lvl] += 1
        uni_all[(r[ix['Uddannelsessted']] or 'Ukendt')][lvl] += 1
        d = dd(r[ix['Beregnet slutdato']])
        if not d or d.year >= 2099: by_year['ukendt'] += 1; continue
        if d < today: by_year['overskredet'] += 1; by_level_month['overskredet'][lvl] += 1; continue
        by_year[str(d.year)] += 1
        by_month[ym(d)] += 1
        by_level_month[ym(d)][lvl] += 1
        uni[r[ix['Uddannelsessted']] or 'Ukendt'] += 1
    order = ['før studiestart', '1. år', '2. år', '3. år', 'i bachelordelen', '4. år', '5. år', 'senere']
    return dict(byExpectedYear=dict(sorted(by_year.items())), byExpectedMonth=dict(sorted(by_month.items())),
                byExpectedMonthLevel={m: dict(c) for m, c in sorted(by_level_month.items())},
                byUniversity=dict(uni.most_common()), byLevel=dict(level),
                byUniversityAll={u: dict(c) for u, c in sorted(uni_all.items(), key=lambda t: -sum(t[1].values()))},
                planned=[dict(month=m, **dict(c)) for m, c in sorted(planned.items())],
                plannedPairs=dict(planned_pairs.most_common()),
                joinYear=[dict(band=b, students=join_year.get(b, 0), all=join_year_all.get(b, 0)) for b in order],
                _plannedSk=planned_sk)


def main() -> None:
    if not os.path.exists(CACHE):
        raise SystemExit('Kør først scripts/parse_lists.py')
    L: dict[str, dict] = pickle.load(open(CACHE, 'rb'))
    keys = sorted(L)
    first, last = keys[0], keys[-1]
    reasons = load_reasons()

    # ── Én samlet post pr. medlem (seneste liste, det står på) ───────────────
    latest: dict[str, tuple[str, dict]] = {}
    first_seen: dict[str, str] = {}
    last_seen: dict[str, str] = {}
    first_type: dict[str, str] = {}
    for k in keys:
        for sk, r in L[k].items():
            latest[sk] = (k, r)
            first_seen.setdefault(sk, k); first_type.setdefault(sk, r['type'])
            last_seen[sk] = k

    def age_at(r, k):  # alder ved en liste-måned
        return int(k[:4]) - r['by'] if r['by'] else None

    # ── Ind- og udmeldelser pr. måned ────────────────────────────────────────
    months = [add_months('2022-01', i) for i in range(months_between('2022-01', last) + 1)]
    flows = {m: dict(month=m, ind=0, ud=0, indByGroup=collections.Counter(), udByGroup=collections.Counter(),
                     indByAge=collections.Counter(), udByAge=collections.Counter(), udByTenure=collections.Counter(),
                     udByReason=collections.Counter(), indByKreds=collections.Counter(), udByKreds=collections.Counter(),
                     udBySex=collections.Counter(), indBySex=collections.Counter()) for m in months}
    seen_in, seen_ud = set(), set()
    for k in keys:
        for sk, r in L[k].items():
            if r['dpin'] and not is_migration_in(r['dpin']) and (sk, r['dpin']) not in seen_in:
                seen_in.add((sk, r['dpin'])); m = ym(r['dpin'])
                if m in flows:
                    f = flows[m]; f['ind'] += 1
                    f['indByGroup'][grp(first_type.get(sk, r['type']))] += 1
                    f['indByAge'][age_band(age_at(r, m))] += 1
                    f['indByKreds'][kreds(r['kreds'])] += 1
                    f['indBySex'][r['sex'] or 'Ukendt'] += 1
            if r['dpud'] and not is_migration_ud(r['dpud']) and (sk, r['dpud']) not in seen_ud and r['dpud'] <= date(int(last[:4]), int(last[5:]), 28):
                seen_ud.add((sk, r['dpud'])); m = ym(r['dpud'])
                if m in flows:
                    f = flows[m]; f['ud'] += 1
                    f['udByGroup'][grp(r['type'])] += 1
                    f['udByAge'][age_band(age_at(r, m))] += 1
                    if r['dpin'] and is_migration_in(r['dpin']): f['udByTenure']['medlem før dec. 2022'] += 1
                    else:
                        ten = months_between(ym(r['dpin']), m) if r['dpin'] else None
                        f['udByTenure'][tenure_band(ten)] += 1
                    f['udByReason'][REASON_LABEL.get(reasons.get(sk, 'Årsag Ukendt'), reasons.get(sk, 'Ukendt'))] += 1
                    f['udByKreds'][kreds(r['kreds'])] += 1
                    f['udBySex'][r['sex'] or 'Ukendt'] += 1
    # Nettotal og listestørrelse
    for m in months:
        flows[m]['net'] = flows[m]['ind'] - flows[m]['ud']
        flows[m]['members'] = len(L[m]) if m in L else None
    flow_list = [{k: (dict(v) if isinstance(v, collections.Counter) else v) for k, v in f.items()} for f in flows.values()]

    # Opsagte, endnu ikke udmeldte: udm.dato efter seneste liste
    last_date = date(int(last[:4]), int(last[5:]), 28)
    pending = collections.Counter(); pending_group = collections.Counter()
    for sk, r in L[last].items():
        if r['dpud'] and r['dpud'] > last_date:
            pending[ym(r['dpud'])] += 1; pending_group[grp(r['type'])] += 1
    pending_list = [dict(month=m, n=n) for m, n in sorted(pending.items())]

    # ── Bevægelser mellem grupper, liste for liste ──────────────────────────
    transitions = []
    for a, b in zip(keys, keys[1:]):
        A, B = L[a], L[b]
        c = collections.Counter()
        for sk, r in A.items():
            ga = grp(r['type'])
            gb = grp(B[sk]['type']) if sk in B else 'ud'
            if ga != gb: c[(ga, gb)] += 1
        for sk, r in B.items():
            if sk not in A: c[('ind', grp(r['type']))] += 1
        transitions.append(dict(month=b, gap=months_between(a, b), moves=[dict(from_=x, to=y, n=n) for (x, y), n in sorted(c.items(), key=lambda t: -t[1])]))

    # ── Kontingentskift: hvornår, og hvad sker der ──────────────────────────
    # Måneder siden cand.psych. når en kandidat bliver fuldtidsbetalende
    shift_k = collections.Counter(); shift_month = collections.Counter(); shift_year_out = collections.Counter()
    for a, b in zip(keys, keys[1:]):
        for sk, r in L[a].items():
            if r['type'] != '1 og 2 års Kandidater': continue
            gb = grp(L[b][sk]['type']) if sk in L[b] else 'ud'
            if gb in ('normal', 'selv', 'phd') and r['cand']:
                shift_k[months_between(ym(r['cand']), b)] += 1
                shift_month[int(b[5:])] += 1
            # Hvad sker der med kandidater i det hele taget pr. år
            if gb != 'kandidat':
                shift_year_out[(b[:4], gb)] += 1
    # Hvad blev der af dem, der nåede kontingentskiftet? Pr. skifte-år:
    # tag alle, der var kandidat 24 måneder efter cand, og se status 3 måneder senere.
    outcome = collections.defaultdict(collections.Counter)
    for sk, (k, r) in latest.items():
        pass
    cand_of = {sk: r['cand'] for sk, (k, r) in latest.items() if r['cand']}
    for sk, c in cand_of.items():
        m24 = add_months(ym(c), 24); m27 = add_months(ym(c), 27)
        if m24 not in L or m27 not in L: continue
        r24 = L[m24].get(sk)
        if not r24 or r24['type'] != '1 og 2 års Kandidater': continue
        r27 = L[m27].get(sk)
        outcome[m27[:4]][grp(r27['type']) if r27 else 'ud'] += 1
    outcome_list = [dict(year=y, **{k: v for k, v in c.items()}) for y, c in sorted(outcome.items())]

    students = load_students(L, latest)
    planned_sk = students.pop('_plannedSk', set())
    # Forventede kontingentskift frem i tiden: kandidater på seneste liste UDEN en
    # planlagt overgang i systemet, cand + 25 mdr. (De planlagte tælles fra uddannelseslisten.)
    upcoming = collections.Counter()
    for sk, r in L[last].items():
        if r['type'] == '1 og 2 års Kandidater' and r['cand'] and sk not in planned_sk:
            m = add_months(ym(r['cand']), 25)
            if m > last: upcoming[m] += 1
    upcoming_list = [dict(month=m, n=n) for m, n in sorted(upcoming.items())]

    # ── Kohorter efter cand.psych.-år ───────────────────────────────────────
    cohorts = {}
    for year in range(2021, int(last[:4]) + 1):
        members = {sk for sk, c in cand_of.items() if c.year == year}
        if not members: continue
        # Kun dem, der var medlem inden for 6 måneder efter cand.psych.
        base = set()
        for sk in members:
            c = cand_of[sk]
            for k in range(0, 7):
                m = add_months(ym(c), k)
                if m in L and sk in L[m]: base.add(sk); break
        series = collections.defaultdict(collections.Counter)
        for sk in base:
            c = cand_of[sk]
            for k in range(0, 61):
                m = add_months(ym(c), k)
                if m not in L or m > last: continue
                r = L[m].get(sk)
                if r: series[k][grp(r['type'])] += 1
                elif m > first_seen.get(sk, '9999'): series[k]['ud'] += 1
                else: series[k]['ikke_endnu'] += 1
        by_uni = collections.Counter(latest[sk][1]['uni'] or 'Ukendt' for sk in base)
        cohorts[str(year)] = dict(n=len(base), series=[dict(k=k, **{g: n for g, n in c.items()}) for k, c in sorted(series.items())], byUniversity=dict(by_uni.most_common()))

    # Studerende-tragt: hvad sker der med studerende, der forlader kategorien
    stud_out = collections.defaultdict(collections.Counter)
    for a, b in zip(keys, keys[1:]):
        for sk, r in L[a].items():
            if r['type'] != 'Studerende DP': continue
            gb = grp(L[b][sk]['type']) if sk in L[b] else 'ud'
            if gb != 'stud': stud_out[b[:4]][gb] += 1
    stud_out_list = [dict(year=y, **dict(c)) for y, c in sorted(stud_out.items())]

    # ── De ledige: forløb, varighed og udfald ───────────────────────────────
    # Et forløb = sammenhængende måneder i en ledig-kategori (Ledig DP, Ledig
    # uden dagpengeret, løntilskud — orlov holdes udenfor). Forløb, der allerede
    # var i gang på første liste, kan ikke måles i længde (kun i bestanden).
    UNEMP = {'Ledig DP', 'Ledig ikke ret til dagpenge', 'Med løntilskud'}
    is_un = lambda r: r is not None and r['type'] in UNEMP  # noqa: E731
    spells = []  # dict(start, end, entry_from, exit_to, months, censored)
    open_sp: dict[str, dict] = {}
    for i, k in enumerate(keys):
        prev = L[keys[i - 1]] if i else {}
        cur = L[k]
        # afslut forløb for dem, der ikke længere er ledige
        for sk, sp in list(open_sp.items()):
            r = cur.get(sk)
            if is_un(r):
                sp['last'] = k
                continue
            sp['exit_to'] = grp(r['type']) if r else 'ud'
            sp['end'] = k
            spells.append(sp); del open_sp[sk]
        # start forløb for nye ledige
        for sk, r in cur.items():
            if is_un(r) and sk not in open_sp:
                p = prev.get(sk)
                open_sp[sk] = dict(start=k, last=k, entry_from=(grp(p['type']) if p else ('ind' if i else 'ukendt')),
                                   left_censored=(i == 0), age=age_at(r, k), sex=r['sex'])
    for sk, sp in open_sp.items():
        sp['exit_to'] = 'stadig ledig'; sp['end'] = None; spells.append(sp)
    def spell_len(sp):  # måneder i ledighed (mindst 1)
        end = sp['end'] or last
        return max(1, months_between(sp['start'], end))
    measurable = [sp for sp in spells if not sp['left_censored'] and sp['start'] >= '2022-02']
    # Udfald pr. startår (kun afsluttede + stadig ledige)
    un_outcome = collections.defaultdict(collections.Counter)
    un_entry = collections.defaultdict(collections.Counter)
    for sp in measurable:
        un_outcome[sp['start'][:4]][sp['exit_to']] += 1
        un_entry[sp['start'][:4]][sp['entry_from']] += 1
    # Varighed: andel stadig ledig efter k måneder (kun forløb, hvor k måneder kan observeres)
    surv = []
    for kk in range(0, 25):
        at_risk = [sp for sp in measurable if months_between(sp['start'], last) >= kk]
        still = sum(1 for sp in at_risk if spell_len(sp) > kk or (sp['end'] is None and months_between(sp['start'], last) >= kk))
        surv.append(dict(k=kk, n=len(at_risk), still=still))
    # Længde af afsluttede forløb, i bånd, efter udfald
    DUR = [(1, 3, '1–3 mdr.'), (4, 6, '4–6 mdr.'), (7, 12, '7–12 mdr.'), (13, 24, '1–2 år'), (25, 10**6, 'over 2 år')]
    def dur_band(n):
        for lo, hi, lab in DUR:
            if lo <= n <= hi: return lab
        return 'ukendt'
    un_dur = collections.defaultdict(collections.Counter)
    for sp in measurable:
        if sp['end']: un_dur[dur_band(spell_len(sp))][sp['exit_to']] += 1
    # Bestanden nu efter varighed (inkl. de venstre-censurerede: "over 2 år" el. ukendt)
    stock_now = collections.Counter()
    for sp in spells:
        if sp['end'] is None:
            stock_now['over 4 år (fra før 2022)' if sp['left_censored'] else dur_band(spell_len(sp))] += 1
    completed = [spell_len(sp) for sp in measurable if sp['end']]
    completed.sort()
    median = completed[len(completed) // 2] if completed else None
    # Udmeldelsesrate for ledige pr. måned i ledighed: hvor i forløbet melder de sig ud?
    ud_by_k = collections.Counter()
    for sp in measurable:
        if sp['exit_to'] == 'ud': ud_by_k[min(spell_len(sp), 25)] += 1
    unemployment = dict(
        outcomeByStartYear=[dict(year=y, **dict(c)) for y, c in sorted(un_outcome.items())],
        entryByStartYear=[dict(year=y, **dict(c)) for y, c in sorted(un_entry.items())],
        survival=surv,
        durationByOutcome={b: dict(c) for b, c in un_dur.items()},
        stockNow=dict(stock_now.most_common()),
        medianMonths=median, completedSpells=len(completed), measurableSpells=len(measurable),
        udByMonth=[dict(k=k, n=n) for k, n in sorted(ud_by_k.items())],
    )

    # ── Medlemmerne på seneste liste: alder, køn, kreds, sektor ─────────────
    cur = L[last]
    age_by_group = collections.defaultdict(collections.Counter)
    sex_by_group = collections.defaultdict(collections.Counter)
    kreds_now = collections.Counter(); kreds_ly = collections.Counter()
    sektor_now = collections.Counter(); ans_now = collections.Counter(); uni_now = collections.Counter(); region_now = collections.Counter()
    ly = add_months(last, -12)
    for sk, r in cur.items():
        g = grp(r['type'])
        age_by_group[g][age_band(age_at(r, last))] += 1
        sex_by_group[g][r['sex'] or 'Ukendt'] += 1
        kreds_now[kreds(r['kreds'])] += 1
        if g in ('normal', 'selv', 'phd', 'kandidat'):
            sektor_now[r['sektor'] or 'Ikke oplyst'] += 1
            ans_now[r['ans'] or 'Ikke oplyst'] += 1
            region_now[r['region'] or 'Ikke oplyst'] += 1
        if r['cand']: uni_now[r['uni'] or 'Ukendt'] += 1
    for sk, r in L.get(ly, {}).items():
        kreds_ly[kreds(r['kreds'])] += 1
    # Ind/ud pr. kreds seneste 12 mdr.
    kreds_in12 = collections.Counter(); kreds_out12 = collections.Counter()
    for m in months[-12:]:
        for kk, n in flows[m]['indByKreds'].items(): kreds_in12[kk] += n
        for kk, n in flows[m]['udByKreds'].items(): kreds_out12[kk] += n
    kreds_list = [dict(kreds=k, n=n, ly=kreds_ly.get(k, 0), ind12=kreds_in12.get(k, 0), ud12=kreds_out12.get(k, 0))
                  for k, n in kreds_now.most_common()]

    # Aldersfordeling (uden studerende) pr. december — til sammenligning med
    # DST's bestand af psykologuddannede samme år.
    age_dec = {}
    for k in keys:
        if not k.endswith('-12'): continue
        c = collections.Counter(age_band(age_at(r, k)) for r in L[k].values() if grp(r['type']) != 'stud')
        age_dec[k[:4]] = dict(c)

    # Pension-pipelinen: fuldtidsbetalende der fylder 67 (folkepensionsalder 2026→) pr. år
    pension = collections.Counter()
    for sk, r in cur.items():
        if grp(r['type']) in ('normal', 'selv') and r['by']:
            y67 = r['by'] + 67
            if int(last[:4]) <= y67 <= 2035: pension[str(y67)] += 1
            elif y67 < int(last[:4]): pension['allerede over 67'] += 1
    # Gennemsnitsalder pr. gruppe
    avg_age = {}
    for g, c in age_by_group.items():
        ages = [age_at(r, last) for r in cur.values() if grp(r['type']) == g and r['by']]
        avg_age[g] = round(sum(ages) / len(ages), 1) if ages else None

    # ── Årsager pr. år og gruppe ────────────────────────────────────────────
    reason_year = collections.defaultdict(collections.Counter)
    reason_group = collections.defaultdict(collections.Counter)
    for m in months:
        for rr, n in flows[m]['udByReason'].items(): reason_year[m[:4]][rr] += n
    seen_ud2 = set()
    for k in keys:
        for sk, r in L[k].items():
            if r['dpud'] and not is_migration_ud(r['dpud']) and (sk, r['dpud']) not in seen_ud2 and r['dpud'] >= date(2022, 1, 1) and r['dpud'] <= last_date:
                seen_ud2.add((sk, r['dpud']))
                reason_group[grp(r['type'])][REASON_LABEL.get(reasons.get(sk, 'Årsag Ukendt'), 'Ukendt')] += 1

    # ── Udmeldelsesrate pr. gruppe (seneste 12 mdr., i % af gennemsnitlig bestand) ──
    rate = {}
    for g in GROUP_LABEL:
        if g in ('ind', 'ud'): continue
        ud12 = sum(flows[m]['udByGroup'].get(g, 0) for m in months[-12:])
        stock = [sum(1 for r in L[m].values() if grp(r['type']) == g) for m in months[-12:] if m in L]
        avg = sum(stock) / len(stock) if stock else 0
        rate[g] = dict(ud12=ud12, avgStock=round(avg), pct=round(ud12 / avg * 100, 1) if avg else None)

    # ══════════════════════════════════════════════════════════════════════
    # 1. PROGNOSE: fuldtidsbetalende 24 måneder frem
    #
    # Bestanden af fuldtidsbetalende (normal + selv + phd) fremskrives måned
    # for måned. Tilgangen fra kandidater kommer fra de planlagte kontingent-
    # skift (uddannelseslisten) × den historiske konvertering. Alle andre
    # bevægelser ind og ud af gruppen (nye medlemmer, ledige der får job,
    # udmeldelser, pension, ledighed …) tages som gennemsnittet for samme
    # kalendermåned de seneste to år. Usikkerheden er spredningen på de
    # historiske måneder, kumuleret.
    # ══════════════════════════════════════════════════════════════════════
    FT = ('normal', 'selv', 'phd')
    def ft_count(k): return sum(1 for r in L[k].values() if grp(r['type']) in FT)
    # Månedlige bevægelser ind/ud af fuldtidsgruppen, opdelt på kilde
    mv_hist = {}  # måned → dict(skift, ind_new, ind_ledig, ind_andet, ud_ud, ud_pens, ud_ledig, ud_andet, net)
    for a, b in zip(keys, keys[1:]):
        if months_between(a, b) != 1: continue
        c = collections.Counter()
        A, B = L[a], L[b]
        for sk, r in A.items():
            ga = grp(r['type']); gb = grp(B[sk]['type']) if sk in B else 'ud'
            if ga in FT and gb not in FT:
                c['ud_' + ('ud' if gb == 'ud' else 'pens' if gb == 'pens' else 'ledig' if gb == 'ledig' else 'andet')] += 1
            elif ga not in FT and gb in FT:
                c['ind_' + ('skift' if ga == 'kandidat' else 'ledig' if ga == 'ledig' else 'andet')] += 1
        for sk, r in B.items():
            if sk not in A and grp(r['type']) in FT: c['ind_new'] += 1
        c['stock_a'] = ft_count(a); c['stock_b'] = ft_count(b)
        mv_hist[b] = dict(c)
    hist_months = sorted(mv_hist)
    # Gennemsnit pr. kalendermåned af de "andre" bevægelser, seneste 24 måneder
    OTHER = ['ind_new', 'ind_ledig', 'ind_andet', 'ud_ud', 'ud_pens', 'ud_ledig', 'ud_andet']
    def other_net(m): c = mv_hist[m]; return sum(c.get(k, 0) for k in OTHER if k.startswith('ind')) - sum(c.get(k, 0) for k in OTHER if k.startswith('ud'))
    recent = hist_months[-24:]
    by_cal = collections.defaultdict(list)
    for m in recent: by_cal[int(m[5:])].append(m)
    avg_other = {mo: {k: sum(mv_hist[m].get(k, 0) for m in ms) / len(ms) for k in OTHER} for mo, ms in by_cal.items()}
    resid = [other_net(m) - (sum(avg_other[int(m[5:])][k] for k in OTHER if k.startswith('ind')) - sum(avg_other[int(m[5:])][k] for k in OTHER if k.startswith('ud'))) for m in recent]
    sd = (sum(x * x for x in resid) / max(1, len(resid) - 1)) ** 0.5
    # Konvertering ved skiftet (andel af planlagte, der rent faktisk bliver fuldtid)
    conv = 0.94
    if outcome_list:
        tot = sum(sum(v for k, v in o.items() if k != 'year') for o in outcome_list)
        ft_ok = sum(sum(v for k, v in o.items() if k in FT) for o in outcome_list)
        if tot: conv = ft_ok / tot
    planned_by_month = {p['month']: sum(v for k, v in p.items() if k in ('kandidat→normal', 'kandidat→selv', 'kandidat→phd')) for p in students.get('planned', [])}
    computed_by_month = {u['month']: u['n'] for u in upcoming_list}
    # Længere ude: dem, der endnu ikke er kandidater. Planlagte flytninger til
    # kandidat (typisk 1. oktober, 4 mdr. efter cand.psych.) giver skift 21 mdr.
    # senere; studerende med forventet slutdato uden planlagt flytning bliver
    # kandidater i godt halvdelen af tilfældene (se studerende-tragten) og
    # skifter 25 mdr. efter slutdatoen.
    future_kand = collections.Counter()
    for pth in students.get('planned', []):
        n = sum(v for k, v in pth.items() if k in ('stud→kandidat', 'ledig→kandidat'))
        if n: future_kand[add_months(pth['month'], 21)] += n
    stud_share = 0.55
    for mth, n in students.get('byExpectedMonth', {}).items():
        planned_here = sum(v for k, v in (next((x for x in students.get('planned', []) if x['month'] == mth), {}) or {}).items() if k in ('stud→kandidat', 'ledig→kandidat'))
        future_kand[add_months(mth, 25)] += max(0, n - planned_here) * stud_share
    # Pension: erstat den historiske pens-afgang med aldersfordelingen, hvis den er større
    stock = ft_count(last)
    base_year = int(last[:4]); base_ft = None
    dec_prev = f'{base_year - 1}-12'
    if dec_prev in L: base_ft = ft_count(dec_prev)
    forecast = []
    m = last
    lo = hi = stock
    cum_var = 0.0
    year_end_ft = {}
    for i in range(24):
        m = add_months(m, 1); mo = int(m[5:])
        skift = (planned_by_month.get(m, 0) + computed_by_month.get(m, 0) + future_kand.get(m, 0)) * conv
        o = avg_other.get(mo, {k: 0 for k in OTHER})
        ind = o['ind_new'] + o['ind_ledig'] + o['ind_andet']
        ud = o['ud_ud'] + o['ud_pens'] + o['ud_ledig'] + o['ud_andet']
        stock = stock + skift + ind - ud
        cum_var += sd * sd
        band = cum_var ** 0.5
        y = int(m[:4])
        if mo == 12: year_end_ft[y] = stock
        base = base_ft if y == base_year else year_end_ft.get(y - 1)
        forecast.append(dict(month=m, stock=round(stock), low=round(stock - band), high=round(stock + band),
                             konge=round(stock - base) if base else None, kongeLow=round(stock - band - base) if base else None, kongeHigh=round(stock + band - base) if base else None,
                             skift=round(skift), ind=round(ind), ud=round(ud)))
    # Backtest: samme metode startet 12 måneder tidligere (skift = cand + 25 mdr. fra listen dengang)
    back = []
    start = add_months(last, -12)
    if start in L:
        st = ft_count(start)
        bstart_year = int(start[:4]); bbase = ft_count(f'{bstart_year - 1}-12') if f'{bstart_year - 1}-12' in L else None
        b_year_end = {}
        # planlagte skift dengang: kandidater på listen start-måned, cand + 25
        b_skift = collections.Counter()
        for sk, r in L[start].items():
            if r['type'] == '1 og 2 års Kandidater' and r['cand']:
                mm = add_months(ym(r['cand']), 25)
                if mm > start: b_skift[mm] += 1
        bm = start
        for i in range(12):
            bm = add_months(bm, 1); mo = int(bm[5:])
            o = avg_other.get(mo, {k: 0 for k in OTHER})
            st = st + b_skift.get(bm, 0) * conv + (o['ind_new'] + o['ind_ledig'] + o['ind_andet']) - (o['ud_ud'] + o['ud_pens'] + o['ud_ledig'] + o['ud_andet'])
            y = int(bm[:4])
            if mo == 12: b_year_end[y] = st
            base = bbase if y == bstart_year else b_year_end.get(y - 1)
            actual = ft_count(bm) if bm in L else None
            actual_base = ft_count(f'{y - 1}-12') if f'{y - 1}-12' in L else None
            back.append(dict(month=bm, expected=round(st), actual=actual,
                             kongeExpected=round(st - base) if base else None,
                             kongeActual=(actual - actual_base) if actual is not None and actual_base is not None else None))
    # Usikkerhed: den in-sample-spredning er for optimistisk. Brug den største af
    # (spredning × √k) og den faktiske fejl på samme horisont i backtesten.
    bt_err = [abs(b['expected'] - b['actual']) for b in back if b['actual'] is not None]
    for i, f in enumerate(forecast):
        k = i + 1
        band = sd * (k ** 0.5)
        if bt_err:
            e = bt_err[min(k, len(bt_err)) - 1]
            band = max(band, e)
        f['low'] = round(f['stock'] - band); f['high'] = round(f['stock'] + band)
        f['delta'] = f['stock'] - ft_count(last)
        f['band'] = round(band)
    prognosis = dict(forecast=forecast, backtest=back, sd=round(sd, 1), conversion=round(conv, 3),
                     stockNow=ft_count(last), baseFt=base_ft,
                     history=[dict(month=m, **{k: mv_hist[m].get(k, 0) for k in ['ind_skift'] + OTHER}, stock=mv_hist[m]['stock_b']) for m in hist_months[-24:]])

    # ══════════════════════════════════════════════════════════════════════
    # 2. DE 30–44-ÅRIGE OG GENINDMELDELSE
    # ══════════════════════════════════════════════════════════════════════
    # Udmeldelser 2023→ efter alder (10-års bånd), gruppe, år siden cand.psych., anciennitet
    def age10(a):
        if a is None: return 'ukendt'
        return 'under 30' if a < 30 else '30–44' if a < 45 else '45–59' if a < 60 else '60+'
    def since_cand_band(r, d):
        if not r['cand']: return 'ingen cand.psych.'
        k = months_between(ym(r['cand']), ym(d))
        return 'før cand.psych.' if k < 0 else 'under 2 år' if k < 24 else '2–5 år' if k < 60 else '5–10 år' if k < 120 else 'over 10 år'
    loss = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
    seen3 = set()
    for k in keys:
        for sk, r in L[k].items():
            d = r['dpud']
            if not d or is_migration_ud(d) or d < date(2023, 1, 1) or d > last_date or (sk, d) in seen3: continue
            seen3.add((sk, d))
            ab = age10(age_at(r, ym(d)))
            loss[ab]['group'][grp(r['type'])] += 1
            loss[ab]['sinceCand'][since_cand_band(r, d)] += 1
            loss[ab]['reason'][REASON_LABEL.get(reasons.get(sk, 'Årsag Ukendt'), 'Ukendt')] += 1
            loss[ab]['year'][str(d.year)] += 1
            ten = 'før dec. 2022' if (r['dpin'] and is_migration_in(r['dpin'])) else tenure_band(months_between(ym(r['dpin']), ym(d)) if r['dpin'] else None)
            loss[ab]['tenure'][ten] += 1
    # Genindmeldelse: stamkort der forsvinder fra listen og dukker op igen
    presence = collections.defaultdict(list)
    for i, k in enumerate(keys):
        for sk in L[k]: presence[sk].append(i)
    reentry = collections.Counter(); reentry_gap = collections.Counter(); reentry_from = collections.Counter(); reentry_to = collections.Counter()
    left_total = collections.Counter()
    for sk, idxs in presence.items():
        # find huller
        for a, b in zip(idxs, idxs[1:]):
            if b - a > 1:
                gap = b - a - 1  # måneder væk
                ka, kb = keys[a], keys[b]
                ra, rb = L[ka][sk], L[kb][sk]
                if gap < 2: continue  # én manglende liste = støj
                reentry['n'] += 1
                reentry_gap['under 1 år' if gap < 12 else '1–2 år' if gap < 24 else 'over 2 år'] += 1
                reentry_from[grp(ra['type'])] += 1
                reentry_to[grp(rb['type'])] += 1
    # hvor mange, der forsvandt 2022-2023, er kommet tilbage inden for 24 mdr.?
    returned = collections.Counter(); left_cnt = collections.Counter()
    for sk, idxs in presence.items():
        for a in idxs:
            if a + 1 < len(keys) and (a + 1) not in idxs:
                kl = keys[a]
                if kl < '2022-01' or kl > add_months(last, -24): continue
                left_cnt[kl[:4]] += 1
                if any(i > a + 1 and i - a - 1 >= 2 and keys[i] <= add_months(kl, 24) for i in idxs):
                    returned[kl[:4]] += 1
    # Indmeldelser i det seneste år: hvor mange var medlem før (genindmeldte)?
    re_new = collections.Counter()
    for m in months[-12:]:
        pass
    first_idx = {sk: idxs[0] for sk, idxs in presence.items()}
    for sk, idxs in presence.items():
        for a, b in zip(idxs, idxs[1:]):
            if b - a - 1 >= 2 and keys[b] > add_months(last, -12): re_new['genindmeldt'] += 1
    new12 = sum(1 for sk, i in first_idx.items() if keys[i] > add_months(last, -12))
    re_new['nye'] = new12
    # Organisationsgrad 30–44 over tid: DP (dec., uden studerende) — DST-bestanden lægges på i frontend
    age_30_44 = {y: sum(v for b, v in c.items() if b in ('30–34', '35–39', '40–44')) for y, c in age_dec.items()}
    middle = dict(loss={ab: {dim: dict(c.most_common()) for dim, c in d.items()} for ab, d in loss.items()},
                  reentry=dict(n=reentry['n'], gap=dict(reentry_gap), fromGroup=dict(reentry_from.most_common()), toGroup=dict(reentry_to.most_common()),
                               returnedWithin24=[dict(year=y, left=left_cnt[y], returned=returned.get(y, 0)) for y in sorted(left_cnt)],
                               last12=dict(re_new)),
                  dp30to44ByYear=age_30_44)

    # ══════════════════════════════════════════════════════════════════════
    # 3. VARSLING: hvem er i risiko for at melde sig ud?
    #
    # Historisk udmeldelsesrate pr. profil (gruppe × alder × anciennitet),
    # målt som: af dem, der stod på listen i august 2023/2024/2025, hvor
    # mange var væk 12 måneder senere? Raten lægges på den seneste liste.
    # ══════════════════════════════════════════════════════════════════════
    def ten_band3(r, k):
        if r['dpin'] and is_migration_in(r['dpin']): return 'før 2023'
        if not r['dpin']: return 'ukendt'
        mm = months_between(ym(r['dpin']), k)
        return 'under 1 år' if mm < 12 else '1–3 år' if mm < 36 else '3–10 år' if mm < 120 else 'over 10 år'
    def cell(r, k): return (grp(r['type']), age10(age_at(r, k)), ten_band3(r, k))
    cell_n = collections.Counter(); cell_gone = collections.Counter()
    snap_keys = [k for k in keys if k[5:] == '08' and add_months(k, 12) in L]
    for k in snap_keys:
        later = L[add_months(k, 12)]
        for sk, r in L[k].items():
            c = cell(r, k); cell_n[c] += 1
            if sk not in later: cell_gone[c] += 1
    overall = sum(cell_gone.values()) / max(1, sum(cell_n.values()))
    cur_cells = collections.Counter(cell(r, last) for r in L[last].values())
    risk_rows = []
    for c, n in cur_cells.items():
        hn = cell_n.get(c, 0)
        crate = (cell_gone.get(c, 0) / hn) if hn >= 40 else None
        risk_rows.append(dict(group=c[0], age=c[1], tenure=c[2], n=n, histN=hn, rate=(round(crate * 100, 1) if crate is not None else None),
                              expected=(round(n * crate) if crate is not None else None)))
    risk_rows.sort(key=lambda x: -(x['rate'] or 0))
    expected_total = sum(x['expected'] or 0 for x in risk_rows)
    high = [x for x in risk_rows if x['rate'] is not None and x['rate'] >= overall * 100 * 1.5 and x['n'] >= 20]
    # Konkrete flag på seneste liste
    students_over = students.get('byExpectedYear', {}).get('overskredet', 0)
    ledig_long = sum(v for b, v in stock_now.items() if b in ('over 2 år', 'over 4 år (fra før 2022)'))
    flags = [
        dict(key='opsagt', label='Har opsagt (udmeldelsesdato i fremtiden)', n=sum(pending.values()), why='Kan stadig nås — de er ikke ude endnu.'),
        dict(key='stud_over', label='Studerende med overskredet slutdato', n=students_over, why='Formentlig færdige. Hver tredje forsvinder, hvis ikke de flyttes til kandidat.'),
        dict(key='ledig_long', label='Ledige i over to år', n=ledig_long, why='Næppe jobsøgende — hver femte af dem ender med at melde sig ud.'),
        dict(key='ny_ft', label='Fuldtidsbetalende, medlem under 1 år', n=sum(1 for r in L[last].values() if grp(r['type']) in FT and r['dpin'] and not is_migration_in(r['dpin']) and months_between(ym(r['dpin']), last) < 12), why='Første år er det farligste for nye fuldtidsbetalende.'),
        dict(key='30_44_ft', label='Fuldtidsbetalende 30–44 år, medlem 1–3 år', n=sum(1 for r in L[last].values() if grp(r['type']) in FT and age10(age_at(r, last)) == '30–44' and ten_band3(r, last) == '1–3 år'), why='Den aldersgruppe, hvor organisationsgraden er lavest.'),
    ]
    # Udmeldelsesrate i risikogruppen over tid (til før/efter-måling): høj-risiko-celler pr. august-snapshot
    high_cells = {(x['group'], x['age'], x['tenure']) for x in high}
    risk_trend = []
    for k in snap_keys:
        later = L[add_months(k, 12)]
        n = gone = 0
        for sk, r in L[k].items():
            if cell(r, k) in high_cells:
                n += 1; gone += (sk not in later)
        risk_trend.append(dict(from_=k, n=n, gone=gone, rate=round(gone / n * 100, 1) if n else None))
    warning = dict(overallRate=round(overall * 100, 1), expectedNext12=expected_total, cells=risk_rows[:40], high=high, flags=flags,
                   riskTrend=risk_trend, snapshots=snap_keys)

    # ── Afstemning mod listestørrelserne ────────────────────────────────────
    sizes = [dict(month=k, n=len(L[k])) for k in keys]

    out = dict(
        meta=dict(generatedAt=datetime.now(timezone.utc).isoformat(timespec='seconds'), first=first, last=last,
                  lists=len(keys), groupLabels=GROUP_LABEL, ageBands=[b[2] for b in AGE_BANDS] + ['ukendt'],
                  tenureBands=[b[2] for b in TENURE_BANDS] + ['medlem før dec. 2022', 'ukendt'],
                  note='Kun optællinger. Ingen personoplysninger.',
                  migration='Systemskiftet 1.–2. december 2022 gav alle daværende medlemmer nye ind-/udmeldelsesdatoer; de er udeladt.'),
        flows=flow_list,
        pending=dict(byMonth=pending_list, byGroup=dict(pending_group), total=sum(pending.values())),
        transitions=transitions,
        shift=dict(monthsSinceCand=[dict(k=k, n=n) for k, n in sorted(shift_k.items()) if 0 <= k <= 40],
                   byCalendarMonth=[shift_month.get(m, 0) for m in range(1, 13)],
                   outcomeByYear=outcome_list, upcoming=upcoming_list,
                   kandidatOutByYear=[dict(year=y, to=t, n=n) for (y, t), n in sorted(shift_year_out.items())]),
        cohorts=cohorts,
        students=dict(outByYear=stud_out_list, **students),
        members=dict(ageByGroup={g: dict(c) for g, c in age_by_group.items()}, avgAge=avg_age,
                     sexByGroup={g: dict(c) for g, c in sex_by_group.items()},
                     kreds=kreds_list, sektor=dict(sektor_now.most_common()), ansaettelse=dict(ans_now.most_common()),
                     university=dict(uni_now.most_common()), regionWork=dict(region_now.most_common()), ageNonStudentByYear=age_dec, pensionByYear=dict(sorted(pension.items()))),
        reasons=dict(byYear={y: dict(c.most_common()) for y, c in sorted(reason_year.items())},
                     byGroup={g: dict(c.most_common()) for g, c in reason_group.items()}),
        churnRate=rate,
        unemployment=unemployment,
        prognosis=prognosis,
        middle=middle,
        warning=warning,
        sizes=sizes,
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

    # Månedstal fra listerne — samme optælling som Ledelsesoverblik-arkene
    # (kontingenttype, sektion, total), så build_data.py kan bruge listerne
    # for de måneder, hvor der ikke findes et ark. Kun tal.
    import calendar as _cal
    months_out = {}
    for k in keys:
        y, mo = int(k[:4]), int(k[5:])
        cats = collections.Counter(r['type'] for r in L[k].values() if r['type'])
        # Før systemskiftet (dec. 2022) var 'Pensionist DP' og 'Pensionist DP - Udland' byttet om.
        if k < '2022-12' and cats.get('Pensionist DP - Udland', 0) > cats.get('Pensionist DP', 0):
            cats['Pensionist DP'], cats['Pensionist DP - Udland'] = cats.get('Pensionist DP - Udland', 0), cats.get('Pensionist DP', 0)
        secs = collections.Counter(r['sek'] for r in L[k].values() if r['sek'])
        months_out[k] = dict(date=f'{y}-{mo:02d}-{_cal.monthrange(y, mo)[1]:02d}', total=len(L[k]),
                             categories=dict(cats.most_common()), sections=dict(secs.most_common()))
    json.dump(months_out, open(OUT_MONTHS, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(f'Skrev {OUT_MONTHS}: {len(months_out)} måneder')
    print(f'Skrev {OUT} ({os.path.getsize(OUT) // 1024} KB): {len(keys)} lister {first} → {last}, '
          f'{sum(f["ind"] for f in flow_list)} indmeldelser og {sum(f["ud"] for f in flow_list)} udmeldelser siden 2022')
    # Sikkerhedstjek: intet stamkort må slippe igennem
    txt = open(OUT, encoding='utf-8').read()
    for sk in list(latest)[:2000]:
        if len(sk) >= 5 and re.search(r'\b' + re.escape(sk) + r'\b', txt):
            print('ADVARSEL: muligt stamkort i output:', sk, file=sys.stderr)


if __name__ == '__main__':
    main()
