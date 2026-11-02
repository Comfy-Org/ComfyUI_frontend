import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'

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
process.stdout.write(
  'Packed CSS compiles without Vue, Reka, or VueUse installed.\n'
)
