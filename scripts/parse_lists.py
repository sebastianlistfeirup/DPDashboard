"""Læser månedslisterne én gang og gemmer kun de kolonner, analyserne bruger,
i en cache (pickle). Ingen navne, adresser, cpr, e-mail eller telefon læses."""
import glob, os, pickle, re, sys
from datetime import date, datetime
from openpyxl import load_workbook

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'medlemslister')
CACHE = os.path.join(ROOT, '.cache', 'lists.pkl')

KEEP = ['Kreds', 'Medlemstype', 'Stamkort', 'Køn', 'Fødselsdato', 'Cand. psych.', 'Cand. psych. dato',
        'Autorisationsdato', 'DP Indm.dato', 'DP Udm.dato', 'Indm.dato', 'Udm.dato', 'Sektion',
        'Sektion Indm.dato', 'Specialist 1 dato', 'Firma region', 'Ansættelsesforhold', 'Sektor', 'Firmakategori']

def d(v):
    if isinstance(v, datetime): return v.date()
    if isinstance(v, date): return v
    if isinstance(v, str):
        m = re.match(r'(\d{4})-(\d{2})-(\d{2})', v)
        if m: return date(int(m[1]), int(m[2]), int(m[3]))
    return None

def parse_list(path):
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    it = ws.iter_rows(values_only=True)
    hdr = list(next(it))
    idx = {k: hdr.index(k) for k in KEEP}
    out = {}
    for r in it:
        if len(r) < len(hdr): r = tuple(r) + (None,) * (len(hdr) - len(r))
        sk = r[idx['Stamkort']]
        if sk is None: continue
        sk = str(sk).strip()
        by = d(r[idx['Fødselsdato']])
        out[sk] = dict(
            type=r[idx['Medlemstype']], kreds=r[idx['Kreds']], sex=r[idx['Køn']],
            by=by.year if by else None,
            uni=r[idx['Cand. psych.']], cand=d(r[idx['Cand. psych. dato']]), aut=d(r[idx['Autorisationsdato']]),
            dpin=d(r[idx['DP Indm.dato']]), dpud=d(r[idx['DP Udm.dato']]),
            tin=d(r[idx['Indm.dato']]), tud=d(r[idx['Udm.dato']]),
            sek=r[idx['Sektion']], sekin=d(r[idx['Sektion Indm.dato']]), spec=d(r[idx['Specialist 1 dato']]),
            region=r[idx['Firma region']], ans=r[idx['Ansættelsesforhold']], sektor=r[idx['Sektor']], firmakat=r[idx['Firmakategori']],
        )
    return out

def main():
    lists = {}
    for f in sorted(glob.glob(os.path.join(SRC, 'Medlemsliste_-_*periode_*.xlsx'))):
        m = re.search(r'periode_(\d{2})_(\d{2})_(\d{2})', f)
        y, mo = 2000 + int(m[3]), int(m[2])
        key = f'{y}-{mo:02d}'
        lists[key] = parse_list(f)
        print(key, len(lists[key]), file=sys.stderr)
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    pickle.dump(lists, open(CACHE, 'wb'))
    print('cached', len(lists), 'lists')

if __name__ == '__main__':
    main()
