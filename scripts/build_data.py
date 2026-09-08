#!/usr/bin/env python3
"""
Bygger public/data/members.json ud af de Excel-ark, der ligger i data/.

Kilder (alle læses hver gang, så ét nyt ark = én ny måned i dashboardet):

  data/ultimo/Ledelsesoverblik_Ultimo_<måned>_<åå>*.xlsx
      Månedens øjebliksbillede: alle kontingentkategorier, sektioner,
      samme måned sidste år, tal pr. 31.12 og kongeindikatoren.
      Måneden læses fra FILNAVNET (overskriften i arket er af og til en
      gammel kopi). Findes der flere filer for samme måned, vinder den
      der hedder "_værdier"/"_Værdier".

  data/visualiseringer/*.xlsx
      Den nyeste fil bruges. Giver månedstal for hovedkategorierne tilbage
      til januar 2024, som månedsfilerne ikke dækker.

  data/medlemsudvikling_datagrundlag.xlsx
      Kvartalsvise nedslag 31.01.22 → i dag for alle kategorier. Bruges til
      den lange kurve og til 31.12-basistallene.

  data/medlemsudvikling_2022_2029_fremskrivning.xlsx
      Sebastians egen fremskrivning til 2029 (kun nøgletallene tages med).

  data/ind_udmeldelser.csv
      Måned;Indmeldelser;Udmeldelser — redigeres i hånden.

  data/liste_maaneder.json
      Månedstal talt op fra medlemslisterne (skrevet af build_movements.py).
      Bruges for de måneder, hvor der ikke findes et Ledelsesoverblik-ark —
      samme tal, blot talt direkte på listen.

Kør:  python3 scripts/build_data.py
"""
from __future__ import annotations

import calendar
import csv
import glob
import json
import os
import re
import sys
from datetime import date, datetime, timezone

from openpyxl import load_workbook

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
OUT = os.path.join(ROOT, 'public', 'data', 'members.json')

MONTHS = {
    'januar': 1, 'februar': 2, 'marts': 3, 'april': 4, 'maj': 5, 'juni': 6,
    'juli': 7, 'august': 8, 'september': 9, 'oktober': 10, 'november': 11, 'december': 12,
}

# Kongeindikatoren = væksten i fuldtidsbetalende siden 31.12 året før.
# Det er præcis de tre kategorier, der har et tal i kolonnen "Kongeindikatoren"
# i månedsarkene, og summen stemmer måned for måned.
FULLTIME = ['Normaltansat over 19 timer', 'Selvstændig', 'Ph.d. studerende']

# Hovedgrupper — samme opdeling som i "06_Hovedgrupper" i datagrundlaget,
# blot med et kort navn og en fast farve (seriefarverne fra designmanualen).
GROUPS = [
    ('fuldtid', 'Fuldtidsbetalende', ['Normaltansat over 19 timer', 'Selvstændig', 'Ph.d. studerende']),
    ('kandidater', '1. og 2. års kandidater', ['1 og 2 års Kandidater']),
    ('studerende', 'Studerende', ['Studerende DP', 'Psykologistuderende']),
    ('pensionister', 'Pensionister', ['Pensionist DP', 'Pensionist DP - Udland', 'Efterløn DP']),
    ('ledige', 'Ledige og orlov', ['Ledig DP', 'Ledig ikke ret til dagpenge', 'Orlov uden løn DP', 'Med løntilskud']),
    ('ovrige', 'Øvrige', [
        'Normaltansat under 20 timer', 'Udland DP', 'Anden forhandlingsret', 'DLF og DLF ret',
        'DLF og DP ret', 'DM1 Mag. art.', 'Æresmedlem', 'DP medlem',
    ]),
]

# Den "kritiske" overgang: hvem der betaler fuld pris. Bruges i teksterne.
FULL_PRICE = {'Normaltansat over 19 timer', 'Selvstændig'}


def excel_date(v) -> str | None:
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, (int, float)):
        d = date.fromordinal(date(1899, 12, 30).toordinal() + int(v))
        return d.isoformat()
    if isinstance(v, str):
        m = re.search(r'(\d{2})\.(\d{2})\.(\d{2})', v)
        if m:
            return f'{2000 + int(m.group(3))}-{int(m.group(2)):02d}-{int(m.group(1)):02d}'
    return None


def month_end(y: int, m: int) -> str:
    return f'{y}-{m:02d}-{calendar.monthrange(y, m)[1]:02d}'


def num(v):
    return v if isinstance(v, (int, float)) else None


# ───────────────────────────────────────────────────────────────── månedsfiler

def parse_ultimo(path: str) -> dict:
    wb = load_workbook(path, data_only=True, read_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    hdr = [str(h) if h is not None else '' for h in rows[0]]
    base_i = next((i for i, h in enumerate(hdr) if 'Antal pr. 31.12' in h), 6)
    konge_i = next((i for i, h in enumerate(hdr) if 'Konge' in h), 7)
    header_date = excel_date(hdr[1])
    base_date = excel_date(hdr[base_i])

    name = os.path.basename(path)
    fm = re.search(r'Ultimo_([A-Za-zæøåÆØÅ]+)_(\d{2})', name)
    if not fm:
        raise SystemExit(f'Kan ikke læse måned ud af filnavnet: {name}')
    y, m = 2000 + int(fm.group(2)), MONTHS[fm.group(1).lower()]
    the_date = month_end(y, m)
    if not base_date:
        base_date = f'{y - 1}-12-31'

    warnings = []
    if header_date and header_date != the_date:
        warnings.append(f'{name}: overskriften siger {header_date}, filnavnet siger {the_date} — filnavnet bruges.')

    cats, secs, total = {}, {}, None
    mode = 'cat'
    for r in rows[1:]:
        if not r or r[0] is None:
            continue
        key = str(r[0]).strip()
        g = lambda i: r[i] if len(r) > i else None  # noqa: E731
        if key == 'Sektion':
            mode = 'sec'
            continue
        if key == 'Kreds':
            break
        if mode == 'cat':
            rec = dict(now=num(g(1)), ly=num(g(2)), base=num(g(base_i)), konge=num(g(konge_i)))
            if key == 'Total':
                total = rec
            else:
                cats[key] = rec
        else:
            if num(g(1)) is not None and not re.fullmatch(r'\d+', key):
                secs[key] = dict(now=num(g(1)), ly=num(g(2)))

    # Kendt fejl i enkelte ark: studentersektionen står som 0, og de studerende
    # ligger i stedet under "Uden sektion". Så flyttes de tilbage.
    st, ud = secs.get('Studentersektionen'), secs.get('Uden sektion')
    if st and ud and (st['now'] or 0) == 0 and (ud['now'] or 0) > 500:
        secs['Studentersektionen'] = dict(now=ud['now'], ly=ud['ly'] if (ud['ly'] or 0) > 500 else st['ly'])
        secs['Uden sektion'] = dict(now=None, ly=None)
        warnings.append(f'{name}: Studentersektionen stod som 0 og de studerende under "Uden sektion" — rettet ved indlæsning.')

    return dict(date=the_date, baseDate=base_date, total=total, categories=cats,
                sections=secs, file=name, warnings=warnings)


def load_snapshots() -> tuple[list[dict], list[str]]:
    by_date: dict[str, dict] = {}
    warnings: list[str] = []
    files = sorted(glob.glob(os.path.join(DATA, 'ultimo', 'Ledelsesoverblik_Ultimo_*.xlsx')))
    for f in files:
        s = parse_ultimo(f)
        warnings += s.pop('warnings')
        preferred = 'ærdier' in os.path.basename(f)
        cur = by_date.get(s['date'])
        if cur is None or (preferred and 'ærdier' not in cur['file']):
            if cur is not None and cur['total']['now'] != s['total']['now']:
                warnings.append(
                    f"{s['date']}: {cur['file']} ({cur['total']['now']}) og {s['file']} "
                    f"({s['total']['now']}) er uenige — {s['file']} bruges.")
            by_date[s['date']] = s
        elif cur['total']['now'] != s['total']['now']:
            warnings.append(
                f"{s['date']}: {cur['file']} ({cur['total']['now']}) og {s['file']} "
                f"({s['total']['now']}) er uenige — {cur['file']} bruges.")
    snaps = [by_date[k] for k in sorted(by_date)]
    return snaps, warnings


# ─────────────────────────────────────────────────────── visualiseringer (2024→)

def load_series() -> tuple[dict, str | None]:
    files = sorted(glob.glob(os.path.join(DATA, 'visualiseringer', '*.xlsx')), key=os.path.getmtime)
    if not files:
        return {}, None
    # Den fil med flest tal vinder — det er den nyeste.
    best, best_n = None, -1
    for f in files:
        wb = load_workbook(f, data_only=True, read_only=True)
        ws = wb[wb.sheetnames[0]]
        n = sum(1 for r in ws.iter_rows(values_only=True) for v in r if isinstance(v, (int, float)))
        if n > best_n:
            best, best_n = f, n
    wb = load_workbook(best, data_only=True, read_only=True)
    ws = wb[wb.sheetnames[0]]
    alias = {
        'normalansat': 'Normaltansat over 19 timer',
        'selvstændig': 'Selvstændig', 'selvstændige': 'Selvstændig', 'selvstædnige': 'Selvstændig',
        'studerende': 'Studerende DP',
        '1. og 2. års dimittend': '1 og 2 års Kandidater',
        '1. og 2. års kandidater': '1 og 2 års Kandidater',
        '2. og 2. års dimittend': '1 og 2 års Kandidater',
        'ph.d. studerende': 'Ph.d. studerende',
    }
    series: dict[str, dict[str, list]] = {}
    for r in ws.iter_rows(values_only=True):
        r = list(r)
        if len(r) > 3 and isinstance(r[2], str) and re.search(r'20\d\d\s*$', r[2]):
            label = re.sub(r'\s+', ' ', r[2].strip())
            yr = label[-4:]
            cat = alias.get(label[:-4].strip().lower())
            if not cat:
                continue
            vals = [v for v in r[3:15] if isinstance(v, (int, float))]
            cur = series.setdefault(cat, {}).get(yr)
            if cur is None or len(vals) > len(cur):
                series[cat][yr] = vals
    return series, os.path.basename(best)


# ──────────────────────────────────────────────────────── datagrundlag (2022→)

def load_quarterly() -> list[dict]:
    path = os.path.join(DATA, 'medlemsudvikling_datagrundlag.xlsx')
    if not os.path.exists(path):
        return []
    wb = load_workbook(path, data_only=True, read_only=True)
    ws = wb['01_Rådata_bred']
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    dates = [excel_date(v) for v in rows[0][1:]]
    out = [dict(date=d, total=None, categories={}) for d in dates]
    for r in rows[1:]:
        if not r or r[0] is None:
            continue
        key = str(r[0]).strip()
        for i, v in enumerate(r[1:len(dates) + 1]):
            if key == 'Alle medlemmer':
                out[i]['total'] = num(v)
            else:
                out[i]['categories'][key] = num(v)
    return [o for o in out if o['date']]


def load_projection() -> dict | None:
    path = os.path.join(DATA, 'medlemsudvikling_2022_2029_fremskrivning.xlsx')
    if not os.path.exists(path):
        return None
    wb = load_workbook(path, data_only=True, read_only=True)
    ws = wb['Fremskrivning_2029']
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    hdr_i = next(i for i, r in enumerate(rows) if r and r[0] == 'Medlemstype')
    year_dates = [excel_date(v) for v in rows[hdr_i - 1][5:9]]
    cats = {}
    total_cagr = None
    total_sum = None
    for r in rows[hdr_i + 1:]:
        if not r or r[0] is None:
            continue
        key = str(r[0]).strip()
        rec = dict(start=num(r[2]), latest=num(r[3]), cagr=num(r[4]),
                   path=[num(v) for v in r[5:9]])
        if key.startswith('Alle medlemmer (beregnet'):
            total_cagr = rec
        elif key.startswith('Alle medlemmer (sum'):
            total_sum = rec
        else:
            cats[key] = rec
    return dict(dates=year_dates, byCategory=cats, totalByCagr=total_cagr, totalBySum=total_sum)


def load_list_months() -> dict:
    path = os.path.join(DATA, 'liste_maaneder.json')
    if not os.path.exists(path):
        return {}
    with open(path, encoding='utf-8') as fh:
        return json.load(fh)


def load_studies() -> dict:
    """data/studiestatistik/*.xlsx: udtræk fra Uddannelses- og Forskningsministeriets
    datavarehus (tilgang, bestand, afbrudte, fuldførte pr. uddannelse). Kun
    rækkerne for psykologi (bachelor og kandidat) tages med."""
    folder = os.path.join(DATA, 'studiestatistik')
    out: dict = {}
    if not os.path.isdir(folder):
        return out
    inst: dict = {}
    for f in sorted(glob.glob(os.path.join(folder, '*.xlsx'))):
        name = os.path.basename(f).lower()
        measure = next((m for m in ('tilgang', 'bestand', 'afbrudte', 'fuldførte') if name.startswith(m)), None)
        if not measure:
            continue
        ws = load_workbook(f, data_only=True).active
        rows = [r for r in ws.iter_rows(values_only=True) if r and len(r) >= 5 and isinstance(r[3], (int, float)) and r[4] is not None]
        if 'uddannelse' in name:
            for r in rows:
                u = str(r[2] or '')
                if 'sykolog' not in u:
                    continue
                level = 'bachelor' if 'bach' in u.lower() else 'kandidat'
                out.setdefault(measure, {}).setdefault(level, {})[str(int(r[3]))] = int(r[4])
        elif 'institution' in name and 'psy' in name:
            level = 'bachelor' if 'bach' in name else 'kandidat'
            tgt = inst.setdefault(measure, {}).setdefault(level, {})
            for r in rows:
                u = str(r[1] or '').strip()  # hovedinstitution — campusser lægges sammen
                tgt.setdefault(u, {})
                tgt[u][str(int(r[3]))] = tgt[u].get(str(int(r[3])), 0) + int(r[4])
    if inst:
        out['byInstitution'] = inst
    return out


def load_market() -> dict:
    """data/marked/: organisationsgrad (aflæst fra DP's egne grafer), DREAM-
    fremskrivningen af antal psykologer, Sundhedsdatastyrelsens arbejdsstyrke-
    tal og DST's beskæftigelsestal. Alt er offentlige eller aggregerede tal."""
    folder = os.path.join(DATA, 'marked')
    out: dict = {}
    if not os.path.isdir(folder):
        return out
    def num(v):
        if v is None or v == '' or v == '.': return None
        if isinstance(v, (int, float)): return v
        t = str(v).strip().replace(',', '.')
        return None if '-' in t and not t.startswith('-') else (float(t) if re.fullmatch(r'-?\d+(\.\d+)?', t) else None)
    p = os.path.join(folder, 'organisationsgrad.csv')
    if os.path.exists(p):
        with open(p, encoding='utf-8') as fh:
            out['orgRate'] = {row['År']: dict(faerdig=num(row['Færdiguddannede']), beskaeftigede=num(row['Beskæftigede']),
                                              studerendeDk=num(row['Studerende danske']), studerendeAlle=num(row['Studerende alle']))
                              for row in csv.DictReader(fh, delimiter=';')}
    p = os.path.join(folder, 'dream.csv')
    if os.path.exists(p):
        with open(p, encoding='utf-8') as fh:
            out['dream'] = {row['År']: num(row['Psykologer DREAM']) for row in csv.DictReader(fh, delimiter=';')}
    # Sundhedsdatastyrelsen: arbejdsstyrken af psykologer
    for f in glob.glob(os.path.join(folder, 'Arbejdsstyrken*.xlsx')):
        wb = load_workbook(f, data_only=True)
        wf: dict = {}
        ws = wb['Sundhedsuddannede']
        for r in ws.iter_rows(values_only=True):
            if r and r[1] and 'sykolog' in str(r[1]):
                wf['total'] = {'2022': num(r[2]), '2023': num(r[3])}
        ws = wb['Region']
        reg = {}
        for r in ws.iter_rows(values_only=True):
            if r and r[2] and str(r[2]).startswith('Region'):
                reg[str(r[2])] = {'2022': num(r[3]), '2023': num(r[4])}
        wf['region'] = reg
        ws = wb['Alder og køn']
        age = {}
        for r in ws.iter_rows(values_only=True):
            if r and r[2] and ('år' in str(r[2])):
                age[str(r[2])] = dict(m2022=num(r[3]), k2022=num(r[4]), m2023=num(r[5]), k2023=num(r[6]))
        wf['age'] = age
        ws = wb['Sektor']
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
        hdr_i = next(i for i, r in enumerate(rows) if r and r[1] and 'sykolog' in str(r[1]))
        names = [str(v) for v in rows[hdr_i][2:] if v] + ['Ikke i beskæftigelse']
        sek = {}
        for r in rows[hdr_i + 1:]:
            if r and r[1] and str(r[1]).isdigit():
                vals = [v for v in r[2:] if v is not None]
                sek[str(r[1])] = {n: num(v) for n, v in zip(names, vals)}
        wf['sektor'] = sek
        out['workforce'] = wf
    # DST: beskæftigelsesstatus pr. år (alle psykologuddannelser lagt sammen)
    for f in glob.glob(os.path.join(folder, 'Psykologers_beskaeftigelse*.xlsx')):
        ws = load_workbook(f, data_only=True).active
        by_year: dict = {}
        by_age: dict = {}
        latest = 0
        for r in ws.iter_rows(min_row=2, values_only=True):
            if not r or r[0] is None or not str(r[0]).strip().isdigit():
                continue
            y = str(r[0]).strip(); latest = max(latest, int(y))
            by_year.setdefault(y, {})
            by_year[y][str(r[2])] = by_year[y].get(str(r[2]), 0) + int(num(r[4]) or 0)
        by_age_year: dict = {}
        for r in ws.iter_rows(min_row=2, values_only=True):
            if not r or r[0] is None or not str(r[0]).strip().isdigit(): continue
            y = str(r[0]).strip()
            if r[2] == 'Diskretioneret': continue
            by_age_year.setdefault(y, {})
            by_age_year[y][str(r[3])] = by_age_year[y].get(str(r[3]), 0) + int(num(r[4]) or 0)
            if y == str(latest):
                by_age.setdefault(str(r[3]), {})
                by_age[str(r[3])][str(r[2])] = by_age[str(r[3])].get(str(r[2]), 0) + int(num(r[4]) or 0)
        out['employment'] = dict(byYear=by_year, byAgeLatest=by_age, byAgeYear=by_age_year, latest=str(latest))
    for f in glob.glob(os.path.join(folder, 'Psykologers_dimissionsaar*.xlsx')):
        wb = load_workbook(f, data_only=True)
        def tab(name):
            return [r for r in wb[name].iter_rows(min_row=2, values_only=True) if r and r[0] is not None and re.fullmatch(r'\d{4}', str(r[0]).strip())]
        # Tabel1: kandidater pr. dimissionsår (alle psykologuddannelser, og cand.psych. alene)
        grads: dict = {}
        for r in tab('Tabel1'):
            y = str(r[0]).strip(); grads.setdefault(y, dict(alle=0, candpsych=0))
            grads[y]['alle'] += int(num(r[2]) or 0)
            if 'c.psych' in str(r[1]): grads[y]['candpsych'] += int(num(r[2]) or 0)
        out['graduatesByYear'] = dict(sorted(grads.items()))
        # Tabel3: bopælsregion, seneste år
        reg: dict = {}; latest = max(str(r[0]).strip() for r in tab('Tabel3'))
        for r in tab('Tabel3'):
            if str(r[0]).strip() != latest: continue
            k = re.sub(r'^\d+ ', '', str(r[2]))
            reg[k] = reg.get(k, 0) + int(num(r[4]) or 0)
        out['populationByRegion'] = dict(year=latest, regions=reg)
        # Tabel5a: sektor pr. år (alle uddannelser)
        sek: dict = {}
        for r in tab('Tabel5a'):
            y = str(r[0]).strip(); k = re.sub(r'^\d+ ', '', str(r[2]))
            sek.setdefault(y, {}); sek[y][k] = sek[y].get(k, 0) + int(num(r[3]) or 0)
        out['sectorByYear'] = sek
    return out


def load_rates() -> dict:
    """data/kontingent.csv: Kontingenttype;Pr. måned;Note. Tom sats = ukendt."""
    path = os.path.join(DATA, 'kontingent.csv')
    out = {}
    if not os.path.exists(path):
        return out
    with open(path, encoding='utf-8') as fh:
        for row in csv.DictReader(fh, delimiter=';'):
            k = (row.get('Kontingenttype') or '').strip()
            if not k:
                continue
            v = (row.get('Pr. måned') or '').strip().replace('.', '').replace(',', '.')
            out[k] = dict(monthly=float(v) if v else None, note=(row.get('Note') or '').strip() or None)
    return out


def load_flows() -> list[dict]:
    path = os.path.join(DATA, 'ind_udmeldelser.csv')
    if not os.path.exists(path):
        return []
    out = []
    with open(path, encoding='utf-8') as fh:
        for row in csv.DictReader(fh, delimiter=';'):
            m = row.get('Måned') or row.get('maaned') or row.get('month')
            if not m or not re.fullmatch(r'\d{4}-\d{2}', m.strip()):
                continue
            out.append(dict(month=m.strip(),
                            ind=int(row['Indmeldelser']) if row.get('Indmeldelser') else None,
                            ud=int(row['Udmeldelser']) if row.get('Udmeldelser') else None,
                            note=(row.get('Note') or '').strip() or None))
    return sorted(out, key=lambda x: x['month'])


# ───────────────────────────────────────────────────────────────── samlet

def main() -> None:
    snaps, warnings = load_snapshots()
    series, series_file = load_series()
    quarterly = load_quarterly()
    projection = load_projection()
    flows = load_flows()

    if not snaps:
        raise SystemExit('Ingen månedsfiler i data/ultimo/')

    # Måneder uden ark: byg et øjebliksbillede fra medlemslisten. Basis pr. 31.12
    # tages fra arkene når de findes (så 2026-tallene stemmer med det rapporterede),
    # ellers fra listen for december året før. Samme måned sidste år fra listen.
    list_months = load_list_months()
    have = {s['date'] for s in snaps}
    ark_base: dict[int, dict] = {}
    for s in snaps:
        y = int(s['baseDate'][:4])
        rec = ark_base.setdefault(y, dict(total=None, categories={}))
        if s['total'] and s['total']['base'] is not None:
            rec['total'] = s['total']['base']
        for c, v in s['categories'].items():
            if v['base'] is not None:
                rec['categories'][c] = v['base']
    added = 0
    for k, lm in sorted(list_months.items()):
        if lm['date'] in have or k < '2022-01':
            continue
        y = int(k[:4])
        base = ark_base.get(y - 1)
        dec = list_months.get(f'{y - 1}-12')
        # Kategorien '1 og 2 års Kandidater' blev indført januar 2022; en december
        # uden den kan ikke bruges som basis for kongeindikatoren.
        if base is None and dec and dec['categories'].get('1 og 2 års Kandidater', 0) >= 100:
            base = dict(total=dec['total'], categories=dec['categories'])
        ly = list_months.get(f'{y - 1}-{k[5:]}')
        cats = {}
        for c, n in lm['categories'].items():
            cats[c] = dict(now=n, ly=(ly['categories'].get(c) if ly else None),
                           base=(base['categories'].get(c) if base else None), konge=None)
        for c in FULLTIME:
            if c in cats and cats[c]['base'] is not None:
                cats[c]['konge'] = cats[c]['now'] - cats[c]['base']
        konge = sum(cats[c]['konge'] for c in FULLTIME if c in cats and cats[c]['konge'] is not None) if base else None
        total = dict(now=lm['total'], ly=(ly['total'] if ly else None), base=(base['total'] if base else None), konge=konge)
        secs = {sname: dict(now=n, ly=(ly['sections'].get(sname) if ly else None)) for sname, n in lm['sections'].items()}
        snaps.append(dict(date=lm['date'], baseDate=f'{y - 1}-12-31', total=total, categories=cats, sections=secs,
                          file='medlemsliste', warnings=[]))
        added += 1
    snaps.sort(key=lambda s: s['date'])
    if added:
        print(f'{added} måneder taget fra medlemslisterne (ingen ark for dem)')

    # Basistal pr. 31.12 for hvert år, fra månedsfilerne (de tal ledergruppen
    # faktisk har fået) og ellers fra kvartalsdata.
    base_by_year: dict[int, dict] = {}
    for s in snaps:
        y = int(s['baseDate'][:4])
        rec = base_by_year.setdefault(y, dict(total=None, categories={}, source='månedsfil'))
        if s['total'] and s['total']['base'] is not None:
            rec['total'] = s['total']['base']
        for c, v in s['categories'].items():
            if v['base'] is not None:
                rec['categories'][c] = v['base']
    for q in quarterly:
        if q['date'].endswith('-12-31'):
            y = int(q['date'][:4])
            if y not in base_by_year:
                base_by_year[y] = dict(total=q['total'], categories=dict(q['categories']), source='kvartalsdata')
    # listernes december-tal er kun fallback — sættes efter arkene (se nedenfor)

    # Månedsrækker for hovedkategorier: fra visualiserings-arket, suppleret med
    # listerne for de måneder arket ikke dækker.
    monthly_main: dict[str, dict[str, int]] = {}
    for cat, years in series.items():
        for yr, vals in years.items():
            for i, v in enumerate(vals):
                monthly_main.setdefault(month_end(int(yr), i + 1), {})[cat] = v
    for k, lm in list_months.items():
        for cat in ['Normaltansat over 19 timer', 'Selvstændig', 'Studerende DP', '1 og 2 års Kandidater', 'Ph.d. studerende']:
            monthly_main.setdefault(lm['date'], {}).setdefault(cat, lm['categories'].get(cat, 0))
    for k, lm in list_months.items():
        if k.endswith('-12') and lm['categories'].get('1 og 2 års Kandidater', 0) >= 100:
            y = int(k[:4])
            if y not in base_by_year or base_by_year[y]['total'] is None:
                base_by_year[y] = dict(total=lm['total'], categories=dict(lm['categories']), source='medlemsliste')
    base_by_year = {y: v for y, v in base_by_year.items() if v['total'] is not None}

    # Månedsvis kongeindikator pr. år: registreret hvor vi har en månedsfil,
    # ellers beregnet ud fra hovedkategori-rækkerne og samme 31.12-basis.
    snap_by_date = {s['date']: s for s in snaps}
    konge: dict[str, list] = {}
    all_months = sorted(set(monthly_main) | set(snap_by_date))
    for d in all_months:
        y = int(d[:4])
        base = base_by_year.get(y - 1)
        entry = dict(date=d, value=None, source=None)
        s = snap_by_date.get(d)
        if s and s['total'] and s['total']['konge'] is not None:
            entry.update(value=s['total']['konge'], source='månedsfil')
        elif base and all(c in monthly_main.get(d, {}) for c in FULLTIME) and all(c in base['categories'] for c in FULLTIME):
            v = sum(monthly_main[d][c] for c in FULLTIME) - sum(base['categories'][c] for c in FULLTIME)
            entry.update(value=v, source='beregnet')
        konge.setdefault(str(y), []).append(entry)
    konge = {y: pts for y, pts in konge.items() if any(p['value'] is not None for p in pts)}

    # Samlet månedstal: månedsfil når den findes, kvartalsnedslag ellers.
    q_by_date = {q['date']: q for q in quarterly}
    totals = []
    for d in sorted(set(snap_by_date) | set(q_by_date)):
        s = snap_by_date.get(d)
        q = q_by_date.get(d)
        if s:
            totals.append(dict(date=d, total=s['total']['now'], source='månedsfil'))
        elif q and q['total'] is not None:
            totals.append(dict(date=d, total=q['total'], source='kvartalsdata'))

    latest = snaps[-1]
    meta = dict(
        generatedAt=datetime.now(timezone.utc).isoformat(timespec='seconds'),
        latest=latest['date'],
        first=snaps[0]['date'],
        months=len(snaps),
        seriesFile=series_file,
        warnings=warnings,
        goal=dict(target=15000, date='2029-12-31'),
        fulltimeCategories=FULLTIME,
        fullPriceCategories=sorted(FULL_PRICE),
        groups=[dict(key=k, label=l, categories=c) for k, l, c in GROUPS],
        rates=load_rates(),
        studies=load_studies(),
        market=load_market(),
    )

    out = dict(
        meta=meta,
        snapshots=snaps,
        baseByYear={str(k): v for k, v in sorted(base_by_year.items())},
        monthlyMain=[dict(date=d, categories=c) for d, c in sorted(monthly_main.items()) if d >= '2022-01-01'],
        konge=konge,
        totals=totals,
        quarterly=quarterly,
        projection=projection,
        flows=flows,
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    print(f'Skrev {OUT}: {len(snaps)} måneder ({snaps[0]["date"]} → {latest["date"]}), '
          f'{len(quarterly)} kvartalsnedslag, {len(flows)} måneder med ind-/udmeldelser')
    for w in warnings:
        print('  ⚠', w, file=sys.stderr)


if __name__ == '__main__':
    main()
