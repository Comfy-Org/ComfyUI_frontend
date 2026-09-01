import { describe, expectTypeOf, it } from 'vitest'

import type { GraphLoadToken } from './graphLoadLifecycle'
import { beginGraphLoad } from './graphLoadLifecycle'

describe('graphLoadLifecycle', () => {
  it('exposes only tokens created by beginGraphLoad', () => {
    expectTypeOf(Symbol()).not.toMatchTypeOf<GraphLoadToken>()
    expectTypeOf(beginGraphLoad).returns.toEqualTypeOf<GraphLoadToken>()
  })
})
