import { configDefaults, mergeConfig } from 'vitest/config'

import base from './vite.config.mts'

// The ecosystem matrix: generated per-pack specs (scripts/registry-census/
// build_matrix.py) that execute real custom-node pack JS against the real
// frontend runtime. Run via the ci-ecosystem-matrix workflow or locally,
// never as part of test:unit. include/exclude/setupFiles are assigned after
// the merge: mergeConfig CONCATENATES arrays, which would otherwise carry the
// base config's exclusion of this very directory - and its setup files,
// including vitest.timer.setup.ts, which would run every pack under fake
// timers. Keep vitest.setup.ts (environment globals the runtime needs);
// packs execute under real timers.
const merged = mergeConfig(base, {
  test: {
    coverage: { enabled: false },
    retry: 0
  }
})

const PACK_FRAME = '__ecs_matrix__'

// Pack code leaks unhandled rejections; without tolerating them vitest
// attributes a stray rejection to whichever file is currently COLLECTING and
// fails an innocent spec before its write-ahead stub exists (run
// 31734434601: 470 specs, 469 rows). Tolerating ALL of them also hid
// configuration, collection, worker and OOM failures, so the tolerance is
// scoped to frames inside the generated pack tree. An error from anywhere
// else is the harness failing and stays fatal.
merged.test.onUnhandledError = (error: unknown) => {
  const stack =
    error && typeof error === 'object' && 'stack' in error
      ? String((error as { stack?: unknown }).stack ?? '')
      : ''
  if (stack.includes(PACK_FRAME)) return false
  console.error('[matrix] unhandled error outside pack code:', error)
  return true
}

merged.test.include = ['src/__ecs_matrix__/*.matrix.test.ts']
merged.test.exclude = [...configDefaults.exclude]
merged.test.setupFiles = ['./vitest.setup.ts']
export default merged
