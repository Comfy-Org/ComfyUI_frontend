import { describe, expect, it } from 'vitest'

import { DEFAULT_CAMERA_ANGLE_STATE } from './types'
import {
  isViewMode,
  readStateFromWidgets,
  readViewMode,
  writeStateToWidgets,
  writeViewMode
} from './widgetBridge'
import type { NodeWithWidgets, WidgetLike } from './widgetBridge'

function nodeWithWidgets(
  values: Record<string, unknown>
): NodeWithWidgets & { widgets: WidgetLike[] } {
  return {
    widgets: Object.entries(values).map(([name, value]) => ({ name, value }))
  }
}

describe('readStateFromWidgets', () => {
  it('falls back to defaults when widgets are missing or malformed', () => {
    expect(readStateFromWidgets({})).toEqual(DEFAULT_CAMERA_ANGLE_STATE)
    expect(
      readStateFromWidgets(
        nodeWithWidgets({ horizontal_angle: 'abc', zoom: Number.NaN })
      )
    ).toEqual(DEFAULT_CAMERA_ANGLE_STATE)
  })

  it('reads and clamps the three angle widgets', () => {
    const state = readStateFromWidgets(
      nodeWithWidgets({ horizontal_angle: 90, vertical_angle: 99, zoom: 2.5 })
    )
    expect(state).toEqual({ horizontal: 90, vertical: 60, zoom: 2.5 })
  })
})

describe('writeStateToWidgets', () => {
  it('writes only widgets whose value changed', () => {
    const node = nodeWithWidgets({
      horizontal_angle: 0,
      vertical_angle: 0,
      zoom: 5
    })
    writeStateToWidgets(node, { horizontal: 45, vertical: 0, zoom: 5 })
    expect(node.widgets.map((w) => w.value)).toEqual([45, 0, 5])
  })

  it('rounds fractional interaction values before writing', () => {
    const node = nodeWithWidgets({
      horizontal_angle: 0,
      vertical_angle: 0,
      zoom: 5
    })
    writeStateToWidgets(node, {
      horizontal: 328.58,
      vertical: 35.14,
      zoom: 3.4999998
    })
    expect(node.widgets.map((w) => w.value)).toEqual([329, 35, 3.5])
  })

  it('ignores nodes without the widgets', () => {
    expect(() =>
      writeStateToWidgets({}, { horizontal: 1, vertical: 2, zoom: 3 })
    ).not.toThrow()
  })
})

describe('view mode widget', () => {
  it('validates view mode strings', () => {
    expect(isViewMode('camera')).toBe(true)
    expect(isViewMode('object')).toBe(true)
    expect(isViewMode('')).toBe(false)
    expect(isViewMode(1)).toBe(false)
  })

  it('reads the stored mode and defaults to camera', () => {
    expect(readViewMode(nodeWithWidgets({ view: 'object' }))).toBe('object')
    expect(readViewMode(nodeWithWidgets({ view: '' }))).toBe('camera')
    expect(readViewMode({})).toBe('camera')
  })

  it('writes the mode into the view widget', () => {
    const node = nodeWithWidgets({ view: 'camera' })
    writeViewMode(node, 'object')
    expect(node.widgets[0].value).toBe('object')
  })
})
