import { describe, expect, it } from 'vitest'

import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { getStableWidgetRenderKey } from './widgetRenderKey'

function createWidget(overrides: Partial<IBaseWidget> = {}): IBaseWidget {
  return {
    name: 'seed',
    type: 'number',
    ...overrides
  } as IBaseWidget
}

describe(getStableWidgetRenderKey, () => {
  it('returns a stable key for the same widget instance', () => {
    const widget = createWidget()

    const first = getStableWidgetRenderKey(widget)
    const second = getStableWidgetRenderKey(widget)

    expect(second).toBe(first)
  })

  it('returns distinct keys for distinct widget instances', () => {
    const firstWidget = createWidget()
    const secondWidget = createWidget()

    const firstKey = getStableWidgetRenderKey(firstWidget)
    const secondKey = getStableWidgetRenderKey(secondWidget)

    expect(secondKey).not.toBe(firstKey)
  })
})
