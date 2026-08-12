import { configDefaults, mergeConfig } from 'vitest/config'

import base from './vite.config.mts'

// The ecosystem matrix: generated per-pack specs (scripts/registry-census/
// build_matrix.py) that execute real custom-node pack JS against the real
// frontend runtime. Radar, never a gate - run via the registry-census
// workflow or locally, never as part of test:unit. include/exclude are
// assigned after the merge: mergeConfig concatenates arrays, which would
// otherwise carry the base config's exclusion of this very directory.
const merged = mergeConfig(base, {
  test: { coverage: { enabled: false }, retry: 0, setupFiles: [] }
})
merged.test.include = ['src/__ecs_matrix__/*.matrix.test.ts']
merged.test.exclude = [...configDefaults.exclude]
export default merged
