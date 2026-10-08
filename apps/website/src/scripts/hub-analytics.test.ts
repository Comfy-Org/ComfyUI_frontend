import { describe, expect, it } from 'vitest'

import { hubFilterValue, hubItemOf } from './hub-analytics'

describe('hub analytics', () => {
  it.for([
    [{ slug: 'flux', routerId: 'bfl/flux' }, 'model'],
    [{ slug: 'workflows/upscale', type: 'CLOUD' as const }, 'workflow'],
    [{ slug: 'apps/reshoot', type: 'APP' as const }, 'app']
  ] as const)('names %o a %s', ([model, kind]) => {
    expect(hubItemOf(model)).toEqual({ kind, slug: model.slug })
  })

  it.for([
    ['name', 'name'],
    [[], 'all'],
    [['edit-images', 'audio'], 'edit-images,audio']
  ] as const)('writes the filter %o as %s', ([value, expected]) => {
    expect(hubFilterValue(value)).toBe(expected)
  })
})
