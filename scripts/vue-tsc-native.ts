import { createRequire } from 'node:module'

import { run } from 'vue-tsc'

const require = createRequire(import.meta.url)

run(require.resolve('typescript-native-bridge/lib/tsc'))
