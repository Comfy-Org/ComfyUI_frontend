import { configDefaults, mergeConfig } from 'vitest/config'

import base from './vite.config.mts'

// The ecosystem matrix: generated per-pack specs (scripts/registry-census/
// build_matrix.py) that execute real custom-node pack JS against the real
// frontend runtime. Run via the registry-census workflow or locally, never
// as part of test:unit. include/exclude/setupFiles are assigned after the
// merge: mergeConfig CONCATENATES arrays, which would otherwise carry the
// base config's exclusion of this very directory - and its setup files,
// including vitest.timer.setup.ts, which would run every pack under fake
// timers. Keep vitest.setup.ts (environment globals the runtime needs);
// packs execute under real timers.
const merged = mergeConfig(base, {
  test: { coverage: { enabled: false }, retry: 0 }
})
merged.test.include = ['src/__ecs_matrix__/*.matrix.test.ts']
merged.test.exclude = [...configDefaults.exclude]
merged.test.setupFiles = ['./vitest.setup.ts']
export default merged
