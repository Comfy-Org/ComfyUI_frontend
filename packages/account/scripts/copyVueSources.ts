/**
 * The Vue SFCs ship as source for the consumer's bundler: vue-tsc emits their
 * declarations, this copies the `.vue` files next to them and drops the
 * script-only `.vue.js` vue-tsc also writes.
 */
import { copyFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDir = fileURLToPath(new URL('..', import.meta.url))
const sourceDir = join(packageDir, 'src', 'vue')
const distDir = join(packageDir, 'dist', 'vue')

for (const name of readdirSync(sourceDir)) {
  if (!name.endsWith('.vue')) continue
  rmSync(join(distDir, `${name}.js`), { force: true })
  copyFileSync(join(sourceDir, name), join(distDir, name))
}
