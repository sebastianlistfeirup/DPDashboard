/**
 * Dansk Psykolog Forening — design tokens.
 *
 * Every value here is traceable to Designmanual (juni 2024). Where the manual's
 * exact hex could not carry a data-visualisation job, the deviation is recorded
 * on the token itself rather than made silently.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Farver — grundfarver og accentfarver, side 8
 * The manual tones each accent lighter at 60 % / 30 % / 15 %; those tints are
 * the recommended "tone i tone"-combinations from side 10.
 * ──────────────────────────────────────────────────────────────────────────── */

export type Tone = 'DEFAULT' | '60' | '30' | '15'

export const dp = {
  navy: '#3a557d', //  BLÅ,      Pantone 7545 C
  lysBlaa: '#d4dbe1', //  LYS BLÅ,  Pantone 642 C
  sort: '#000000',
  lysGraa: '#f4f1f1', //  LYS GRÅ,  Pantone 7723 C
  studerende: '#4fa388', //  DP Studerende subbrand

  lilla: { DEFAULT: '#4e4897', 60: '#8987c1', 30: '#bcbbde', 15: '#dbdaed' },
  gron: { DEFAULT: '#329d9e', 60: '#8ebec0', 30: '#c4dcdb', 15: '#e0eded' },
  rod: { DEFAULT: '#d24e46', 60: '#e39687', 30: '#f1c7bb', 15: '#f6e1d8' },
  orange: { DEFAULT: '#df790d', 60: '#edac73', 30: '#f6d3b1', 15: '#f9e8d4' },
  blaa: { DEFAULT: '#4c7bbd', 60: '#8da6d6', 30: '#c1cde9', 15: '#dfe5f4' },
  gul: { DEFAULT: '#eab922', 60: '#f2d57a', 30: '#f8eabd', 15: '#fcf8e9' },
} as const

/**
 * Navy extended tone-in-tone, for the dark panels the manual uses on side 13–14.
 * Derived from #3a557d by holding its hue and stepping lightness, so the whole
 * ramp still reads as DP's blue.
 */
export const navyRamp = {
  900: '#16233a',
  800: '#1e3050',
  700: '#2a4368',
  600: '#3a557d',
  500: '#5a76a0',
  400: '#8299bb',
  300: '#aebdd4',
  200: '#d4dbe1',
  100: '#e7ebef',
  50: '#f3f5f7',
} as const

/* ────────────────────────────────────────────────────────────────────────────
 * Serie-farver til grafer
 *
 * Charts need hues that survive colour-vision deficiency and hold contrast
 * against the surface. Four of DP's six accents do that unchanged. Two needed a
 * minimal nudge, recorded here so the deviation is visible:
 *
 *   GRØN  #329d9e → #179fa0   chroma 0.094 → 0.105 (below the 0.10 grey floor)
 *   GUL   #eab922 → #d8a90c   lightness 0.808 → 0.758 (above the 0.77 band)
 *
 * Both are imperceptible next to the brand swatch and keep the Pantone hue
 * angle. Ordering is not cosmetic: it is what makes adjacent series separable.
 * Verified with the palette validator — worst adjacent pair ΔE 12.6 (deuteran),
 * 25.2 (normal vision). Slot 6 sits below 3:1 on white, so anything painted
 * with it always carries a visible label or appears in the table view.
 */
export const series = [
  '#4c7bbd', // 1  BLÅ
  '#df790d', // 2  ORANGE
  '#179fa0', // 3  GRØN
  '#d24e46', // 4  RØD
  '#4e4897', // 5  LILLA
  '#d8a90c', // 6  GUL — needs a direct label
] as const

/** Tone-in-tone partner for each series slot: the manual's 30 % tint. */
export const seriesSoft = ['#c1cde9', '#f6d3b1', '#c4dcdb', '#f1c7bb', '#bcbbde', '#f8eabd'] as const

/** The slot beyond which a scatter/bubble form must fold into "Øvrige". */
export const SERIES_ALL_PAIRS_CAP = 3

/* ────────────────────────────────────────────────────────────────────────────
 * Status — reserved, never reused as a series colour.
 * Each ships with a label, never colour alone.
 * ──────────────────────────────────────────────────────────────────────────── */
export const status = {
  good: '#179fa0',
  warning: '#d8a90c',
  serious: '#df790d',
  critical: '#d24e46',
  neutral: '#8299bb',
} as const

/* ────────────────────────────────────────────────────────────────────────────
 * Overflader og tekst
 * ──────────────────────────────────────────────────────────────────────────── */
export const surface = {
  page: '#ffffff',
  raised: '#ffffff',
  sunken: '#f4f1f1', // LYS GRÅ
  tint: '#f3f5f7',
  dark: '#16233a', // navy 900 — hero and section panels
  darkRaised: '#1e3050',
  border: '#e2e6ea',
  borderStrong: '#d4dbe1', // LYS BLÅ
} as const

export const ink = {
  primary: '#16233a',
  secondary: '#4a5a72',
  muted: '#7a8798',
  onDark: '#ffffff',
  onDarkSecondary: '#aebdd4',
  onDarkMuted: '#8299bb',
} as const

/* ────────────────────────────────────────────────────────────────────────────
 * Typografi — dp.dk's egen webtypografi, side 4 i manualen
 * Overskrifter IBM Plex Serif · rubrikker og brødtekst IBM Plex Sans
 * ──────────────────────────────────────────────────────────────────────────── */
export const type = {
  display: '"IBM Plex Serif", Charter, Cambria, Georgia, serif',
  body: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, monospace',
} as const

/* ────────────────────────────────────────────────────────────────────────────
 * Bevægelse
 * One easing curve everywhere, so the whole dashboard moves with one hand.
 * Durations are short enough to feel responsive and long enough to be read.
 * ──────────────────────────────────────────────────────────────────────────── */
export const motion = {
  ease: [0.22, 1, 0.36, 1] as const, // decelerating; the house curve
  easeCss: 'cubic-bezier(0.22, 1, 0.36, 1)',
  fast: 0.28,
  base: 0.55,
  slow: 0.9,
  stagger: 0.055,
} as const

/* ────────────────────────────────────────────────────────────────────────────
 * Udsendelsestyper
 *
 * In Ungapped these are tags on each sendout. The colour is fixed per type and
 * follows the entity, never its rank in a filtered list.
 * ──────────────────────────────────────────────────────────────────────────── */
export type MailingTypeKey =
  | 'nyhedsbrev'
  | 'magasinet-p'
  | 'flow'
  | 'videncenter'
  | 'kompetencenyt'
  | 'tr-amr'
  | 'medlemskommunikation'
  | 'netvaerksnyt'
  | 'ovrige'

export interface MailingType {
  key: MailingTypeKey
  label: string
  short: string
  color: string
  soft: string
  /** Ungapped tag titles that map onto this type, lower-cased and trimmed. */
  tags: string[]
  description: string
}

export const mailingTypes: MailingType[] = [
  {
    key: 'nyhedsbrev',
    label: 'Psykologernes Nyhedsbrev',
    short: 'Nyhedsbrev',
    color: series[0],
    soft: seriesSoft[0],
    tags: ['psykologernes nyhedsbrev'],
    description: 'Det brede medlemsnyhedsbrev til alle medlemmer med e-mail.',
  },
  {
    key: 'magasinet-p',
    label: 'Magasinet P',
    short: 'Magasinet P',
    color: series[2],
    soft: seriesSoft[2],
    tags: ['magasinet p', 'magasinet p '],
    description: 'Psykologernes Fagmagasin — udsendelser knyttet til magasinet.',
  },
  {
    key: 'flow',
    label: 'Flows og automatiseringer',
    short: 'Flows',
    color: series[1],
    soft: seriesSoft[1],
    tags: [
      'flow', 'automation', 'onboarding', 'dimittendflow', 'ydernummerflow', 'tr flow',
      'velkomstflow til studerende', 'pensionistflow', 'exitflow', 'flow til ledige',
      'selvstændige (flow)', 'normalansatte over og under 19 timer (flow)',
      'velkomstmail frivillige',
    ],
    description: 'Automatiske rejser: onboarding, dimittender, ydernummer, TR, pensionister, exit.',
  },
  {
    key: 'videncenter',
    label: 'Nationalt Videncenter for Psykologi',
    short: 'Videncenter',
    color: series[4],
    soft: seriesSoft[4],
    tags: ['nationalt videnscenter for psykologi', 'nationalt videncenter for psykologi'],
    description: 'Udsendelser fra videncentret.',
  },
  {
    key: 'tr-amr',
    label: 'TR/AMR Nyt',
    short: 'TR/AMR',
    color: series[3],
    soft: seriesSoft[3],
    tags: ['tr/amr nyt', 'tr-kampagne 2026', 'tr - udsendelser'],
    description: 'Nyt til tillidsrepræsentanter og arbejdsmiljørepræsentanter.',
  },
  {
    key: 'kompetencenyt',
    label: 'Kompetencenyt',
    short: 'Kompetencenyt',
    color: series[5],
    soft: seriesSoft[5],
    tags: ['kompetencenyt'],
    description: 'Nyt om kurser, efteruddannelse og kompetenceudvikling.',
  },
  {
    key: 'netvaerksnyt',
    label: 'Netværksnyt',
    short: 'Netværksnyt',
    color: '#4fa388',
    soft: '#cfe6dd',
    tags: ['netværksnyt'],
    description: 'Nyt fra faglige netværk og selskaber.',
  },
  {
    key: 'medlemskommunikation',
    label: 'Medlemskommunikation',
    short: 'Medlemskomm.',
    color: navyRamp[600],
    soft: navyRamp[200],
    tags: ['medlemskommunikation', 'strakskampagne', 'løbende medlemstilfredshed'],
    description: 'Direkte medlemsinformation, strakskampagner og tilfredshedsmålinger.',
  },
  {
    key: 'ovrige',
    label: 'Øvrige udsendelser',
    short: 'Øvrige',
    color: '#8299bb',
    soft: '#e7ebef',
    tags: [],
    description: 'Udsendelser uden en genkendelig type-tag.',
  },
]

export const mailingTypeByKey = new Map(mailingTypes.map((t) => [t.key, t]))

/** Resolve a set of Ungapped tag titles to a single mailing type. */
export function resolveMailingType(tags: string[]): MailingTypeKey {
  const lower = tags.map((t) => t.trim().toLowerCase())
  // Specific types win over the catch-all "flow" tag, which is applied broadly.
  const order: MailingTypeKey[] = [
    'nyhedsbrev', 'magasinet-p', 'videncenter', 'tr-amr',
    'kompetencenyt', 'netvaerksnyt', 'medlemskommunikation', 'flow',
  ]
  for (const key of order) {
    const type = mailingTypeByKey.get(key)!
    if (type.tags.some((t) => lower.includes(t))) return key
  }
  return 'ovrige'
}

export const colorForType = (key: MailingTypeKey) => mailingTypeByKey.get(key)?.color ?? '#8299bb'
export const softForType = (key: MailingTypeKey) => mailingTypeByKey.get(key)?.soft ?? '#e7ebef'
export const labelForType = (key: MailingTypeKey) => mailingTypeByKey.get(key)?.label ?? 'Øvrige'
