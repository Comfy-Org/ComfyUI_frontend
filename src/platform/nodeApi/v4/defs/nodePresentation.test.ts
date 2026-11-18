import { TitleMode } from '@comfyorg/graph-model/globalEnums'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { DefRegistry, NodePresentation } from '@/platform/nodeApi/v4/types'

vi.mock(import('@/services/litegraphService'))

describe('a defined type’s presentation', () => {
  let graph: LGraph
  let defs: DefRegistry

  beforeEach(() => {
    graph = new LGraph()
    defs = createComfyApi({ getGraph: () => graph }).comfy.defs
  })

  function nodeOf(type: string, presentation?: NodePresentation): LGraphNode {
    defs.define({ type, presentation })
    const node = LiteGraph.createNode(type)
    assert(node)
    graph.add(node)
    return node
  }

  function shownToVueNodes(node: LGraphNode) {
    return useNodeDataStore()
      .getGraphNodesFor(graph.id, graph.id)
      .find((state) => state.id === node.id)
  }

  function bottomRightCorner(node: LGraphNode): [number, number] {
    node.setSize([200, 100])
    node.updateArea(createMockCanvasRenderingContext2D())
    const { right, bottom } = node.boundingRect
    return [right - 1, bottom - 1]
  }

  function canvasMenu(node: LGraphNode): unknown[] {
    const element = document.createElement('canvas')
    element.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    const canvas = new LGraphCanvas(element, graph, {
      skip_render: true,
      skip_events: true
    })
    return canvas
      .getNodeMenuOptions(node)
      .map((option) => option?.content)
      .filter(Boolean)
  }

  describe('title', () => {
    it('draws the nodes without a title bar in both renderers when hidden', () => {
      const node = nodeOf('Pack/Titleless', { title: 'hidden' })

      expect(node.title_mode).toBe(TitleMode.NO_TITLE)
      expect(shownToVueNodes(node)?.titleMode).toBe(TitleMode.NO_TITLE)
    })

    it.for([
      { name: 'by default', presentation: undefined },
      { name: 'when asked for', presentation: { title: 'default' } as const },
      { name: 'when other fields are given', presentation: {} }
    ])('draws the title bar $name', ({ presentation }) => {
      const node = nodeOf('Pack/Titled', presentation)

      expect(node.title_mode).toBe(TitleMode.NORMAL_TITLE)
      expect(shownToVueNodes(node)?.titleMode).toBe(TitleMode.NORMAL_TITLE)
    })
  })

  describe('collapsible', () => {
    it('stops the user collapsing the nodes when false, and leaves the menu without Collapse', () => {
      const node = nodeOf('Pack/Fixed', { collapsible: false })

      node.collapse()

      expect(node.collapsible).toBe(false)
      expect(node.collapsed).toBe(false)
      expect(canvasMenu(node)).not.toContain('Collapse')
    })

    it.for([
      { name: 'by default', presentation: undefined },
      { name: 'when true', presentation: { collapsible: true } }
    ])('lets the user collapse them $name', ({ presentation }) => {
      const node = nodeOf('Pack/Folding', presentation)

      expect(canvasMenu(node)).toContain('Collapse')
      node.collapse()

      expect(node.collapsed).toBe(true)
    })
  })

  describe('resizable', () => {
    it('stops the user resizing the nodes in both renderers when false', () => {
      const node = nodeOf('Pack/Rigid', { resizable: false })

      expect(node.resizable).toBe(false)
      expect(shownToVueNodes(node)?.resizable).toBe(false)
      expect(node.findResizeDirection(...bottomRightCorner(node))).toBe(
        undefined
      )
      expect(canvasMenu(node)).not.toContain('Resize')
    })

    it('lets the host’s unpin make a node resizable, and fixes it again on a load', () => {
      const node = nodeOf('Pack/Rigid', { resizable: false })

      node.pin(true)
      expect(node.resizable).toBe(false)
      node.pin(false)
      expect(node.resizable).toBe(true)

      graph.configure(graph.serialize())
      const loaded = graph.getNodeById(node.id)

      expect(loaded).not.toBe(node)
      expect(loaded?.resizable).toBe(false)
    })

    it.for([
      { name: 'by default', presentation: undefined },
      { name: 'when true', presentation: { resizable: true } }
    ])('lets the user resize them $name', ({ presentation }) => {
      const node = nodeOf('Pack/Elastic', presentation)

      expect(node.resizable).not.toBe(false)
      expect(shownToVueNodes(node)?.resizable).not.toBe(false)
      expect(node.findResizeDirection(...bottomRightCorner(node))).toBe('SE')
      expect(canvasMenu(node)).toContain('Resize')
    })
  })

  describe('refusals', () => {
    it.for([
      { name: 'a presentation that is not an object', presentation: 'none' },
      { name: 'a presentation that is null', presentation: null },
      { name: 'chrome, which no renderer can leave out', field: 'chrome' },
      { name: 'sizing, which no renderer holds fixed', field: 'sizing' },
      {
        name: 'pinnedInteraction, which no renderer passes through',
        field: 'pinnedInteraction'
      },
      { name: 'a title the host has no mode for', presentation: { title: 2 } },
      {
        name: 'a resizable that is not true or false',
        presentation: { resizable: 'no' }
      },
      {
        name: 'a collapsible that is not true or false',
        presentation: { collapsible: 0 }
      },
      { name: 'a field Object.prototype has', field: 'constructor' },
      { name: 'a title that is null', presentation: { title: null } },
      { name: 'a resizable that is null', presentation: { resizable: null } },
      {
        name: 'a collapsible that is null',
        presentation: { collapsible: null }
      }
    ])('refuses $name and registers nothing', ({ presentation, field }) => {
      const given = field ? { title: 'hidden', [field]: 'none' } : presentation
      const before = Object.keys(LiteGraph.registered_node_types)

      expect(() =>
        Reflect.apply(defs.define, defs, [
          { type: 'Pack/Refused', presentation: given }
        ])
      ).toThrow(TypeError)
      expect(Object.keys(LiteGraph.registered_node_types)).toEqual(before)
      expect(defs.has('Pack/Refused')).toBe(false)
    })

    it('says what a presentation needs when it refuses one', () => {
      expect(() =>
        Reflect.apply(defs.define, defs, [
          { type: 'Pack/Refused', presentation: { chrome: 'none' } }
        ])
      ).toThrow(
        /^define needs a presentation of title, resizable, collapsible only, not 'chrome'/
      )
      expect(() =>
        Reflect.apply(defs.define, defs, [
          { type: 'Pack/Refused', presentation: { title: 'none' } }
        ])
      ).toThrow(/^define needs presentation.title of default, hidden/)
      expect(() =>
        Reflect.apply(defs.define, defs, [
          { type: 'Pack/Refused', presentation: 'none' }
        ])
      ).toThrow(/^define needs a presentation object, not 'none'/)
      expect(() =>
        Reflect.apply(defs.define, defs, [
          { type: 'Pack/Refused', presentation: { collapsible: 'no' } }
        ])
      ).toThrow(/^define needs presentation.collapsible as true or false/)
    })
  })
})
