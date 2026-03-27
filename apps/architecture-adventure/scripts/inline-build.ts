import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const distDir = join(import.meta.dirname, '..', 'dist')
const htmlPath = join(distDir, 'index.html')

let html = readFileSync(htmlPath, 'utf-8')

const assetsDir = join(distDir, 'assets')
if (existsSync(assetsDir)) {
  const assets = readdirSync(assetsDir)

  // Inline CSS files
  for (const file of assets) {
    if (file.endsWith('.css')) {
      const css = readFileSync(join(assetsDir, file), 'utf-8')
      html = html.replace(
        new RegExp(`<link[^>]*href="[./]*assets/${file}"[^>]*>`),
        `<style>${css}</style>`
      )
    }
  }

  // Inline JS files
  for (const file of assets) {
    if (file.endsWith('.js')) {
      const js = readFileSync(join(assetsDir, file), 'utf-8')
      html = html.replace(
        new RegExp(`<script[^>]*src="[./]*assets/${file}"[^>]*></script>`),
        `<script type="module">${js}</script>`
      )
    }
  }
}

writeFileSync(htmlPath, html)

const sizeKB = (Buffer.byteLength(html) / 1024).toFixed(1)
console.warn(`Single-file build complete: ${htmlPath} (${sizeKB} KB)`)
