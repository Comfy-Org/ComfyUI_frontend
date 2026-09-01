import { describe, expect, expectTypeOf, it } from 'vitest'

import type { GraphLoadToken } from './graphLoadLifecycle'
import {
  beginGraphLoad,
  beginGraphLoadScope,
  onGraphLoadLifecycle
} from './graphLoadLifecycle'

describe('graphLoadLifecycle', () => {
  it('exposes only tokens created by beginGraphLoad', () => {
    expectTypeOf(Symbol()).not.toMatchTypeOf<GraphLoadToken>()
    expectTypeOf(beginGraphLoad).returns.toEqualTypeOf<GraphLoadToken>()
  })

  it('settles a load scope exactly once across explicit and scope-exit disposal', () => {
    const events: string[] = []
    const stop = onGraphLoadLifecycle(({ type }) => events.push(type))

    try {
      {
        using scope = beginGraphLoadScope()
        scope[Symbol.dispose]()
        scope[Symbol.dispose]()
      }
    } finally {
      stop()
    }

    expect(events).toEqual(['started', 'settled'])
  })

  it('settles a load scope when its block throws', () => {
    const events: string[] = []
    const stop = onGraphLoadLifecycle(({ type }) => events.push(type))

    try {
      expect(() => {
        using _scope = beginGraphLoadScope()
        throw new Error('load failed')
      }).toThrow('load failed')
    } finally {
      stop()
    }

    expect(events).toEqual(['started', 'settled'])
  })
})
