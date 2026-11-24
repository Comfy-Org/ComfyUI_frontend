import { configDefaults, mergeConfig } from 'vitest/config'

import base from './vite.config.mts'

const merged = mergeConfig(base, {
  test: {
    coverage: { enabled: false },
    retry: 0
  }
})

merged.test.projects = undefined
merged.test.include = ['scripts/registry-census/*.census.test.ts']
merged.test.exclude = [...configDefaults.exclude]
merged.test.setupFiles = ['./vitest.console.setup.ts', './vitest.setup.ts']
export default merged
