import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const css = readdirSync('dist/assets')
  .filter((file) => file.endsWith('.css'))
  .map((file) => readFileSync(`dist/assets/${file}`, 'utf8'))
  .join('\n')

assert.match(css, /\.bg-secondary\s*\{/)
assert.match(css, /\.inline-flex\s*\{/)
assert.match(css, /\.dot-animation\[data-v-/)
assert.match(css, /@keyframes/)
process.stdout.write(
  'Packed theme utilities and scoped animation styles compile.\n'
)
