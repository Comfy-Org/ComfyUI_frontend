import { describe, expect, it } from 'vitest'

import { DEFAULT_CAMERA_INFO_STATE } from './types'
import { readStateFromWidgets, writeWidgetValue } from './widgetBridge'
import type { NodeWithWidgets } from './widgetBridge'

function nodeWithWidgets(
  values: Record<string, unknown>
): NodeWithWidgets & { widgets: { name: string; value: unknown }[] } {
  return {
    widgets: Object.entries(values).map(([name, value]) => ({ name, value }))
  }
}

describe('readStateFromWidgets', () => {
  it('returns defaults when the node has no widgets at all', () => {
    expect(readStateFromWidgets({})).toEqual(DEFAULT_CAMERA_INFO_STATE)
  })

  it('reads each widget by name (orbit-mode example)', () => {
    const node = nodeWithWidgets({
      mode: 'orbit',
      target_x: 1,
      target_y: 2,
      target_z: 3,
      roll: 10,
      fov: 50,
      zoom: 0.8,
      camera_type: 'perspective',
      'mode.yaw': 25,
      'mode.pitch': 40,
      'mode.distance': 7
    })

    const state = readStateFromWidgets(node)

    expect(state.mode).toBe('orbit')
    expect(state.target).toEqual({ x: 1, y: 2, z: 3 })
    expect(state.roll).toBe(10)
    expect(state.fov).toBe(50)
    expect(state.zoom).toBe(0.8)
    expect(state.orbit).toEqual({ yaw: 25, pitch: 40, distance: 7 })
  })

  it('reads the orthographic camera type and quaternion-mode fields', () => {
    const node = nodeWithWidgets({
      mode: 'quaternion',
      camera_type: 'orthographic',
      'mode.position_x': 1,
      'mode.position_y': 2,
      'mode.position_z': 3,
      'mode.quat_x': 0,
      'mode.quat_y': 0,
      'mode.quat_z': 0,
      'mode.quat_w': 1
    })

    const state = readStateFromWidgets(node)

    expect(state.cameraType).toBe('orthographic')
    expect(state.mode).toBe('quaternion')
    expect(state.quaternion.position).toEqual({ x: 1, y: 2, z: 3 })
    expect(state.quaternion.quat).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('falls back when a widget value has the wrong type', () => {
    const node = nodeWithWidgets({
      fov: 'not-a-number',
      mode: 'invalid-mode',
      camera_type: 42
    })

    const state = readStateFromWidgets(node)

    expect(state.fov).toBe(DEFAULT_CAMERA_INFO_STATE.fov)
    expect(state.mode).toBe(DEFAULT_CAMERA_INFO_STATE.mode)
    expect(state.cameraType).toBe(DEFAULT_CAMERA_INFO_STATE.cameraType)
  })

  it('rejects non-finite numbers (NaN / Infinity)', () => {
    const node = nodeWithWidgets({
      'mode.yaw': Number.NaN,
      'mode.distance': Number.POSITIVE_INFINITY
    })

    const state = readStateFromWidgets(node)

    expect(state.orbit.yaw).toBe(DEFAULT_CAMERA_INFO_STATE.orbit.yaw)
    expect(state.orbit.distance).toBe(DEFAULT_CAMERA_INFO_STATE.orbit.distance)
  })

  it('reads quaternion mode widgets', () => {
    const node = nodeWithWidgets({
      mode: 'quaternion',
      'mode.position_x': 1,
      'mode.position_y': 2,
      'mode.position_z': 3,
      'mode.quat_x': 0,
      'mode.quat_y': 0,
      'mode.quat_z': 0,
      'mode.quat_w': 1
    })

    const state = readStateFromWidgets(node)

    expect(state.mode).toBe('quaternion')
    expect(state.quaternion.position).toEqual({ x: 1, y: 2, z: 3 })
    expect(state.quaternion.quat).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })
})

describe('writeWidgetValue', () => {
  it('updates the named widget when the value differs', () => {
    const node = nodeWithWidgets({ 'mode.yaw': 0 })
    writeWidgetValue(node, 'mode.yaw', 45)
    expect(node.widgets.find((w) => w.name === 'mode.yaw')!.value).toBe(45)
  })

  it('is a no-op when the value already matches', () => {
    const node = nodeWithWidgets({ fov: 35 })
    const before = node.widgets[0].value
    writeWidgetValue(node, 'fov', 35)
    expect(node.widgets[0].value).toBe(before)
  })

  it('is a no-op when the widget does not exist', () => {
    const node = nodeWithWidgets({ fov: 35 })
    expect(() => writeWidgetValue(node, 'does_not_exist', 1)).not.toThrow()
    expect(node.widgets).toHaveLength(1)
  })
})
