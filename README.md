# Medlemsdashboard — Dansk Psykolog Forening

Medlemsudviklingen i DP, samlet i ét dashboard i stedet for en månedlig mail.
Kongeindikatoren år for år, alle kontingentkategorier, sektioner, ind- og
udmeldelser, fastholdelsen over kontingentskiftet — og målet om 15.000
medlemmer den 31.12.29. Følger DP's designmanual og er bygget på samme
fundament som udsendelsesdashboardet.

**Offentlig URL:** https://sebastianlistfeirup.github.io/DPDashboard/

**Én selvstændig HTML-fil** (data indlejret, virker offline, kan sendes som
vedhæftning) ligger som artifact på hver kørsel under *Actions*.

## Sådan opdaterer du en måned

1. Gem månedens ark som `Ledelsesoverblik_Ultimo_<måned>_<åå>_Værdier.xlsx`
   (fx `Ledelsesoverblik_Ultimo_juni_26_Værdier.xlsx`) og læg det i `data/ultimo/`.
   Måneden læses fra **filnavnet** — overskriften i arket må gerne være en gammel kopi.
2. Har du månedens visualiserings-ark, læg det i `data/visualiseringer/` (den nyeste bruges).
3. Skriv månedens ind- og udmeldelser som én linje i `data/ind_udmeldelser.csv`:
   `2026-06;88;41;` (måned;ind;ud;note).
4. Commit og push. GitHub Actions læser arkene, bygger siden og udgiver den.
   Efter et par minutter viser dashboardet den nye måned.

Lokalt: `python3 scripts/build_data.py` (kræver `pip install openpyxl`), derefter `npm run dev`.

### Medlemslisterne (personoplysninger — kun lokalt)

Sektionerne *Medlemmerne*, *Ind og ud* og *Frafald* bygger på de månedlige
medlemslister fra medlemssystemet. De indeholder personoplysninger og må
**aldrig** committes. De ligger i `data/medlemslister/` (ignoreres af git),
og kun optællingerne ender i `public/data/movements.json`.

Når der kommer en ny liste:

1. Læg `Medlemsliste_-_<dato>_periode_<dd>_<mm>_<åå>_a.xlsx` i `data/medlemslister/`
   (og en ny `IndUdm_*.xlsx`, `UdmeldteListe_*.xlsx`, `MedlemslisteUddannelse_*.xlsx`
   hvis de er trukket igen — scriptet bruger dem, der ligger der).
2. Kør `python3 scripts/parse_lists.py && python3 scripts/build_movements.py`.
3. Commit `public/data/movements.json` og push. Resten sker i GitHub Actions.

`build_movements.py` tjekker selv, at intet medlemsnummer slipper med i output.

## Hvad dashboardet kan

| Sektion | Hvad den svarer på |
|---|---|
| **Status** | Månedens fire tal: alle medlemmer, kongeindikator, 1.-2. års kandidater, målet |
| **Kongeindikator** | Årets vækst i fuldtidsbetalende, måned for måned, lagt oven på 2024 og 2025. Hvor væksten kommer fra |
| **Månedens tekst** | Mailen til ledergruppen, skrevet ud fra tallene. Kopiér, ret, send |
| **Mål 2029** | Kurven 2022→2029, den lige linje til 15.000, de to fremskrivninger, og om vi er foran eller bagud |
| **Hovedkategorier** | De fem store kategorier, 2024/2025/2026 oven på hinanden |
| **Årshjul** | Kongeindikatoren som spiral gennem året, med månedens medlemsændring på kanten |
| **Alle kategorier** | Sorterbar tabel med udvikling, og et varmekort over ændringer måned for måned |
| **Sektioner** | Medlemmer pr. sektion og udviklingen i procent |
| **Medlemmerne** | Alder og kontingentgruppe, køn, kredse, sektor, universitet — og pensionsafgangen frem mod 2035 |
| **Ind og ud** | Ind- og udmeldelser pr. måned siden 2022 fra medlemslisterne, fordelt på gruppe, alder, anciennitet og årsag; udmeldelsesrate pr. gruppe; opsigelser der endnu ikke er trådt i kraft |
| **Frafald** | Kontingentskiftet målt på hvert medlem, cand.psych.-årgange fulgt måned for måned, de studerendes vej ud af studiet, kommende kontingentskift, bevægelser mellem grupper |
| **Næste skridt** | Hvad der stadig kan gøre analyserne skarpere |

Månedsvælgeren øverst viser dashboardet, som det så ud en tidligere måned
(`?m=2026-04-30` i URL'en giver april).

## Sådan hænger det sammen

```
data/ultimo/*.xlsx ─┐
data/visualiseringer/*.xlsx ─┼─► scripts/build_data.py ─► public/data/members.json ─► React-app
data/medlemsudvikling_*.xlsx ─┤
data/ind_udmeldelser.csv ─┘
```

- `scripts/build_data.py` — læser alle ark, samler dem, regner kongeindikatoren
  for måneder uden månedsfil, og skriver advarsler når arkene er uenige.
- `scripts/parse_lists.py` + `scripts/build_movements.py` — læser medlemslisterne
  (lokalt) og skriver `public/data/movements.json` med optællinger.
- `src/lib/data.ts` — alle afledte tal for én valgt måned.
- `src/lib/report.ts` — månedens tekst.
- `src/sections/*` — én fil pr. sektion.
- `src/design/tokens.ts` — DP's farver, typografi og bevægelse (samme som udsendelsesdashboardet).

Kongeindikatoren = (Normalansat over 19 timer + Selvstændig + Ph.d.-studerende)
pr. ultimo måneden, minus samme sum pr. 31.12 året før. Det er de tre
kategorier, der har et tal i kolonnen "Kongeindikatoren" i månedsarkene, og
summen stemmer måned for måned.

## Datakvalitet

`build_data.py` skriver advarsler til kørslens log og viser dem nederst i
dashboardet under *Næste skridt*. Kendte forhold i det nuværende materiale:

- `Ledelsesoverblik_Ultimo_Juli_25_Værdier.xlsx` har overskriften 31.05.25 — filnavnet bruges.
- I april 2025-arket står studentersektionen som 0 og de studerende under "Uden sektion" — rettes ved indlæsning.
- Juni 2025 findes ikke som månedsfil; totalen tages fra kvartalsdata og kongeindikatoren beregnes.
- 2024 findes kun for de fem hovedkategorier (fra visualiserings-arket).
- Findes der to ark for samme måned, vinder det der hedder `_værdier`; afvigelser logges.
- Systemskiftet 1.–2. december 2022 gav alle daværende medlemmer en DP-udmeldelsesdato
  01.12.22 og -indmeldelsesdato 02.12.22. De to datoer er ikke bevægelser og udelades.
  Anciennitet kendes derfor ikke for medlemmer fra før systemskiftet.
- Udmeldelser tælles i den måned, DP Udm.dato ligger i. Medlemmet står på listen den
  måned og er væk måneden efter — mailen har historisk talt dem måneden efter.
