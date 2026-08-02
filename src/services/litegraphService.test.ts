import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/app', () => ({
  app: { canvas: undefined },
  ComfyApp: class {}
}))

import { app } from '@/scripts/app'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'

describe('useLitegraphService().getCanvasCenter', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('returns origin when canvas is not yet initialised', () => {
    Reflect.set(app, 'canvas', undefined)

    const center = useLitegraphService().getCanvasCenter()

    expect(center).toEqual([0, 0])
  })

  it('returns origin when canvas exists but ds.visible_area is missing', () => {
    Reflect.set(app, 'canvas', { ds: {} })

    const center = useLitegraphService().getCanvasCenter()

    expect(center).toEqual([0, 0])
  })

  it('returns the visible-area centre once the canvas is ready', () => {
    Reflect.set(app, 'canvas', {
      ds: { visible_area: [10, 20, 200, 100] }
    })

    const center = useLitegraphService().getCanvasCenter()

    expect(center).toEqual([110, 70])
  })
})

describe('useLitegraphService().registerNodeDef', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('hides disabled nodes from LiteGraph discovery', async () => {
    const nodeDef: ComfyNodeDef = {
      name: 'DisabledTestNode',
      display_name: 'Disabled Test Node',
      category: 'test',
      python_module: 'test',
      description: '',
      input: {},
      output: [],
      output_node: false,
      disabled: {
        reasons: [{ type: 'workspace_provider_disabled' }]
      }
    }

    await useLitegraphService().registerNodeDef(nodeDef.name, nodeDef)

    expect(LiteGraph.registered_node_types[nodeDef.name].skip_list).toBe(true)
    LiteGraph.unregisterNodeType(nodeDef.name)
  })
})
