import { describe, expect, it } from 'vitest'

import type { WidgetState } from '@/stores/widgetValueStore'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'

import { boundsExtractor, singleValueExtractor } from './useUpstreamValue'

function widget(name: string, value: unknown): WidgetState {
  return { name, type: 'INPUT', value, nodeId: '1' as NodeId, options: {} }
}

const isNumber = (v: unknown): v is number => typeof v === 'number'

describe('singleValueExtractor', () => {
  const extract = singleValueExtractor(isNumber)

  it('matches widget by outputName', () => {
    const widgets = [widget('a', 'text'), widget('b', 42)]
    expect(extract(widgets, 'b')).toBe(42)
  })

  it('returns undefined when outputName widget has invalid value', () => {
    const widgets = [widget('a', 'text'), widget('b', 'not a number')]
    expect(extract(widgets, 'b')).toBeUndefined()
  })

  it('falls back to unique valid widget when outputName has no match', () => {
    const widgets = [widget('a', 'text'), widget('b', 42)]
    expect(extract(widgets, 'missing')).toBe(42)
  })

  it('falls back to unique valid widget when no outputName provided', () => {
    const widgets = [widget('a', 'text'), widget('b', 42)]
    expect(extract(widgets, undefined)).toBe(42)
  })

  it('returns undefined when multiple widgets have valid values', () => {
    const widgets = [widget('a', 1), widget('b', 2)]
    expect(extract(widgets, undefined)).toBeUndefined()
  })

  it('returns undefined when no widgets have valid values', () => {
    const widgets = [widget('a', 'text')]
    expect(extract(widgets, undefined)).toBeUndefined()
  })

  it('returns undefined for empty widgets', () => {
    expect(extract([], undefined)).toBeUndefined()
  })
})

describe('boundsExtractor', () => {
  const extract = boundsExtractor()

  it('extracts a single bounds object widget', () => {
    const bounds = { x: 10, y: 20, width: 100, height: 200 }
    const widgets = [widget('crop', bounds)]
    expect(extract(widgets, undefined)).toEqual(bounds)
  })

  it('matches bounds widget by outputName', () => {
    const bounds = { x: 1, y: 2, width: 3, height: 4 }
    const widgets = [widget('other', 'text'), widget('crop', bounds)]
    expect(extract(widgets, 'crop')).toEqual(bounds)
  })

  it('assembles bounds from individual x/y/width/height widgets', () => {
    const widgets = [
      widget('x', 10),
      widget('y', 20),
      widget('width', 100),
      widget('height', 200)
    ]
    expect(extract(widgets, undefined)).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 200
    })
  })

  it('returns undefined when some bound components are missing', () => {
    const widgets = [widget('x', 10), widget('y', 20), widget('width', 100)]
    expect(extract(widgets, undefined)).toBeUndefined()
  })

  it('returns undefined when bound components have wrong types', () => {
    const widgets = [
      widget('x', '10'),
      widget('y', 20),
      widget('width', 100),
      widget('height', 200)
    ]
    expect(extract(widgets, undefined)).toBeUndefined()
  })

  it('returns undefined for empty widgets', () => {
    expect(extract([], undefined)).toBeUndefined()
  })

  it('rejects partial bounds objects', () => {
    const partial = { x: 10, y: 20 }
    const widgets = [widget('crop', partial)]
    expect(extract(widgets, undefined)).toBeUndefined()
  })

  it('prefers single bounds object over individual widgets', () => {
    const bounds = { x: 1, y: 2, width: 3, height: 4 }
    const widgets = [
      widget('crop', bounds),
      widget('x', 99),
      widget('y', 99),
      widget('width', 99),
      widget('height', 99)
    ]
    expect(extract(widgets, undefined)).toEqual(bounds)
  })
})
