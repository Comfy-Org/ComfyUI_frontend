import { createRequire } from 'node:module'
import path from 'node:path'

import { run } from 'vue-tsc'

const require = createRequire(import.meta.url)
const bridgeRoot = path.dirname(
  require.resolve('typescript-native-bridge/package.json')
)

run(path.join(bridgeRoot, 'lib/tsc.js'))
