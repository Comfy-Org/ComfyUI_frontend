import { describe, expect, it } from 'vitest'

import { createOnceGate } from './onceGate'

describe('createOnceGate', () => {
  it('admits a key the first time only, per key', () => {
    const gate = createOnceGate()

    expect(gate.first('a:x')).toBe(true)
    expect(gate.first('a:x')).toBe(false)
    expect(gate.first('b:x')).toBe(true)
  })

  it('admits every key again after a reset', () => {
    const gate = createOnceGate()
    gate.first('a:x')

    gate.reset()

    expect(gate.first('a:x')).toBe(true)
  })
})
