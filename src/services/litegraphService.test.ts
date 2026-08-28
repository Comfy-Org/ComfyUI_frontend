import { createTestingPinia } from '@pinia/testing'
import { cloneDeep } from 'es-toolkit'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/app', () => ({
  app: { canvas: undefined },
  ComfyApp: class {}
}))

import { i18n, mergeCustomNodesI18n } from '@/i18n'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { useWidgetStore } from '@/stores/widgetStore'

const enMessages = cloneDeep(i18n.global.getLocaleMessage('en'))
const zhMessages = cloneDeep(i18n.global.getLocaleMessage('zh'))

describe('useLitegraphService().getCanvasCenter', () => {
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
    mergeCustomNodesI18n({
      en: {
        nodeDefs: {
          [nodeName]: {
            inputs: { mask: { name: 'Translated Mask Label' } }
          }
        }
      }
    })
    await useLitegraphService().registerNodeDef(nodeName, nodeDef)
  })

  afterEach(() => {
    LiteGraph.unregisterNodeType(nodeName)
    mergeCustomNodesI18n({})
    i18n.global.setLocaleMessage('en', cloneDeep(enMessages))
  })

  it('labels widgets, sockets and outputs from the live backend', () => {
    const node = LiteGraph.createNode(nodeName)
    const localizedName = (name: string) =>
      node?.inputs.find((input) => input.name === name)?.localized_name
    const mask = node?.inputs.find((input) => input.name === 'mask')

    expect(node?.widgets?.[0]?.label).toBe('Live Seed Label')
    expect(localizedName('seed')).toBe('Live Seed Label')
    expect(mask?.label || mask?.localized_name || mask?.name).toBe(
      'Translated Mask Label'
    )
    expect(node?.outputs[0]?.localized_name).toBe('Live Latent Name')
  })
})

describe('useLitegraphService().registerNodeDef slot text (non-en)', () => {
  const nodeName = 'TestNonEnSlotText'

  const nodeDef: ComfyNodeDefV1 = {
    name: nodeName,
    display_name: 'Test Non En Slot Text',
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

  beforeEach(async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    i18n.global.mergeLocaleMessage('en', {
      nodeDefs: {
        [nodeName]: {
          inputs: { seed: { name: 'stale en snapshot' } },
          outputs: { 0: { name: 'stale en snapshot' } }
        }
      }
    })
    i18n.global.mergeLocaleMessage('zh', {
      nodeDefs: { [nodeName]: { inputs: { mask: { name: '翻译遮罩' } } } }
    })
    i18n.global.locale.value = 'zh'
    await useLitegraphService().registerNodeDef(nodeName, nodeDef)
  })

  afterEach(() => {
    LiteGraph.unregisterNodeType(nodeName)
    i18n.global.locale.value = 'en'
    i18n.global.setLocaleMessage('zh', cloneDeep(zhMessages))
    i18n.global.setLocaleMessage('en', cloneDeep(enMessages))
  })

  it('prefers the translation over the live backend value', () => {
    const node = LiteGraph.createNode(nodeName)
    const mask = node?.inputs.find((input) => input.name === 'mask')

    expect(mask?.localized_name).toBe('翻译遮罩')
  })

  it('falls back to the live backend value, not the en snapshot', () => {
    const node = LiteGraph.createNode(nodeName)
    const seed = node?.inputs.find((input) => input.name === 'seed')

    expect(node?.widgets?.[0]?.label).toBe('Live Seed Label')
    expect(seed?.localized_name).toBe('Live Seed Label')
    expect(node?.outputs[0]?.localized_name).toBe('Live Latent Name')
  })
})

describe('useLitegraphService().registerNodeDef custom widget metadata', () => {
  const nodeName = 'TestFrozenCustomWidget'
  const widgetType = 'FROZEN_CUSTOM_WIDGET'
  let retainedWidget: IBaseWidget

  beforeEach(async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    useWidgetStore().registerCustomWidgets({
      [widgetType]: (node, inputName) => {
        retainedWidget = Object.preventExtensions({
          name: inputName,
          type: 'legacy_test',
          value: 0,
          options: {},
          y: 0
        })
        node.widgets ??= []
        node.widgets.push(retainedWidget)
        return { widget: retainedWidget }
      }
    })
    await useLitegraphService().registerNodeDef(nodeName, {
      name: nodeName,
      display_name: 'Test Frozen Custom Widget',
      category: 'testing',
      python_module: 'nodes',
      description: '',
      input: {
        required: {
          custom: [
            widgetType,
            {
              display_name: 'Live Custom Label',
              default: 0,
              advanced: true,
              hidden: true
            }
          ]
        }
      },
      output: [],
      output_name: [],
      output_node: false
    })
  })

  afterEach(() => {
    LiteGraph.unregisterNodeType(nodeName)
  })

  it('applies metadata to the concrete widget stored on the node', () => {
    const node = LiteGraph.createNode(nodeName)
    const widget = node?.widgets?.[0]

    expect(widget).not.toBe(retainedWidget)
    expect(widget?.label).toBe('Live Custom Label')
    expect(widget?.options.advanced).toBe(true)
    expect(widget?.options.hidden).toBe(true)
    expect(widget?.hidden).toBe(true)
  })
})

describe('useLitegraphService().addNodeOnGraph', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ createSpy: vi.fn }))
  })

  const nodeDef = {
    name: 'TestNode',
    display_name: 'Test Node'
  } as unknown as ComfyNodeDefV1

  it('does not create nodes in selection-only mode', () => {
    Reflect.set(app, 'canvas', { selectOnly: true })
    const createSpy = vi.spyOn(LiteGraph, 'createNode')

    const node = useLitegraphService().addNodeOnGraph(nodeDef, {
      pos: [0, 0]
    })

    // The choke point every creation surface traverses (search popover,
    // libraries, bookmarks, ghost-drops, job menu) refuses while picking.
    expect(node).toBeNull()
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('creates nodes when the canvas is editable', () => {
    Reflect.set(app, 'canvas', { selectOnly: false })
    const createSpy = vi
      .spyOn(LiteGraph, 'createNode')
      .mockReturnValue(null as never)

    const node = useLitegraphService().addNodeOnGraph(nodeDef, {
      pos: [0, 0]
    })

    expect(node).toBeNull()
    expect(createSpy).toHaveBeenCalledOnce()
  })
})
