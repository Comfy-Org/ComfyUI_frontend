import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { run } from 'vue-tsc'

const require = createRequire(import.meta.url)
const packages = fileURLToPath(
  new URL('../tsconfig.packages.json', import.meta.url)
)
const build = spawnSync(
  process.execPath,
  [require.resolve('vue-tsc/bin/vue-tsc.js'), '-b', packages],
  {
    stdio: 'inherit'
  }
)
if (build.error) {
  process.stderr.write(`${build.error.message}\n`)
  process.exit(1)
}
if (build.status !== 0) process.exit(build.status ?? 1)

const bridgeRoot = path.dirname(
  require.resolve('typescript-native-bridge/package.json')
)

run(path.join(bridgeRoot, 'lib/tsc.js'))
