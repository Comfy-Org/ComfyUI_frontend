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

const distribution = vi.hoisted(() => ({ cloud: false }))

vi.mock('@/platform/distribution/types', async (importOriginal) => ({
  ...(await importOriginal()),
  get isCloud() {
    return distribution.cloud
  }
}))

const enMessages = cloneDeep(i18n.global.getLocaleMessage('en'))
const zhMessages = cloneDeep(i18n.global.getLocaleMessage('zh'))

describe('Cloud palette visibility is independent of graph construction', () => {
  const name = 'TestCloudPaletteNode'
  const definition: ComfyNodeDefV1 = {
    name,
    display_name: name,
    description: '',
    category: 'testing',
    python_module: 'custom_nodes.cloud_registry.exact',
    output_node: false,
    input: {},
    output: ['STRING'],
    comfy_cloud_palette_visible: false
  }

  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))
  afterEach(() => LiteGraph.unregisterNodeType(name))

  it('loads an unpinned node into a graph without putting it in the context menu', async () => {
    await useLitegraphService().registerNodeDef(name, definition)
    expect(LiteGraph.registered_node_types[name].skip_list).toBe(true)
    expect(LiteGraph.createNode(name)?.type).toBe(name)
    expect(
      LiteGraph.getNodeTypesInCategory('testing')
        .filter((node) => !node.skip_list)
        .some((node) => node.type === name)
    ).toBe(false)
    await useLitegraphService().registerNodeDef(name, {
      ...definition,
      comfy_cloud_palette_visible: true
    })
    expect(LiteGraph.registered_node_types[name].skip_list).toBe(false)
    expect(
      LiteGraph.getNodeTypesInCategory('testing')
        .filter((node) => !node.skip_list)
        .some((node) => node.type === name)
    ).toBe(true)
    await useLitegraphService().registerNodeDef(name, definition)
    expect(LiteGraph.createNode(name)?.type).toBe(name)
    expect(LiteGraph.registered_node_types[name].skip_list).toBe(true)
  })
})

describe('Cloud custom-node outline in the classic canvas', () => {
  const name = 'TestCloudOutlineNode'
  const definition: ComfyNodeDefV1 = {
    name,
    display_name: name,
    description: '',
    category: 'testing',
    python_module: 'custom_nodes.cloud_registry.exact',
    output_node: false,
    input: {},
    output: ['STRING'],
    comfy_cloud_palette_visible: false
  }

  beforeEach(() => {
    distribution.cloud = true
    setActivePinia(createTestingPinia({ stubActions: false }))
    document.documentElement.style.setProperty('--secure-outline', '#b8813a')
  })

  afterEach(() => {
    distribution.cloud = false
    document.documentElement.style.removeProperty('--secure-outline')
    LiteGraph.unregisterNodeType(name)
  })

  it('outlines a custom node even when its pack is unpinned', async () => {
    await useLitegraphService().registerNodeDef(name, definition)
    const node = LiteGraph.createNode(name)!
    const outline = node.strokeStyles.cloudCustom

    expect(outline?.call(node)).toEqual({
      color: '#b8813a',
      lineWidth: 2,
      padding: 1
    })
    expect(LiteGraph.registered_node_types[name].skip_list).toBe(true)
  })

  it.for([
    'nodes',
    'comfy_extras.demo',
    'comfy_api_nodes.demo',
    'blueprint.demo',
    ''
  ])(
    'does not outline a core, blueprint or unknown node from %s',
    async (python_module) => {
      await useLitegraphService().registerNodeDef(name, {
        ...definition,
        python_module
      })
      const node = LiteGraph.createNode(name)!

      expect(node.strokeStyles.cloudCustom?.call(node)).toBeUndefined()
    }
  )

  it('does not change local custom-node styling', async () => {
    distribution.cloud = false
    await useLitegraphService().registerNodeDef(name, definition)
    const node = LiteGraph.createNode(name)!

    expect(node.strokeStyles.cloudCustom?.call(node)).toBeUndefined()
  })

  it('follows the existing theme token without changing node colors or flags', async () => {
    await useLitegraphService().registerNodeDef(name, definition)
    const node = LiteGraph.createNode(name)!
    node.color = '#334455'
    node.bgcolor = '#223344'
    node.flags.collapsed = true

    document.documentElement.style.setProperty('--secure-outline', '#cf9648')

    expect(node.strokeStyles.cloudCustom?.call(node)?.color).toBe('#cf9648')
    expect(node.color).toBe('#334455')
    expect(node.bgcolor).toBe('#223344')
    expect(node.flags.collapsed).toBe(true)
  })

  it('uses the canvas theme when it differs from the document theme', async () => {
    const canvas = document.createElement('canvas')
    canvas.style.setProperty('--secure-outline', '#cf9648')
    document.body.append(canvas)
    Reflect.set(app, 'canvas', { canvas })

    try {
      await useLitegraphService().registerNodeDef(name, definition)
      const node = LiteGraph.createNode(name)!

      expect(node.strokeStyles.cloudCustom?.call(node)?.color).toBe('#cf9648')
      canvas.style.setProperty('--secure-outline', '#b8813a')
      expect(node.strokeStyles.cloudCustom?.call(node)?.color).toBe('#b8813a')
    } finally {
      canvas.remove()
      Reflect.set(app, 'canvas', undefined)
    }
  })

  it('retains distinct error and selection strokes alongside the custom-node accent', async () => {
    await useLitegraphService().registerNodeDef(name, definition)
    const node = LiteGraph.createNode(name)!
    node.has_errors = true
    node.selected = true

    expect(node.strokeStyles.cloudCustom?.call(node)).toEqual({
      color: '#b8813a',
      lineWidth: 2,
      padding: 1
    })
    expect(node.strokeStyles.error.call(node)).toEqual({
      color: LiteGraph.NODE_ERROR_COLOUR,
      lineWidth: 10,
      padding: 12
    })
    expect(node.strokeStyles.selected.call(node)?.padding).toBe(20)
  })
})

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
