import { configDefaults, mergeConfig } from 'vitest/config'

import base from './vite.config.mts'

// The baseline registry form census: no pack code, every class in
// scripts/registry-census/object_info.shape.json. Separate from
// vitest.matrix.config.mts because it is a different population measured once
// rather than per pack, and separate from test:unit because it is a census and
// not a gate -- vite.config.mts excludes the same glob from the tooling
// project, which would otherwise collect it through `scripts/**/*.test.ts`.
//
// include/exclude/setupFiles are assigned after the merge for the same reason
// the matrix config does it: mergeConfig CONCATENATES arrays, so the base
// config's exclusions and its vitest.timer.setup.ts fake timers would
// otherwise be carried in.
const merged = mergeConfig(base, {
  test: {
    coverage: { enabled: false },
    retry: 0
  }
})

merged.test.projects = undefined
// The same glob vite.config.mts excludes from the tooling project, so a census
// spec can only ever be collected by one of the two.
merged.test.include = ['scripts/registry-census/*.census.test.ts']
merged.test.exclude = [...configDefaults.exclude]
merged.test.setupFiles = ['./vitest.console.setup.ts', './vitest.setup.ts']
export default merged
