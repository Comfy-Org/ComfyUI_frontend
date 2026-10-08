import { describe, expect, it, vi } from 'vitest'

import {
  captureHubRowView,
  hubActiveQuery,
  hubFilterValue,
  hubItemOf
} from './hub-analytics'
import { captureWorkshopEvent } from './posthog'

vi.mock(import('./posthog'))

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

  it.for([
    ['  Kling  ', { query: 'kling' }],
    ['   ', {}]
  ] as const)('carries the search %o as %o', ([raw, expected]) => {
    expect(hubActiveQuery(raw)).toEqual(expected)
  })

  it('reports a row view with how many items it showed', () => {
    captureHubRowView({
      surface: 'workflows',
      source: 'category_row',
      row: 'video',
      slugs: ['workflows/animate', 'workflows/connect']
    })

    expect(captureWorkshopEvent).toHaveBeenCalledWith({
      name: 'hub_row_viewed',
      properties: {
        surface: 'workflows',
        source: 'category_row',
        row: 'video',
        item_count: 2,
        slugs: ['workflows/animate', 'workflows/connect']
      }
    })
  })
})
