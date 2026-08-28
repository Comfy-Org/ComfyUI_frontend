import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CanvasPointerEvent,
  IContextMenuOptions,
  IContextMenuValue,
  LGraphCanvas
} from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { LLink } from '@/lib/litegraph/src/LLink'
import { toLinkId } from '@/types/linkId'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import {
  createMockCanvas2DContext,
  createTestCanvas,
  createTestLink
} from '@/utils/__tests__/litegraphTestUtils'

type MenuValue = string | IContextMenuValue<string> | null

function createLinkedNodes(graph: LGraph): LLink {
  const source = new LGraphNode('Source')
  source.addOutput('out', 'MODEL')
  graph.add(source)
  const target = new LGraphNode('Target')
  target.addInput('in', 'MODEL')
  graph.add(target)
  return createTestLink(graph, source, 0, target, 0)
}

describe('LGraphCanvas link visibility interactions', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let link: LLink
  let originalContextMenu: typeof LiteGraph.ContextMenu
  let menuValues: readonly MenuValue[] = []
  let menuOptions: IContextMenuOptions<string> = {}

  beforeEach(() => {
    menuValues = []
    menuOptions = {}
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    canvas = createTestCanvas(
      graph,
      createMockCanvas2DContext({
        measureText: vi.fn().mockReturnValue({ width: 50 }),
        getTransform: vi
          .fn()
          .mockReturnValue({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
      })
    )
    link = createLinkedNodes(graph)
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
  })

  const event = fromPartial<CanvasPointerEvent>({ canvasX: 10, canvasY: 20 })

  it('adds hide and show actions while omitting reroutes for hidden links', () => {
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
    void menuOptions.callback?.('Show Link')
    expect(link.hidden).toBeFalsy()
  })

  it('does not add visibility actions for a floating link', () => {
    const floating = new LLink(
      toLinkId(99),
      'MODEL',
      link.origin_id,
      0,
      UNASSIGNED_NODE_ID,
      -1
    )
    graph.addFloatingLink(floating)
    floating.hidden = true

    canvas.showLinkMenu(floating, event)

    expect(menuValues).toEqual([
      'Add Node',
      'Add Reroute',
      null,
      'Delete',
      null
    ])
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
    prompt.mock.calls[0][2]('Backbone')
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
