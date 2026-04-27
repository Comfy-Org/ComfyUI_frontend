import { describe, expect, it } from 'vitest'

import type { WidgetState } from '@/stores/widgetValueStore'
import { asGraphId, nodeEntityId, widgetEntityId } from '@/world/entityIds'
import { registerWidgetInWorld } from '@/world/widgetWorldBridge'
import { createWorld } from '@/world/world'

import { widgetParent } from './widgetComponents'

const graphId = asGraphId('00000000-0000-0000-0000-000000000001')

function makeState(nodeId: string, name: string, value: unknown): WidgetState {
  return { nodeId, name, type: 'number', value, options: {} }
}

describe('widgetParent', () => {
  it('returns the owning node entity for a widget', () => {
    const world = createWorld()
    registerWidgetInWorld(world, graphId, makeState('node-1', 'seed', 1))
    const widgetId = widgetEntityId(graphId, 'node-1', 'seed')
    expect(widgetParent(world, widgetId)).toBe(nodeEntityId(graphId, 'node-1'))
  })

  it('returns undefined when no container references the widget', () => {
    const world = createWorld()
    const widgetId = widgetEntityId(graphId, 'orphan', 'seed')
    expect(widgetParent(world, widgetId)).toBeUndefined()
  })
})
