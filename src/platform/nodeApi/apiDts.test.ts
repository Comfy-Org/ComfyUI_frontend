import { describe, expect, it } from 'vitest'

import { declarations } from '../../../scripts/magic-patch/gen_api_dts.mjs'

describe('generated custom-node API contract', () => {
  it('includes only exported type declarations and their own documentation', () => {
    const source = `
/** Public options. */
export interface Options {
  enabled: boolean
}

const privateState = { enabled: false }

/** Public mode. */
export type Mode = 'on' | 'off'

export function mutate(): void {}
`

    const extracted = declarations(source)

    expect(extracted.map(({ kind, name }) => ({ kind, name }))).toEqual([
      { kind: 'interface', name: 'Options' },
      { kind: 'type', name: 'Mode' }
    ])
    expect(extracted.map(({ text }) => text).join('\n')).not.toContain(
      'privateState'
    )
    expect(extracted.map(({ text }) => text).join('\n')).not.toContain(
      'function mutate'
    )
    expect(extracted[1].text).toContain('/** Public mode. */')
  })
})
