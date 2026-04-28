import { describe, expect, it } from 'vitest'

import type { WidgetState } from '@/stores/widgetValueStore'
import { asGraphId, nodeEntityId, widgetEntityId } from '@/world/entityIds'
import { createWorld } from '@/world/world'

import type { WidgetValue } from './widgetComponents'
import {
  WidgetContainerComponent,
  WidgetValueComponent,
  widgetParent
} from './widgetComponents'

const graphId = asGraphId('00000000-0000-0000-0000-000000000001')

function makeState(nodeId: string, name: string, value: unknown): WidgetState {
  return { nodeId, name, type: 'number', value, options: {} }
}

describe('widgetParent', () => {
  it('returns the owning node entity for a widget', () => {
    const world = createWorld()
    const state = makeState('node-1', 'seed', 1)
    const widgetId = widgetEntityId(graphId, state.nodeId, state.name)
    const ownerId = nodeEntityId(graphId, state.nodeId)
    world.setComponent(widgetId, WidgetValueComponent, state as WidgetValue)
    world.setComponent(ownerId, WidgetContainerComponent, {
      widgetIds: [widgetId]
    })
    expect(widgetParent(world, widgetId)).toBe(ownerId)
  })

  it('returns undefined when no container references the widget', () => {
    const world = createWorld()
    const widgetId = widgetEntityId(graphId, 'orphan', 'seed')
    expect(widgetParent(world, widgetId)).toBeUndefined()
  })
})
