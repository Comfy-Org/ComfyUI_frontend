import { beforeEach, describe, expect, it } from 'vitest'

import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import { DEFAULT_CAMERA_INFO_STATE } from './types'
import { readCameraInfoState, writeCameraInfoValue } from './widgetBridge'

const GRAPH_ID = 'camera-info-test-graph'

let nodeCounter = 0

function makeScope(): LGraphNode {
  nodeCounter += 1
  return createMockLGraphNode({
    id: toNodeId(nodeCounter),
    graph: { rootGraph: { id: GRAPH_ID } }
  })
}

function registerValues(
  scope: LGraphNode,
  values: Record<string, unknown>
): void {
  const store = useWidgetValueStore()
  for (const [name, value] of Object.entries(values)) {
    store.registerWidget(widgetId(GRAPH_ID, scope.id, name), {
      type: typeof value === 'number' ? 'number' : 'combo',
      value: value as never,
      options: {}
    })
  }
}

function storedValue(scope: LGraphNode, name: string): unknown {
  return useWidgetValueStore().getWidget(widgetId(GRAPH_ID, scope.id, name))
    ?.value
}

let scope: LGraphNode

beforeEach(() => {
  scope = makeScope()
})

describe('readCameraInfoState', () => {
  it('returns defaults when no widgets are registered for the node', () => {
    expect(readCameraInfoState(scope)).toEqual(DEFAULT_CAMERA_INFO_STATE)
  })

  it('reads each widget by name (orbit-mode example)', () => {
    registerValues(scope, {
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

    const state = readCameraInfoState(scope)

    expect(state.mode).toBe('orbit')
    expect(state.target).toEqual({ x: 1, y: 2, z: 3 })
    expect(state.roll).toBe(10)
    expect(state.fov).toBe(50)
    expect(state.zoom).toBe(0.8)
    expect(state.orbit).toEqual({ yaw: 25, pitch: 40, distance: 7 })
  })

  it('reads the orthographic camera type and quaternion-mode fields', () => {
    registerValues(scope, {
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

    const state = readCameraInfoState(scope)

    expect(state.cameraType).toBe('orthographic')
    expect(state.mode).toBe('quaternion')
    expect(state.quaternion.position).toEqual({ x: 1, y: 2, z: 3 })
    expect(state.quaternion.quat).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('falls back when a widget value has the wrong type', () => {
    registerValues(scope, {
      fov: 'not-a-number',
      mode: 'invalid-mode',
      camera_type: 42
    })

    const state = readCameraInfoState(scope)

    expect(state.fov).toBe(DEFAULT_CAMERA_INFO_STATE.fov)
    expect(state.mode).toBe(DEFAULT_CAMERA_INFO_STATE.mode)
    expect(state.cameraType).toBe(DEFAULT_CAMERA_INFO_STATE.cameraType)
  })

  it('rejects non-finite numbers (NaN / Infinity)', () => {
    registerValues(scope, {
      'mode.yaw': Number.NaN,
      'mode.distance': Number.POSITIVE_INFINITY
    })

    const state = readCameraInfoState(scope)

    expect(state.orbit.yaw).toBe(DEFAULT_CAMERA_INFO_STATE.orbit.yaw)
    expect(state.orbit.distance).toBe(DEFAULT_CAMERA_INFO_STATE.orbit.distance)
  })

  it('does not read a same-named widget from another node', () => {
    const other = makeScope()
    registerValues(other, { fov: 99 })

    expect(readCameraInfoState(scope).fov).toBe(DEFAULT_CAMERA_INFO_STATE.fov)
  })
})

describe('writeCameraInfoValue', () => {
  it('updates the named widget when the value differs', () => {
    registerValues(scope, { 'mode.yaw': 0 })

    writeCameraInfoValue(scope, 'mode.yaw', 45)

    expect(storedValue(scope, 'mode.yaw')).toBe(45)
  })

  it('is a no-op when the value already matches', () => {
    registerValues(scope, { fov: 35 })

    writeCameraInfoValue(scope, 'fov', 35)

    expect(storedValue(scope, 'fov')).toBe(35)
  })

  it('does not create state for an unregistered widget', () => {
    expect(() => writeCameraInfoValue(scope, 'does_not_exist', 1)).not.toThrow()
    expect(storedValue(scope, 'does_not_exist')).toBeUndefined()
  })
})
