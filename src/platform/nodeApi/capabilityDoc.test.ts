import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('the documented capability list', () => {
  it('matches CAPABILITIES', () => {
    // A stale list is not a documentation nit. When the doc said eleven
    // capabilities and the code had eighteen, agents read widgets.mount,
    // widgets.canvas, setSizeConstraints and defs.define as unimplemented and
    // punted twelve files against API that already existed.
    expect(() =>
      execFileSync('node', [
        'scripts/node-api/gen_capability_list.mjs',
        '--check'
      ])
    ).not.toThrow()
  })
})
