import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('litegraphInstance', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('throws a named error when read before registration', async () => {
    const { litegraph } = await import('./litegraphInstance')
    expect(() => litegraph()).toThrowError(
      'LiteGraph singleton accessed before initialisation'
    )
  })

  it('returns the registered LiteGraph singleton after the barrel loads', async () => {
    const { LiteGraph } = await import('./litegraph')
    const { litegraph } = await import('./litegraphInstance')
    expect(litegraph()).toBe(LiteGraph)
  })
})
