import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetState } from '@/stores/widgetValueStore'
import { resetWorldInstance } from '@/world/worldInstance'

import {
  boundsExtractor,
  singleValueExtractor,
  useUpstreamValue
} from './useUpstreamValue'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: {
      graph: { rootGraph: { id: '00000000-0000-0000-0000-000000000001' } }
    }
  })
}))

function widgetState(value: unknown): WidgetState {
  return {
    type: 'INPUT',
    value,
    options: {},
    label: undefined,
    serialize: undefined,
    disabled: undefined
  }
}

function widgetMap(
  ...entries: Array<[string, unknown]>
): Map<string, WidgetState> {
  return new Map(entries.map(([name, value]) => [name, widgetState(value)]))
}

const isNumber = (v: unknown): v is number => typeof v === 'number'

describe('singleValueExtractor', () => {
  const extract = singleValueExtractor(isNumber)

  it('matches widget by outputName', () => {
    const widgets = widgetMap(['a', 'text'], ['b', 42])
    expect(extract(widgets, 'b')).toBe(42)
  })

  it('returns undefined when outputName widget has invalid value', () => {
    const widgets = widgetMap(['a', 'text'], ['b', 'not a number'])
    expect(extract(widgets, 'b')).toBeUndefined()
  })

  it('falls back to unique valid widget when outputName has no match', () => {
    const widgets = widgetMap(['a', 'text'], ['b', 42])
    expect(extract(widgets, 'missing')).toBe(42)
  })

  it('falls back to unique valid widget when no outputName provided', () => {
    const widgets = widgetMap(['a', 'text'], ['b', 42])
    expect(extract(widgets, undefined)).toBe(42)
  })

  it('returns undefined when multiple widgets have valid values', () => {
    const widgets = widgetMap(['a', 1], ['b', 2])
    expect(extract(widgets, undefined)).toBeUndefined()
  })

  it('returns undefined when no widgets have valid values', () => {
    const widgets = widgetMap(['a', 'text'])
    expect(extract(widgets, undefined)).toBeUndefined()
  })

  it('returns undefined for empty widgets', () => {
    expect(extract(new Map(), undefined)).toBeUndefined()
  })
})

describe('boundsExtractor', () => {
  const extract = boundsExtractor()

  it('extracts a single bounds object widget', () => {
    const bounds = { x: 10, y: 20, width: 100, height: 200 }
    const widgets = widgetMap(['crop', bounds])
    expect(extract(widgets, undefined)).toEqual(bounds)
  })

  it('matches bounds widget by outputName', () => {
    const bounds = { x: 1, y: 2, width: 3, height: 4 }
    const widgets = widgetMap(['other', 'text'], ['crop', bounds])
    expect(extract(widgets, 'crop')).toEqual(bounds)
  })

  it('assembles bounds from individual x/y/width/height widgets', () => {
    const widgets = widgetMap(
      ['x', 10],
      ['y', 20],
      ['width', 100],
      ['height', 200]
    )
    expect(extract(widgets, undefined)).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 200
    })
  })

  it('returns undefined when some bound components are missing', () => {
    const widgets = widgetMap(['x', 10], ['y', 20], ['width', 100])
    expect(extract(widgets, undefined)).toBeUndefined()
  })

  it('returns undefined when bound components have wrong types', () => {
    const widgets = widgetMap(
      ['x', '10'],
      ['y', 20],
      ['width', 100],
      ['height', 200]
    )
    expect(extract(widgets, undefined)).toBeUndefined()
  })

  it('returns undefined for empty widgets', () => {
    expect(extract(new Map(), undefined)).toBeUndefined()
  })

  it('rejects partial bounds objects', () => {
    const partial = { x: 10, y: 20 }
    const widgets = widgetMap(['crop', partial])
    expect(extract(widgets, undefined)).toBeUndefined()
  })

  it('prefers single bounds object over individual widgets', () => {
    const bounds = { x: 1, y: 2, width: 3, height: 4 }
    const widgets = widgetMap(
      ['crop', bounds],
      ['x', 99],
      ['y', 99],
      ['width', 99],
      ['height', 99]
    )
    expect(extract(widgets, undefined)).toEqual(bounds)
  })
})

describe('useUpstreamValue (store-backed read path)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    resetWorldInstance()
  })

  it('reads upstream node widgets via the widget value store', () => {
    const graphId = '00000000-0000-0000-0000-000000000001' as UUID
    const state = useWidgetValueStore().registerWidget(graphId, {
      nodeId: 'upstream-1' as NodeId,
      name: 'value',
      type: 'number',
      value: 7,
      options: {}
    })

    const upstreamValue = useUpstreamValue<number>(
      () => ({ nodeId: 'upstream-1', outputName: 'value' }),
      singleValueExtractor((v): v is number => typeof v === 'number')
    )

    expect(upstreamValue.value).toBe(7)
    state.value = 11
    expect(upstreamValue.value).toBe(11)
  })

  it('returns undefined when no upstream linkage is provided', () => {
    const upstreamValue = useUpstreamValue(
      () => undefined,
      singleValueExtractor((v): v is number => typeof v === 'number')
    )
    expect(upstreamValue.value).toBeUndefined()
  })
})
