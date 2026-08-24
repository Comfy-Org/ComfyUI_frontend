import { describe, expect, it } from 'vitest'

import { matrixRendererFromEnv } from './matrixMode'

describe('matrixRendererFromEnv', () => {
  it.for([
    [undefined, 'legacy'],
    ['', 'legacy'],
    ['0', 'legacy'],
    ['1', 'vue']
  ] as const)('maps %s to %s', ([value, expected]) => {
    expect(matrixRendererFromEnv(value)).toBe(expected)
  })

  it('rejects ambiguous values instead of silently selecting a renderer', () => {
    expect(() => matrixRendererFromEnv('true')).toThrow(
      'MATRIX_VUE must be 0 or 1'
    )
  })
})
