import { describe, expect, it } from 'vitest'

import type { WidgetState } from '@/stores/widgetValueStore'

import { WidgetContainerComponent } from './components/WidgetContainer'
import { WidgetValueComponent } from './components/WidgetValue'
import { asGraphId, nodeEntityId, widgetEntityId } from './entityIds'
import { createWorld } from './world'
import { worldIndex } from './worldIndex'
import {
  getNodeWidgetsThroughWorld,
  registerWidgetInWorld,
  unregisterWidgetInWorld
} from './widgetWorldBridge'

function makeState(nodeId: string, name: string, value: unknown): WidgetState {
  return { nodeId, name, type: 'number', value, options: {} }
}

const graphId = asGraphId('00000000-0000-0000-0000-000000000001')

describe('registerWidgetInWorld', () => {
  it('writes WidgetValue and updates WidgetContainer on the node', () => {
    const world = createWorld()
    const state = makeState('node-1', 'seed', 100)

    registerWidgetInWorld(world, graphId, state)

    const widgetId = widgetEntityId(graphId, 'node-1', 'seed')
    const nodeId = nodeEntityId(graphId, 'node-1')
    expect(world.getComponent(widgetId, WidgetValueComponent)?.value).toBe(100)
    expect(
      world.getComponent(nodeId, WidgetContainerComponent)?.widgetIds
    ).toEqual([widgetId])
  })

  it('shares object identity with the registered state (reactive bridge)', () => {
    const world = createWorld()
    const state = makeState('node-1', 'seed', 100)
    registerWidgetInWorld(world, graphId, state)

    state.value = 200
    const widgetId = widgetEntityId(graphId, 'node-1', 'seed')
    expect(world.getComponent(widgetId, WidgetValueComponent)?.value).toBe(200)
  })

  it('appends additional widgets to the same node container', () => {
    const world = createWorld()
    registerWidgetInWorld(world, graphId, makeState('node-1', 'seed', 1))
    registerWidgetInWorld(world, graphId, makeState('node-1', 'cfg', 7))

    const nodeId = nodeEntityId(graphId, 'node-1')
    const ids = world.getComponent(nodeId, WidgetContainerComponent)?.widgetIds
    expect(ids).toEqual([
      widgetEntityId(graphId, 'node-1', 'seed'),
      widgetEntityId(graphId, 'node-1', 'cfg')
    ])
  })

  it('does not duplicate widgetIds when the same widget re-registers', () => {
    const world = createWorld()
    const state = makeState('node-1', 'seed', 1)
    registerWidgetInWorld(world, graphId, state)
    registerWidgetInWorld(world, graphId, state)

    const nodeId = nodeEntityId(graphId, 'node-1')
    expect(
      world.getComponent(nodeId, WidgetContainerComponent)?.widgetIds
    ).toHaveLength(1)
  })
})

describe('unregisterWidgetInWorld', () => {
  it('removes the widget value and updates the container', () => {
    const world = createWorld()
    registerWidgetInWorld(world, graphId, makeState('node-1', 'seed', 1))
    registerWidgetInWorld(world, graphId, makeState('node-1', 'cfg', 7))

    unregisterWidgetInWorld(world, graphId, 'node-1', 'seed')

    expect(
      world.getComponent(
        widgetEntityId(graphId, 'node-1', 'seed'),
        WidgetValueComponent
      )
    ).toBeUndefined()
    const nodeId = nodeEntityId(graphId, 'node-1')
    expect(
      world.getComponent(nodeId, WidgetContainerComponent)?.widgetIds
    ).toEqual([widgetEntityId(graphId, 'node-1', 'cfg')])
  })
})

describe('getNodeWidgetsThroughWorld', () => {
  it('returns all widget states attached to a node', () => {
    const world = createWorld()
    registerWidgetInWorld(world, graphId, makeState('node-1', 'seed', 1))
    registerWidgetInWorld(world, graphId, makeState('node-1', 'cfg', 7))
    registerWidgetInWorld(world, graphId, makeState('node-2', 'seed', 99))

    const widgets = getNodeWidgetsThroughWorld(world, graphId, 'node-1')
    expect(widgets.map((w) => w.name).sort()).toEqual(['cfg', 'seed'])
  })

  it('returns an empty array for unknown nodes', () => {
    const world = createWorld()
    expect(getNodeWidgetsThroughWorld(world, graphId, 'missing')).toEqual([])
  })
})

describe('worldIndex.widgetParent', () => {
  it('returns the owning node entity for a widget', () => {
    const world = createWorld()
    registerWidgetInWorld(world, graphId, makeState('node-1', 'seed', 1))
    const widgetId = widgetEntityId(graphId, 'node-1', 'seed')
    expect(worldIndex.widgetParent(world, widgetId)).toBe(
      nodeEntityId(graphId, 'node-1')
    )
  })

  it('returns undefined when no container references the widget', () => {
    const world = createWorld()
    const widgetId = widgetEntityId(graphId, 'orphan', 'seed')
    expect(worldIndex.widgetParent(world, widgetId)).toBeUndefined()
  })
})
