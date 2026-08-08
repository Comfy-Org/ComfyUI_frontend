import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/app', () => ({
  app: { canvas: undefined },
  ComfyApp: class {}
}))

import { i18n } from '@/i18n'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
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

describe('useLitegraphService().registerNodeDef slot text', () => {
  const nodeName = 'TestBackendSlotText'

  const nodeDef: ComfyNodeDefV1 = {
    name: nodeName,
    display_name: 'Test Backend Slot Text',
    category: 'testing',
    python_module: 'nodes',
    description: '',
    input: {
      required: {
        seed: ['INT', { display_name: 'Live Seed Label', default: 0 }],
        mask: ['MASK', { display_name: 'Live Mask Label' }]
      }
    },
    output: ['LATENT'],
    output_name: ['Live Latent Name'],
    output_node: false
  }

  function mergeBundledSlotText(text: string | null) {
    i18n.global.mergeLocaleMessage('en', {
      nodeDefs: {
        [nodeName]: {
          inputs: { seed: { name: text }, mask: { name: text } },
          outputs: { 0: { name: text } }
        }
      }
    })
  }

  beforeEach(async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mergeBundledSlotText('stale bundled label')
    await useLitegraphService().registerNodeDef(nodeName, nodeDef)
  })

  afterEach(() => {
    mergeBundledSlotText(null)
  })

  it('labels widgets, sockets and outputs from the live backend', () => {
    const node = LiteGraph.createNode(nodeName)
    const localizedName = (name: string) =>
      node?.inputs.find((input) => input.name === name)?.localized_name

    expect(node?.widgets?.[0]?.label).toBe('Live Seed Label')
    expect(localizedName('seed')).toBe('Live Seed Label')
    expect(localizedName('mask')).toBe('Live Mask Label')
    expect(node?.outputs[0]?.localized_name).toBe('Live Latent Name')
  })
})
