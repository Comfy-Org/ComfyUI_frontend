import { describe, expect, it } from 'vitest'

import { isPromotedWidgetView } from './promotedWidgetTypes'

describe('isPromotedWidgetView', () => {
  it('returns true for widgets with sourceNodeId and sourceWidgetName', () => {
    const widget = {
      name: 'test',
      value: 0,
      sourceNodeId: 'node-1',
      sourceWidgetName: 'steps'
    }
    expect(isPromotedWidgetView(widget as never)).toBe(true)
  })

  it('returns false for regular widgets', () => {
    const widget = { name: 'test', value: 0 }
    expect(isPromotedWidgetView(widget as never)).toBe(false)
  })
})
