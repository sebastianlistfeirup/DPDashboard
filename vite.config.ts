import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

// To builds fra samme kode:
//  - standard          → GitHub Pages, henter ./data/members.json ved indlæsning
//  - VITE_SINGLE_FILE  → én selvstændig .html med data indlejret
const singleFile = process.env.VITE_SINGLE_FILE === '1'

export default defineConfig({
  base: singleFile ? './' : (process.env.VITE_BASE ?? '/DPDashboard/'),
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    outDir: singleFile ? 'dist-single' : 'dist',
    emptyOutDir: true,
    assetsInlineLimit: singleFile ? 100_000_000 : 4096,
  },
})
