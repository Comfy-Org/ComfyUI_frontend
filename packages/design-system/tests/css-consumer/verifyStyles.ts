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

const voidBuild = await build({
  configFile: false,
  plugins: [tailwindcss()],
  logLevel: 'error',
  build: { write: false, rolldownOptions: { input: 'void-theme.css' } }
})
assert(!Array.isArray(voidBuild) && 'output' in voidBuild)
const voidCss = voidBuild.output
  .filter((file) => file.type === 'asset' && file.fileName.endsWith('.css'))
  .map((file) => (file.type === 'asset' ? file.source.toString() : ''))
  .join('\n')

assert.match(voidCss, /--color-background:\s*oklch\(/)
assert.match(voidCss, /\.bg-secondary\s*\{/)
assert.match(voidCss, /\.icon-\\\[lucide--check\\\]\s*\{/)
assert.match(voidCss, /\.z-overlay\s*\{/)
process.stdout.write(
  'Packed CSS and the Void theme compile without Vue, Reka, or VueUse installed.\n'
)
