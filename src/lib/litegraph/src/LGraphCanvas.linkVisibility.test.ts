import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CanvasPointerEvent,
  IContextMenuOptions,
  IContextMenuValue
} from '@/lib/litegraph/src/litegraph'
import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { LLink } from '@/lib/litegraph/src/LLink'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { toLinkId } from '@/types/linkId'
import { createMockCanvas2DContext } from '@/utils/__tests__/litegraphTestUtils'

type MenuValue = string | IContextMenuValue<string> | null

function createCanvas(graph: LGraph): LGraphCanvas {
  const element = document.createElement('canvas')
  element.width = 800
  element.height = 600
  element.getContext = vi.fn().mockReturnValue(
    createMockCanvas2DContext({
      measureText: vi.fn().mockReturnValue({ width: 50 }),
      getTransform: vi
        .fn()
        .mockReturnValue({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
    })
  )
  element.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 600
  })
  return new LGraphCanvas(element, graph, { skip_render: true })
}

function createLink(graph: LGraph): LLink {
  const source = new LGraphNode('Source')
  source.addOutput('out', 'MODEL')
  graph.add(source)
  const target = new LGraphNode('Target')
  target.addInput('in', 'MODEL')
  graph.add(target)
  const link = new LLink(toLinkId(1), 'MODEL', source.id, 0, target.id, 0)
  graph.links.set(link.id, link)
  source.outputs[0].links = [link.id]
  target.inputs[0].link = link.id
  return link
}

describe('LGraphCanvas link visibility interactions', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let link: LLink
  let originalContextMenu: typeof LiteGraph.ContextMenu
  let menuValues: readonly MenuValue[] = []
  let menuOptions: IContextMenuOptions<string> = {}

  beforeEach(() => {
    setActivePinia(createTestingPinia())
    graph = new LGraph()
    canvas = createCanvas(graph)
    link = createLink(graph)
    originalContextMenu = LiteGraph.ContextMenu
    const MockContextMenu = fromPartial<typeof LiteGraph.ContextMenu>(
      class {
        constructor(
          values: readonly MenuValue[],
          options: IContextMenuOptions<string>
        ) {
          menuValues = values
          menuOptions = options
        }
      }
    )
    LiteGraph.ContextMenu = MockContextMenu
  })

  afterEach(() => {
    LiteGraph.ContextMenu = originalContextMenu
    vi.restoreAllMocks()
  })

  const event = fromPartial<CanvasPointerEvent>({ canvasX: 10, canvasY: 20 })

  it('adds hide and show actions while omitting reroutes for hidden links', () => {
    const beforeChange = vi.spyOn(canvas, 'emitBeforeChange')
    const afterChange = vi.spyOn(canvas, 'emitAfterChange')
    const setDirty = vi.spyOn(canvas, 'setDirty')

    canvas.showLinkMenu(link, event)

    expect(menuValues).toEqual([
      'Hide Link',
      null,
      'Add Node',
      'Add Reroute',
      null,
      'Delete',
      null
    ])
    void menuOptions.callback?.('Hide Link')
    expect(link.hidden).toBe(true)
    expect(beforeChange).toHaveBeenCalledOnce()
    expect(setDirty).toHaveBeenCalledWith(false, true)
    expect(afterChange).toHaveBeenCalledOnce()

    canvas.showLinkMenu(link, event)

    expect(menuValues).toEqual([
      'Rename',
      'Show Link',
      null,
      'Add Node',
      null,
      'Delete',
      null
    ])
    expect(menuValues).not.toContain('Add Reroute')
    void menuOptions.callback?.('Show Link')
    expect(link.hidden).toBe(false)
  })

  it('opens the seeded rename prompt from the hidden-link menu', () => {
    link.hidden = true
    link.label = 'Checkpoint'
    const prompt = vi
      .spyOn(canvas, 'prompt')
      .mockReturnValue(document.createElement('div'))

    canvas.showLinkMenu(link, event)
    void menuOptions.callback?.('Rename')

    expect(prompt).toHaveBeenCalledWith(
      'Rename',
      'Checkpoint',
      expect.any(Function),
      event
    )
    prompt.mock.calls[0][2]('  Backbone  ')
    expect(link.label).toBe('Backbone')
  })

  it('routes a visible curve right-click to the link menu', () => {
    canvas.renderedPaths.add(link)
    vi.spyOn(layoutStore, 'queryRerouteAtPoint').mockReturnValue(null)
    vi.spyOn(layoutStore, 'queryLinkSegmentAtPoint').mockReturnValue({
      linkId: link.id,
      rerouteId: null
    })
    const showLinkMenu = vi.spyOn(canvas, 'showLinkMenu').mockReturnValue(false)

    canvas.processContextMenu(undefined, event)

    expect(showLinkMenu).toHaveBeenCalledWith(link, event)
  })
})
