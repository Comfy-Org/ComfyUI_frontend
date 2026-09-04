import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * vitest.timer.setup.ts clears storage between tests. Node >= 25 enables the
 * Web Storage API by default, and its built-in `localStorage` object has no
 * `clear()` unless `--localstorage-file` points at a valid path. A test
 * environment that does not replace the global (a `node` environment, or a
 * worker where the happy-dom environment failed to load) therefore crashes
 * every file in the suite with
 * `TypeError: globalThis.localStorage?.clear is not a function` if the setup
 * uses a plain `clear()` call. The `?.()` optional call keeps happy-dom
 * cleanup intact (its Storage always has `clear()`) and degrades to a no-op
 * against the Node built-in.
 *
 * These checks pin both halves of that contract: the setup file must use the
 * environment-safe call, and the safe form must not throw against the real
 * Node runtime in a child process.
 */
describe('vitest.timer.setup.ts storage cleanup is environment-safe', () => {
  it('uses the optional clear call for localStorage', () => {
    const setup = readFileSync(
      resolve(process.cwd(), 'vitest.timer.setup.ts'),
      'utf8'
    )

    expect(setup).toContain('globalThis.localStorage?.clear?.()')
    expect(setup).not.toContain('globalThis.localStorage?.clear()')
  })

  it('the cleanup form does not throw against the real Node runtime', () => {
    // Runs in a fresh child process so the check observes the platform's
    // built-in webstorage rather than the happy-dom environment vitest
    // installs for this file.
    expect(() =>
      execFileSync(
        process.execPath,
        ['-e', 'globalThis.localStorage?.clear?.()'],
        {
          stdio: 'ignore'
        }
      )
    ).not.toThrow()
  })
})
