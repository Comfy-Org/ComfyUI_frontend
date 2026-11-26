import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'

import tailwindcss from '@tailwindcss/vite'
import { build } from 'vite'

const require = createRequire(
  import.meta.resolve('@comfyorg/design-system/css/style.css')
)
for (const peer of ['vue', 'reka-ui', '@vueuse/core', '@vueuse/integrations']) {
  assert.throws(() => require.resolve(peer), { code: 'MODULE_NOT_FOUND' })
}

const css = readdirSync('dist/assets')
  .filter((file) => file.endsWith('.css'))
  .map((file) => readFileSync(`dist/assets/${file}`, 'utf8'))
  .join('\n')

assert.match(css, /\.bg-secondary\s*\{/)
assert.match(css, /--background:/)

const baselineBuild = await build({
  configFile: false,
  plugins: [tailwindcss()],
  logLevel: 'error',
  build: { write: false, rolldownOptions: { input: 'baseline-theme.css' } }
})
assert(!Array.isArray(baselineBuild) && 'output' in baselineBuild)
const baselineCss = baselineBuild.output
  .filter((file) => file.type === 'asset' && file.fileName.endsWith('.css'))
  .map((file) => (file.type === 'asset' ? file.source.toString() : ''))
  .join('\n')

const effectiveBackground = [
  ...baselineCss.matchAll(/--background:\s*([^;}]+)/g)
]
  .at(-1)?.[1]
  ?.trim()
assert.match(
  effectiveBackground ?? '',
  /^oklch\((?:0?\.19|19%)\s+0?\.003\s+285\)$/
)
assert.match(baselineCss, /\.bg-secondary\s*\{[^}]*var\(--secondary\)/)
assert.match(baselineCss, /\.icon-\\\[lucide--check\\\]\s*\{/)
assert.match(baselineCss, /\.z-overlay\s*\{/)
assert.doesNotMatch(baselineCss, /body\s*\{[^}]*overflow:\s*hidden/)
assert.doesNotMatch(baselineCss, /#vue-app\s*\{/)
process.stdout.write(
  'Packed CSS and the baseline compile without Vue, Reka, or VueUse installed.\n'
)
