#!/usr/bin/env node
/**
 * Build the private, self-contained dashboard.
 *
 * The Pages build fetches its data at runtime; this one carries it. Vite has
 * already inlined the CSS and JS, so all that is left is to write the dataset
 * into the document ahead of the app bundle, where the data layer looks for it.
 *
 * The result is one file: open it from a laptop, put it on the intranet, send
 * it in an e-mail. Nothing is fetched, so it works offline and never touches a
 * public URL.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const htmlPath = path.resolve(process.argv[2] ?? 'dist-single/index.html')
const dataPath = path.resolve(process.argv[3] ?? 'public/data/members.json')
const outPath = path.resolve(process.argv[4] ?? 'DP-medlemsdashboard.html')

const [html, raw] = await Promise.all([readFile(htmlPath, 'utf8'), readFile(dataPath, 'utf8')])

// Parse and re-serialise so a malformed file fails here rather than in the page.
const data = JSON.parse(raw)

/**
 * `</script>` inside the JSON would close the tag early, and U+2028/2029 are
 * newlines to a JavaScript parser but not to JSON.
 */
const safe = JSON.stringify(data)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029')

const injection = `<script>window.__DP_MEMBERS__=JSON.parse(${JSON.stringify(safe)});</script>`

if (!html.includes('<div id="root">')) {
  console.error('Uventet HTML: fandt ikke #root. Er singlefile-bygget kørt?')
  process.exit(1)
}

// Ahead of the app bundle, so the first render already has the data.
const out = html.replace('<div id="root">', `${injection}<div id="root">`)

await writeFile(outPath, out)

const mb = Math.round((out.length / 1024 / 1024) * 10) / 10
console.log(`✔ ${path.relative(process.cwd(), outPath)} — ${mb} MB, selvstændig`)
console.log(`  ${data.meta.months} måneder · ${data.meta.first} → ${data.meta.latest}`)
console.log(`  data fra ${data.meta.generatedAt}`)
