// oxlint-disable no-empty-pattern
// TODO: Fix these tests after migration
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, describe, expect, vi } from 'vitest'

import type {
  LGraph,
  Reroute,
  CanvasPointerEvent,
  RerouteId
} from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LLink, LinkConnector } from '@/lib/litegraph/src/litegraph'

import { slotFloatingLinks } from '../LLink'
import { test as baseTest } from '../__fixtures__/testExtensions'
import type { ConnectingLink } from '@/lib/litegraph/src/interfaces'
import { toLinkId } from '@/types/linkId'
import { UNASSIGNED_NODE_ID, toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'
import {
  createMockCanvasPointerEvent,
  createMockCanvasRenderingContext2D
} from '@/utils/__tests__/litegraphTestUtils'

interface TestContext {
  pinia: undefined
  graph: LGraph
  connector: LinkConnector
  setConnectingLinks: (value: ConnectingLink[]) => void
  createTestNode: (id: number) => LGraphNode
  reroutesBeforeTest: [rerouteId: RerouteId, reroute: Reroute][]
  validateIntegrityNoChanges: () => void
  validateIntegrityFloatingRemoved: () => void
  validateLinkIntegrity: () => void
  getNextLinkIds: (
    linkIds: ReadonlySet<number>,
    expectedExtraLinks?: number
  ) => number[]
  readonly floatingReroute: Reroute
}

const test = baseTest.extend<TestContext>({
  pinia: [
    async ({}, use) => {
      setActivePinia(createTestingPinia({ stubActions: false }))
      await use(undefined)
    },
    { auto: true }
  ],

  reroutesBeforeTest: async ({ reroutesComplexGraph }, use) => {
    await use([...reroutesComplexGraph.reroutes])
  },

  graph: async ({ reroutesComplexGraph }, use) => {
    const mockCtx = createMockCanvasRenderingContext2D()
    for (const node of reroutesComplexGraph.nodes) {
      node.updateArea(mockCtx)
    }
    await use(reroutesComplexGraph)
  },
  setConnectingLinks: async (
    {},
    use: (mock: (value: ConnectingLink[]) => void) => Promise<void>
  ) => {
    const mock = vi.fn()
    await use(mock)
  },
  connector: async ({ setConnectingLinks }, use) => {
    const connector = new LinkConnector(setConnectingLinks)
    await use(connector)
  },
  createTestNode: async ({ graph }, use) => {
    await use((id): LGraphNode => {
      const node = new LGraphNode('test')
      node.id = toNodeId(id)
      graph.add(node)
      return node
    })
  },

  validateIntegrityNoChanges: async ({ graph, reroutesBeforeTest }, use) => {
    await use(() => {
      expect(graph.floatingLinks.size).toBe(1)
      expect([...graph.reroutes]).toEqual(reroutesBeforeTest)

      // Only the original reroute should be floating
      const reroutesExceptOne = [...graph.reroutes.values()].filter(
        (reroute) => reroute.id !== 1
      )
      for (const reroute of reroutesExceptOne) {
        expect(reroute.floating).toBeUndefined()
      }
    })
  },

  validateIntegrityFloatingRemoved: async (
    { graph, reroutesBeforeTest },
    use
  ) => {
    await use(() => {
      expect(graph.floatingLinks.size).toBe(0)
      expect([...graph.reroutes]).toEqual(reroutesBeforeTest)

      for (const reroute of graph.reroutes.values()) {
        expect(reroute.floating).toBeUndefined()
      }
    })
  },

  validateLinkIntegrity: async ({ graph }, use) => {
    await use(() => {
      for (const reroute of graph.reroutes.values()) {
        if (reroute.origin_id === undefined) {
          expect(reroute.linkIds.size).toBe(0)
          expect(reroute.floatingLinkIds.size).toBeGreaterThan(0)
        }

        for (const linkId of reroute.linkIds) {
          const link = graph.links.get(linkId)
          expect(link).toBeDefined()
          expect(link!.origin_id).toEqual(reroute.origin_id)
          expect(link!.origin_slot).toEqual(reroute.origin_slot)
        }
        for (const linkId of reroute.floatingLinkIds) {
          const link = graph.floatingLinks.get(linkId)
          expect(link).toBeDefined()

          if (link!.target_id === UNASSIGNED_NODE_ID) {
            expect(link!.origin_id).not.toBe(UNASSIGNED_NODE_ID)
            expect(link!.origin_slot).not.toBe(-1)
            expect(link!.target_slot).toBe(-1)
          } else {
            expect(link!.origin_id).toBe(UNASSIGNED_NODE_ID)
            expect(link!.origin_slot).toBe(-1)
            expect(link!.target_slot).not.toBe(-1)
          }
        }
      }

      // Check that all link references are valid (Can be found in the graph)
      for (const node of graph.nodes.values()) {
        for (const input of node.inputs) {
          if (input.link) {
            expect(graph.links.keys()).toContain(input.link)
            expect(graph.links.get(input.link)?.target_id).toBe(node.id)
          }
        }
        for (const output of node.outputs) {
          for (const linkId of output.links ?? []) {
            expect(graph.links.keys()).toContain(linkId)
            expect(graph.links.get(linkId)?.origin_id).toBe(node.id)
          }
        }
      }

      for (const link of graph._links.values()) {
        expect(
          graph.getNodeById(link!.origin_id)?.outputs[link!.origin_slot].links
        ).toContain(link.id)
        expect(
          graph.getNodeById(link!.target_id)?.inputs[link!.target_slot].link
        ).toBe(link.id)
      }

      for (const link of graph.floatingLinks.values()) {
        if (link.target_id === UNASSIGNED_NODE_ID) {
          expect(link.origin_id).not.toBe(UNASSIGNED_NODE_ID)
          expect(link.origin_slot).not.toBe(-1)
          expect(link.target_slot).toBe(-1)
          const outputFloatingLinks = slotFloatingLinks(
            graph,
            'output',
            link.origin_id,
            link.origin_slot
          )
          expect(outputFloatingLinks).toContain(link)
        } else {
          expect(link.origin_id).toBe(UNASSIGNED_NODE_ID)
          expect(link.origin_slot).toBe(-1)
          expect(link.target_slot).not.toBe(-1)
          const inputFloatingLinks = slotFloatingLinks(
            graph,
            'input',
            link.target_id,
            link.target_slot
          )
          expect(inputFloatingLinks).toContain(link)
        }
      }
    })
  },

  getNextLinkIds: async ({ graph }, use) => {
    await use((linkIds, expectedExtraLinks = 0) => {
      const indexes = [...new Array(linkIds.size + expectedExtraLinks).keys()]
      return indexes.map((index) => graph.last_link_id + index + 1)
    })
  },

  floatingReroute: async ({ graph }, use) => {
    const floatingReroute = graph.reroutes.get(toRerouteId(1))!
    expect(floatingReroute.floating).toEqual({ slotType: 'output' })
    await use(floatingReroute)
  }
})

function mockedNodeTitleDropEvent(node: LGraphNode): CanvasPointerEvent {
  return createMockCanvasPointerEvent(
    node.pos[0] + node.size[0] / 2,
    node.pos[1] + 16
  )
}

function mockedInputDropEvent(
  node: LGraphNode,
  slot: number
): CanvasPointerEvent {
  const pos = node.getInputPos(slot)
  return createMockCanvasPointerEvent(pos[0], pos[1])
}

function mockedOutputDropEvent(
  node: LGraphNode,
  slot: number
): CanvasPointerEvent {
  const pos = node.getOutputPos(slot)
  return createMockCanvasPointerEvent(pos[0], pos[1])
}

describe('LinkConnector Integration', () => {
  afterEach<TestContext>(({ validateLinkIntegrity }) => {
    validateLinkIntegrity()
  })

  describe('Moving input links', () => {
    test('Should move input links', ({ graph, connector }) => {
      const nextLinkId = graph.last_link_id + 1

      const hasInputNode = graph.getNodeById(toNodeId(2))!
      const disconnectedNode = graph.getNodeById(toNodeId(9))!

      const reroutesBefore = LLink.getReroutes(
        graph,
        graph.links.get(hasInputNode.inputs[0].link!)!
      )

      connector.moveInputLink(graph, hasInputNode, hasInputNode.inputs[0])
      expect(connector.state.connectingTo).toBe('input')
      expect(connector.state.draggingExistingLinks).toBe(true)
      expect(connector.renderLinks.length).toBe(1)
      expect(connector.inputLinks.length).toBe(1)

      const canvasX = disconnectedNode.pos[0] + disconnectedNode.size[0] / 2
      const canvasY = disconnectedNode.pos[1] + 16
      const dropEvent = createMockCanvasPointerEvent(canvasX, canvasY)

      // Drop links, ensure reset has not been run
      connector.dropLinks(graph, dropEvent)
      expect(connector.renderLinks.length).toBe(1)

      // Test reset
      connector.reset()
      expect(connector.renderLinks.length).toBe(0)
      expect(connector.inputLinks.length).toBe(0)

      expect(disconnectedNode.inputs[0].link).toBe(nextLinkId)
      expect(hasInputNode.inputs[0].link).toBeNull()

      const reroutesAfter = LLink.getReroutes(
        graph,
        graph.links.get(disconnectedNode.inputs[0].link!)!
      )
      expect(reroutesAfter).toEqual(reroutesBefore)
    })

    test('Should connect from floating reroutes', ({
      graph,
      connector,
      reroutesBeforeTest
    }) => {
      const nextLinkId = graph.last_link_id + 1

      const floatingLink = graph.floatingLinks.values().next().value!
      expect(floatingLink).toBeInstanceOf(LLink)
      const floatingReroute = graph.reroutes.get(floatingLink.parentId!)!

      const disconnectedNode = graph.getNodeById(toNodeId(9))!
      connector.dragFromReroute(graph, floatingReroute)

      expect(connector.state.connectingTo).toBe('input')
      expect(connector.state.draggingExistingLinks).toBe(false)
      expect(connector.renderLinks.length).toBe(1)
      expect(connector.inputLinks.length).toBe(0)

      const canvasX = disconnectedNode.pos[0] + disconnectedNode.size[0] / 2
      const canvasY = disconnectedNode.pos[1] + 16
      const dropEvent = createMockCanvasPointerEvent(canvasX, canvasY)

      connector.dropLinks(graph, dropEvent)
      connector.reset()
      expect(connector.renderLinks.length).toBe(0)
      expect(connector.inputLinks.length).toBe(0)

      // New link should have been created
      expect(disconnectedNode.inputs[0].link).toBe(nextLinkId)

      // Check graph integrity
      expect(graph.floatingLinks.size).toBe(0)
      expect([...graph.reroutes]).toEqual(reroutesBeforeTest)

      // All reroute floating property should be cleared
      for (const reroute of graph.reroutes.values()) {
        expect(reroute.floating).toBeUndefined()
      }
    })

    test('Should drop floating links when both sides are disconnected', ({
      graph,
      reroutesBeforeTest
    }) => {
      expect(graph.floatingLinks.size).toBe(1)

      const floatingOutNode = graph.getNodeById(toNodeId(1))!
      floatingOutNode.disconnectOutput(0)

      // Should have lost one reroute
      expect(graph.reroutes.size).toBe(reroutesBeforeTest.length - 1)
      expect(graph.reroutes.get(toRerouteId(1))).toBeUndefined()

      // The two normal links should now be floating
      expect(graph.floatingLinks.size).toBe(2)

      graph.getNodeById(toNodeId(2))!.disconnectInput(0, true)
      expect(graph.floatingLinks.size).toBe(1)

      graph.getNodeById(toNodeId(3))!.disconnectInput(0, false)
      expect(graph.floatingLinks.size).toBe(0)

      // Removed 4 reroutes
      expect(graph.reroutes.size).toBe(9)

      // All four nodes should have no links
      for (const nodeId of [1, 2, 3, 9]) {
        const {
          inputs: [input],
          outputs: [output]
        } = graph.getNodeById(toNodeId(nodeId))!

        expect(input.link).toBeNull()

        expect([0, undefined]).toContain(output.links?.length)

        expect(
          slotFloatingLinks(graph, 'input', toNodeId(nodeId), 0)
        ).toHaveLength(0)

        expect(
          slotFloatingLinks(graph, 'output', toNodeId(nodeId), 0)
        ).toHaveLength(0)
      }
    })

    test('Should prevent node loopback when dropping on node', ({
      graph,
      connector
    }) => {
      const hasOutputNode = graph.getNodeById(toNodeId(1))!
      const hasInputNode = graph.getNodeById(toNodeId(2))!
      const hasInputNode2 = graph.getNodeById(toNodeId(3))!

      const reroutesBefore = LLink.getReroutes(
        graph,
        graph.links.get(hasInputNode.inputs[0].link!)!
      )

      const atOutputNodeEvent = mockedNodeTitleDropEvent(hasOutputNode)

      connector.moveInputLink(graph, hasInputNode, hasInputNode.inputs[0])
      connector.dropLinks(graph, atOutputNodeEvent)
      connector.reset()

      const outputNodes = hasOutputNode.getOutputNodes(0)
      expect(outputNodes).toEqual([hasInputNode, hasInputNode2])

      const reroutesAfter = LLink.getReroutes(
        graph,
        graph.links.get(hasInputNode.inputs[0].link!)!
      )
      expect(reroutesAfter).toEqual(reroutesBefore)
    })

    test('Should prevent node loopback when dropping on input', ({
      graph,
      connector
    }) => {
      const hasOutputNode = graph.getNodeById(toNodeId(1))!
      const hasInputNode = graph.getNodeById(toNodeId(2))!

      const originalOutputNodes = hasOutputNode.getOutputNodes(0)
      const reroutesBefore = LLink.getReroutes(
        graph,
        graph.links.get(hasInputNode.inputs[0].link!)!
      )

      const atHasOutputNode = mockedInputDropEvent(hasOutputNode, 0)

      connector.moveInputLink(graph, hasInputNode, hasInputNode.inputs[0])
      connector.dropLinks(graph, atHasOutputNode)
      connector.reset()

      const outputNodes = hasOutputNode.getOutputNodes(0)
      expect(outputNodes).toEqual(originalOutputNodes)

      const reroutesAfter = LLink.getReroutes(
        graph,
        graph.links.get(hasInputNode.inputs[0].link!)!
      )
      expect(reroutesAfter).toEqual(reroutesBefore)
    })
  })

  describe('Moving output links', () => {
    test('Should move output links', ({ graph, connector }) => {
      const nextLinkIds = [graph.last_link_id + 1, graph.last_link_id + 2]

      const hasOutputNode = graph.getNodeById(toNodeId(1))!
      const disconnectedNode = graph.getNodeById(toNodeId(9))!

      const reroutesBefore = hasOutputNode.outputs[0].links
        ?.map((linkId) => graph.links.get(linkId)!)
        .map((link) => LLink.getReroutes(graph, link))

      connector.moveOutputLink(graph, hasOutputNode, hasOutputNode.outputs[0])
      expect(connector.state.connectingTo).toBe('output')
      expect(connector.state.draggingExistingLinks).toBe(true)
      expect(connector.renderLinks.length).toBe(3)
      expect(connector.outputLinks.length).toBe(2)
      expect(connector.floatingLinks.length).toBe(1)

      const canvasX = disconnectedNode.pos[0] + disconnectedNode.size[0] / 2
      const canvasY = disconnectedNode.pos[1] + 16
      const dropEvent = createMockCanvasPointerEvent(canvasX, canvasY)

      connector.dropLinks(graph, dropEvent)
      connector.reset()
      expect(connector.renderLinks.length).toBe(0)
      expect(connector.outputLinks.length).toBe(0)

      expect(disconnectedNode.outputs[0].links).toEqual(nextLinkIds)
      expect(hasOutputNode.outputs[0].links).toBeNull()

      const reroutesAfter = disconnectedNode.outputs[0].links
        ?.map((linkId) => graph.links.get(linkId)!)
        .map((link) => LLink.getReroutes(graph, link))

      expect(reroutesAfter).toEqual(reroutesBefore)
    })

    test('Should connect to floating reroutes from outputs', ({
      graph,
      connector,
      reroutesBeforeTest
    }) => {
      const nextLinkIds = [graph.last_link_id + 1, graph.last_link_id + 2]

      const floatingOutNode = graph.getNodeById(toNodeId(1))!
      floatingOutNode.disconnectOutput(0)

      // Should have lost one reroute
      expect(graph.reroutes.size).toBe(reroutesBeforeTest.length - 1)
      expect(graph.reroutes.get(toRerouteId(1))).toBeUndefined()

      // The two normal links should now be floating
      expect(graph.floatingLinks.size).toBe(2)

      const disconnectedNode = graph.getNodeById(toNodeId(9))!
      connector.dragNewFromOutput(
        graph,
        disconnectedNode,
        disconnectedNode.outputs[0]
      )

      expect(connector.state.connectingTo).toBe('input')
      expect(connector.state.draggingExistingLinks).toBe(false)
      expect(connector.renderLinks.length).toBe(1)
      expect(connector.outputLinks.length).toBe(0)
      expect(connector.floatingLinks.length).toBe(0)

      const floatingLink = graph.floatingLinks.values().next().value!
      expect(floatingLink).toBeInstanceOf(LLink)
      const floatingReroute = LLink.getReroutes(graph, floatingLink)[0]

      const dropEvent = createMockCanvasPointerEvent(
        floatingReroute.pos[0],
        floatingReroute.pos[1]
      )

      connector.dropLinks(graph, dropEvent)
      connector.reset()
      expect(connector.renderLinks.length).toBe(0)
      expect(connector.outputLinks.length).toBe(0)

      // New link should have been created
      expect(disconnectedNode.outputs[0].links).toEqual(nextLinkIds)

      // Check graph integrity
      expect(graph.floatingLinks.size).toBe(0)
      expect([...graph.reroutes]).toEqual(reroutesBeforeTest.slice(1))

      for (const reroute of graph.reroutes.values()) {
        expect(reroute.floating).toBeUndefined()
      }
    })

    test('Should drop floating links when both sides are disconnected', ({
      graph,
      reroutesBeforeTest
    }) => {
      expect(graph.floatingLinks.size).toBe(1)

      graph.getNodeById(toNodeId(2))!.disconnectInput(0, true)
      expect(graph.floatingLinks.size).toBe(1)

      // Only the original reroute should be floating
      const reroutesExceptOne = [...graph.reroutes.values()].filter(
        (reroute) => reroute.id !== 1
      )
      for (const reroute of reroutesExceptOne) {
        expect(reroute.floating).toBeUndefined()
      }

      graph.getNodeById(toNodeId(3))!.disconnectInput(0, true)
      expect([...graph.reroutes]).toEqual(reroutesBeforeTest)

      // The normal link should now be floating
      expect(graph.floatingLinks.size).toBe(2)
      expect(graph.reroutes.get(toRerouteId(3))!.floating).toEqual({
        slotType: 'output'
      })

      const floatingOutNode = graph.getNodeById(toNodeId(1))!
      floatingOutNode.disconnectOutput(0)

      // Should have lost one reroute
      expect(graph.reroutes.size).toBe(9)
      expect(graph.reroutes.get(toRerouteId(1))).toBeUndefined()

      // Removed 4 reroutes
      expect(graph.reroutes.size).toBe(9)

      // All four nodes should have no links
      for (const nodeId of [1, 2, 3, 9]) {
        const {
          inputs: [input],
          outputs: [output]
        } = graph.getNodeById(toNodeId(nodeId))!

        expect(input.link).toBeNull()

        expect([0, undefined]).toContain(output.links?.length)

        expect(
          slotFloatingLinks(graph, 'input', toNodeId(nodeId), 0)
        ).toHaveLength(0)

        expect(
          slotFloatingLinks(graph, 'output', toNodeId(nodeId), 0)
        ).toHaveLength(0)
      }
    })

    test('Should support moving multiple output links to a floating reroute', ({
      graph,
      connector,
      floatingReroute,
      validateIntegrityFloatingRemoved
    }) => {
      const manyOutputsNode = graph.getNodeById(toNodeId(4))!
      const canvasX = floatingReroute.pos[0]
      const canvasY = floatingReroute.pos[1]
      const floatingRerouteEvent = createMockCanvasPointerEvent(
        canvasX,
        canvasY
      )

      connector.moveOutputLink(
        graph,
        manyOutputsNode,
        manyOutputsNode.outputs[0]
      )
      connector.dropLinks(graph, floatingRerouteEvent)
      connector.reset()

      expect(manyOutputsNode.outputs[0].links).toBeNull()
      expect(floatingReroute.linkIds.size).toBe(4)

      validateIntegrityFloatingRemoved()
    })

    test('Should prevent dragging from an output to a child reroute', ({
      graph,
      connector,
      floatingReroute
    }) => {
      const manyOutputsNode = graph.getNodeById(toNodeId(4))!

      const reroute7 = graph.reroutes.get(toRerouteId(7))!
      const reroute10 = graph.reroutes.get(toRerouteId(10))!
      const reroute13 = graph.reroutes.get(toRerouteId(13))!

      const canvasX = reroute7.pos[0]
      const canvasY = reroute7.pos[1]
      const reroute7Event = createMockCanvasPointerEvent(canvasX, canvasY)

      const toSortedRerouteChain = (linkIds: readonly number[]) =>
        linkIds
          .map((x) => graph.links.get(toLinkId(x))!)
          .map((x) => LLink.getReroutes(graph, x))
          .sort((a, b) => a.at(-1)!.id - b.at(-1)!.id)

      const reroutesBefore = toSortedRerouteChain(
        manyOutputsNode.outputs[0].links!
      )

      connector.moveOutputLink(
        graph,
        manyOutputsNode,
        manyOutputsNode.outputs[0]
      )
      expect(connector.isRerouteValidDrop(reroute7)).toBe(false)
      expect(connector.isRerouteValidDrop(reroute10)).toBe(false)
      expect(connector.isRerouteValidDrop(reroute13)).toBe(false)

      // Prevent link disconnect when dropped on canvas (just for this test)
      connector.events.addEventListener(
        'dropped-on-canvas',
        (e) => e.preventDefault(),
        { once: true }
      )
      connector.dropLinks(graph, reroute7Event)
      connector.reset()

      const reroutesAfter = toSortedRerouteChain(
        manyOutputsNode.outputs[0].links!
      )
      expect(reroutesAfter).toEqual(reroutesBefore)

      expect(graph.floatingLinks.size).toBe(1)
      expect(floatingReroute.linkIds.size).toBe(0)
    })

    test('Should prevent node loopback when dropping on node', ({
      graph,
      connector
    }) => {
      const hasOutputNode = graph.getNodeById(toNodeId(1))!
      const hasInputNode = graph.getNodeById(toNodeId(2))!

      const reroutesBefore = LLink.getReroutes(
        graph,
        graph.links.get(hasOutputNode.outputs[0].links![0])!
      )

      const atInputNodeEvent = mockedNodeTitleDropEvent(hasInputNode)

      connector.moveOutputLink(graph, hasOutputNode, hasOutputNode.outputs[0])
      connector.dropLinks(graph, atInputNodeEvent)
      connector.reset()

      expect(hasOutputNode.getOutputNodes(0)).toEqual([hasInputNode])
      expect(hasInputNode.getOutputNodes(0)).toEqual([
        graph.getNodeById(toNodeId(3))
      ])

      // Moved link should have the same reroutes
      const reroutesAfter = LLink.getReroutes(
        graph,
        graph.links.get(hasInputNode.outputs[0].links![0])!
      )
      expect(reroutesAfter).toEqual(reroutesBefore)

      // Link recreated to avoid loopback should have no reroutes
      const reroutesAfter2 = LLink.getReroutes(
        graph,
        graph.links.get(hasOutputNode.outputs[0].links![0])!
      )
      expect(reroutesAfter2).toEqual([])
    })

    test('Should prevent node loopback when dropping on output', ({
      graph,
      connector
    }) => {
      const hasOutputNode = graph.getNodeById(toNodeId(1))!
      const hasInputNode = graph.getNodeById(toNodeId(2))!

      const reroutesBefore = LLink.getReroutes(
        graph,
        graph.links.get(hasOutputNode.outputs[0].links![0])!
      )

      const atInputNodeOutSlot = mockedOutputDropEvent(hasInputNode, 0)

      connector.moveOutputLink(graph, hasOutputNode, hasOutputNode.outputs[0])
      connector.dropLinks(graph, atInputNodeOutSlot)
      connector.reset()

      expect(hasOutputNode.getOutputNodes(0)).toEqual([hasInputNode])
      expect(hasInputNode.getOutputNodes(0)).toEqual([
        graph.getNodeById(toNodeId(3))
      ])

      // Moved link should have the same reroutes
      const reroutesAfter = LLink.getReroutes(
        graph,
        graph.links.get(hasInputNode.outputs[0].links![0])!
      )
      expect(reroutesAfter).toEqual(reroutesBefore)

      // Link recreated to avoid loopback should have no reroutes
      const reroutesAfter2 = LLink.getReroutes(
        graph,
        graph.links.get(hasOutputNode.outputs[0].links![0])!
      )
      expect(reroutesAfter2).toEqual([])
    })
  })

  describe('Floating links', () => {
    test('Removed when connecting from reroute to input', ({
      graph,
      connector,
      floatingReroute
    }) => {
      const disconnectedNode = graph.getNodeById(toNodeId(9))!
      const canvasX = disconnectedNode.pos[0]
      const canvasY = disconnectedNode.pos[1]

      connector.dragFromReroute(graph, floatingReroute)
      connector.dropLinks(graph, createMockCanvasPointerEvent(canvasX, canvasY))
      connector.reset()

      expect(graph.floatingLinks.size).toBe(0)
      expect(floatingReroute.floating).toBeUndefined()
    })

    test('Removed when connecting from reroute to another reroute', ({
      graph,
      connector,
      floatingReroute,
      validateIntegrityFloatingRemoved
    }) => {
      const reroute8 = graph.reroutes.get(toRerouteId(8))!
      const canvasX = reroute8.pos[0]
      const canvasY = reroute8.pos[1]

      connector.dragFromReroute(graph, floatingReroute)
      connector.dropLinks(graph, createMockCanvasPointerEvent(canvasX, canvasY))
      connector.reset()

      expect(graph.floatingLinks.size).toBe(0)
      expect(floatingReroute.floating).toBeUndefined()
      expect(reroute8.floating).toBeUndefined()

      validateIntegrityFloatingRemoved()
    })

    test('Dropping a floating input link onto input slot disconnects the existing link', ({
      graph,
      connector
    }) => {
      const manyOutputsNode = graph.getNodeById(toNodeId(4))!
      manyOutputsNode.disconnectOutput(0)

      const floatingInputNode = graph.getNodeById(toNodeId(6))!
      const fromFloatingInput = floatingInputNode.inputs[0]

      const hasInputNode = graph.getNodeById(toNodeId(2))!
      const toInput = hasInputNode.inputs[0]

      connector.moveInputLink(graph, floatingInputNode, fromFloatingInput)
      const dropEvent = mockedInputDropEvent(hasInputNode, 0)
      connector.dropLinks(graph, dropEvent)
      connector.reset()

      expect(fromFloatingInput.link).toBeNull()
      expect(
        slotFloatingLinks(graph, 'input', floatingInputNode.id, 0)
      ).toHaveLength(0)

      expect(toInput.link).toBeNull()
      expect(
        slotFloatingLinks(graph, 'input', hasInputNode.id, 0)
      ).toHaveLength(1)
    })

    test('Allow reroutes to be used as manual switches', ({
      graph,
      connector,
      floatingReroute,
      validateIntegrityNoChanges
    }) => {
      const rerouteWithTwoLinks = graph.reroutes.get(toRerouteId(3))!
      const targetNode = graph.getNodeById(toNodeId(2))!

      const targetDropEvent = mockedInputDropEvent(targetNode, 0)

      connector.dragFromReroute(graph, floatingReroute)
      connector.dropLinks(graph, targetDropEvent)
      connector.reset()

      // Link should have been moved to the floating reroute, and no floating links should remain
      expect(rerouteWithTwoLinks.floating).toBeUndefined()
      expect(floatingReroute.floating).toBeUndefined()
      expect(rerouteWithTwoLinks.floatingLinkIds.size).toBe(0)
      expect(floatingReroute.floatingLinkIds.size).toBe(0)
      expect(rerouteWithTwoLinks.linkIds.size).toBe(1)
      expect(floatingReroute.linkIds.size).toBe(1)

      // Move the link again
      connector.dragFromReroute(graph, rerouteWithTwoLinks)
      connector.dropLinks(graph, targetDropEvent)
      connector.reset()

      // Everything should be back the way it was when we started
      expect(rerouteWithTwoLinks.floating).toBeUndefined()
      expect(floatingReroute.floating).toEqual({ slotType: 'output' })
      expect(rerouteWithTwoLinks.floatingLinkIds.size).toBe(0)
      expect(floatingReroute.floatingLinkIds.size).toBe(1)
      expect(rerouteWithTwoLinks.linkIds.size).toBe(2)
      expect(floatingReroute.linkIds.size).toBe(0)

      validateIntegrityNoChanges()
    })
  })

  test('Should drop floating links when both sides are disconnected', ({
    graph,
    connector,
    reroutesBeforeTest,
    validateIntegrityNoChanges
  }) => {
    const floatingOutNode = graph.getNodeById(toNodeId(1))!
    connector.moveOutputLink(graph, floatingOutNode, floatingOutNode.outputs[0])

    const manyOutputsNode = graph.getNodeById(toNodeId(4))!
    const dropEvent = createMockCanvasPointerEvent(
      manyOutputsNode.pos[0],
      manyOutputsNode.pos[1]
    )
    connector.dropLinks(graph, dropEvent)
    connector.reset()

    const output = manyOutputsNode.outputs[0]
    expect(output.links!.length).toBe(6)
    expect(
      slotFloatingLinks(graph, 'output', manyOutputsNode.id, 0)
    ).toHaveLength(1)

    validateIntegrityNoChanges()

    // Move again
    connector.moveOutputLink(graph, manyOutputsNode, manyOutputsNode.outputs[0])

    const disconnectedNode = graph.getNodeById(toNodeId(9))!
    const dropEvent2 = createMockCanvasPointerEvent(
      disconnectedNode.pos[0],
      disconnectedNode.pos[1]
    )
    connector.dropLinks(graph, dropEvent2)
    connector.reset()

    const newOutput = disconnectedNode.outputs[0]
    expect(newOutput.links!.length).toBe(6)
    expect(
      slotFloatingLinks(graph, 'output', disconnectedNode.id, 0)
    ).toHaveLength(1)

    validateIntegrityNoChanges()

    disconnectedNode.disconnectOutput(0)

    expect(
      slotFloatingLinks(graph, 'output', disconnectedNode.id, 0)
    ).toHaveLength(0)
    expect(graph.floatingLinks.size).toBe(6)

    // The final reroutes should all be floating
    for (const reroute of graph.reroutes.values()) {
      if ([3, 7, 15, 12].includes(reroute.id)) {
        expect(reroute.floating).toEqual({ slotType: 'input' })
      } else {
        expect(reroute.floating).toBeUndefined()
      }
    }

    // Removed one reroute
    expect(graph.reroutes.size).toBe(reroutesBeforeTest.length - 1)

    // Original nodes should have no links
    for (const nodeId of [1, 4]) {
      const {
        inputs: [input],
        outputs: [output]
      } = graph.getNodeById(toNodeId(nodeId))!

      expect(input.link).toBeNull()

      expect([0, undefined]).toContain(output.links?.length)

      expect(
        slotFloatingLinks(graph, 'input', toNodeId(nodeId), 0)
      ).toHaveLength(0)

      expect(
        slotFloatingLinks(graph, 'output', toNodeId(nodeId), 0)
      ).toHaveLength(0)
    }
  })

  type TestData = {
    /** Drop link on this reroute */
    targetRerouteId: number
    /** Parent reroutes of the target reroute */
    parentIds: number[]
    /** Number of links before the drop */
    linksBefore: number[]
    /** Number of links after the drop */
    linksAfter: (number | undefined)[]
    /** Whether to run the integrity check */
    runIntegrityCheck: boolean
  }

  test.for<TestData>([
    {
      targetRerouteId: 8,
      parentIds: [13, 10],
      linksBefore: [3, 4],
      linksAfter: [1, 2],
      runIntegrityCheck: true
    },
    {
      targetRerouteId: 7,
      parentIds: [6, 8, 13, 10],
      linksBefore: [2, 2, 3, 4],
      linksAfter: [undefined, undefined, 1, 2],
      runIntegrityCheck: false
    },
    {
      targetRerouteId: 6,
      parentIds: [8, 13, 10],
      linksBefore: [2, 3, 4],
      linksAfter: [undefined, 1, 2],
      runIntegrityCheck: false
    },
    {
      targetRerouteId: 13,
      parentIds: [10],
      linksBefore: [4],
      linksAfter: [1],
      runIntegrityCheck: true
    },
    {
      targetRerouteId: 4,
      parentIds: [],
      linksBefore: [],
      linksAfter: [],
      runIntegrityCheck: true
    },
    {
      targetRerouteId: 2,
      parentIds: [4],
      linksBefore: [2],
      linksAfter: [undefined],
      runIntegrityCheck: false
    },
    {
      targetRerouteId: 3,
      parentIds: [2, 4],
      linksBefore: [2, 2],
      linksAfter: [0, 0],
      runIntegrityCheck: true
    }
  ])(
    'Should allow reconnect from output to any reroute',
    (
      {
        targetRerouteId,
        parentIds,
        linksBefore,
        linksAfter,
        runIntegrityCheck
      },
      { graph, connector, validateIntegrityNoChanges, getNextLinkIds }
    ) => {
      const linkCreatedCallback = vi.fn()
      connector.listenUntilReset('link-created', linkCreatedCallback)

      const disconnectedNode = graph.getNodeById(toNodeId(9))!

      // Parent reroutes of the target reroute
      for (const [index, parentId] of parentIds.entries()) {
        const reroute = graph.reroutes.get(toRerouteId(parentId))!
        expect(reroute.linkIds.size).toBe(linksBefore[index])
      }

      const targetReroute = graph.reroutes.get(toRerouteId(targetRerouteId))!
      const nextLinkIds = getNextLinkIds(targetReroute.linkIds)
      const dropEvent = createMockCanvasPointerEvent(
        targetReroute.pos[0],
        targetReroute.pos[1]
      )

      connector.dragNewFromOutput(
        graph,
        disconnectedNode,
        disconnectedNode.outputs[0]
      )
      connector.dropLinks(graph, dropEvent)
      connector.reset()

      expect(disconnectedNode.outputs[0].links).toEqual(nextLinkIds)
      expect([...targetReroute.linkIds.values()]).toEqual(nextLinkIds)

      // Parent reroutes should have lost the links or been removed
      for (const [index, parentId] of parentIds.entries()) {
        const reroute = graph.reroutes.get(toRerouteId(parentId))!
        if (linksAfter[index] === undefined) {
          expect(reroute).not.toBeUndefined()
        } else {
          expect(reroute.linkIds.size).toBe(linksAfter[index])
        }
      }

      expect(linkCreatedCallback).toHaveBeenCalledTimes(nextLinkIds.length)

      if (runIntegrityCheck) {
        validateIntegrityNoChanges()
      }
    }
  )

  type ReconnectTestData = {
    /** Drag link from this reroute */
    fromRerouteId: number
    /** Drop link on this reroute */
    targetRerouteId: number
    /** Reroute IDs that should be removed from the resultant reroute chain */
    shouldBeRemoved: number[]
    /** Reroutes that should have NONE of the link IDs that targetReroute has */
    shouldHaveLinkIdsRemoved: number[]
    /** Whether to test floating inputs */
    testFloatingInputs?: true
    /** Number of expected extra links to be created */
    expectedExtraLinks?: number
  }

  test.for<ReconnectTestData>([
    {
      fromRerouteId: 10,
      targetRerouteId: 15,
      shouldBeRemoved: [14],
      shouldHaveLinkIdsRemoved: [13, 8, 6, 7]
    },
    {
      fromRerouteId: 8,
      targetRerouteId: 2,
      shouldBeRemoved: [4],
      shouldHaveLinkIdsRemoved: []
    },
    {
      fromRerouteId: 3,
      targetRerouteId: 12,
      shouldBeRemoved: [11],
      shouldHaveLinkIdsRemoved: [10, 13, 14, 15, 8, 6, 7]
    },
    {
      fromRerouteId: 15,
      targetRerouteId: 7,
      shouldBeRemoved: [8, 6],
      shouldHaveLinkIdsRemoved: []
    },
    {
      fromRerouteId: 1,
      targetRerouteId: 7,
      shouldBeRemoved: [8, 6],
      shouldHaveLinkIdsRemoved: []
    },
    {
      fromRerouteId: 1,
      targetRerouteId: 10,
      shouldBeRemoved: [],
      shouldHaveLinkIdsRemoved: []
    },
    {
      fromRerouteId: 4,
      targetRerouteId: 8,
      shouldBeRemoved: [],
      shouldHaveLinkIdsRemoved: [],
      testFloatingInputs: true,
      expectedExtraLinks: 2
    },
    {
      fromRerouteId: 2,
      targetRerouteId: 12,
      shouldBeRemoved: [11],
      shouldHaveLinkIdsRemoved: [],
      testFloatingInputs: true,
      expectedExtraLinks: 1
    }
  ])(
    'Should allow connecting from reroutes to another reroute',
    (
      {
        fromRerouteId,
        targetRerouteId,
        shouldBeRemoved,
        shouldHaveLinkIdsRemoved,
        testFloatingInputs,
        expectedExtraLinks
      },
      { graph, connector, getNextLinkIds }
    ) => {
      if (testFloatingInputs) {
        // Start by disconnecting the output of the 3x3 array of reroutes
        graph.getNodeById(toNodeId(4))!.disconnectOutput(0)
      }

      const fromReroute = graph.reroutes.get(toRerouteId(fromRerouteId))!
      const targetReroute = graph.reroutes.get(toRerouteId(targetRerouteId))!
      const nextLinkIds = getNextLinkIds(
        targetReroute.linkIds,
        expectedExtraLinks
      )

      const originalParentChain = LLink.getReroutes(graph, targetReroute)

      const sortAndJoin = (numbers: Iterable<number>) =>
        // oxlint-disable-next-line require-array-sort-compare
        [...numbers].sort().join(',')
      const hasIdenticalLinks = (a: Reroute, b: Reroute) =>
        sortAndJoin(a.linkIds) === sortAndJoin(b.linkIds) &&
        sortAndJoin(a.floatingLinkIds) === sortAndJoin(b.floatingLinkIds)

      // Sanity check shouldBeRemoved
      const reroutesWithIdenticalLinkIds = originalParentChain.filter(
        (parent) => hasIdenticalLinks(parent, targetReroute)
      )
      expect(reroutesWithIdenticalLinkIds.map((reroute) => reroute.id)).toEqual(
        shouldBeRemoved
      )

      connector.dragFromReroute(graph, fromReroute)

      const dropEvent = createMockCanvasPointerEvent(
        targetReroute.pos[0],
        targetReroute.pos[1]
      )
      connector.dropLinks(graph, dropEvent)
      connector.reset()

      const newParentChain = LLink.getReroutes(graph, targetReroute)
      for (const rerouteId of shouldBeRemoved) {
        expect(originalParentChain.map((reroute) => reroute.id)).toContain(
          rerouteId
        )
        expect(newParentChain.map((reroute) => reroute.id)).not.toContain(
          rerouteId
        )
      }

      expect([...targetReroute.linkIds.values()]).toEqual(nextLinkIds)

      for (const rerouteId of shouldBeRemoved) {
        const reroute = graph.reroutes.get(toRerouteId(rerouteId))!
        if (testFloatingInputs) {
          // Already-floating reroutes should be removed
          expect(reroute).toBeUndefined()
        } else {
          // Non-floating reroutes should still exist
          expect(reroute).not.toBeUndefined()
        }
      }

      for (const rerouteId of shouldHaveLinkIdsRemoved) {
        const reroute = graph.reroutes.get(toRerouteId(rerouteId))!
        for (const linkId of targetReroute.linkIds) {
          expect(reroute.linkIds).not.toContain(linkId)
        }
      }

      // Validate all links in a reroute share the same origin
      for (const reroute of graph.reroutes.values()) {
        for (const linkId of reroute.linkIds) {
          const link = graph.links.get(linkId)
          expect(link?.origin_id).toEqual(reroute.origin_id)
          expect(link?.origin_slot).toEqual(reroute.origin_slot)
        }
        for (const linkId of reroute.floatingLinkIds) {
          if (reroute.origin_id === undefined) continue

          const link = graph.floatingLinks.get(linkId)
          expect(link?.origin_id).toEqual(reroute.origin_id)
          expect(link?.origin_slot).toEqual(reroute.origin_slot)
        }
      }
    }
  )

  test.for([
    { from: 8, to: 13 },
    { from: 7, to: 13 },
    { from: 6, to: 13 },
    { from: 13, to: 10 },
    { from: 14, to: 10 },
    { from: 15, to: 10 },
    { from: 14, to: 13 },
    { from: 10, to: 10 }
  ])(
    'Connecting reroutes to invalid targets should do nothing',
    ({ from, to }, { graph, connector, validateIntegrityNoChanges }) => {
      const listener = vi.fn()
      connector.listenUntilReset('link-created', listener)

      const fromReroute = graph.reroutes.get(toRerouteId(from))!
      const toReroute = graph.reroutes.get(toRerouteId(to))!

      const dropEvent = createMockCanvasPointerEvent(
        toReroute.pos[0],
        toReroute.pos[1]
      )

      connector.dragFromReroute(graph, fromReroute)
      connector.dropLinks(graph, dropEvent)
      connector.reset()

      expect(listener).not.toHaveBeenCalled()
      validateIntegrityNoChanges()
    }
  )

  const nodeReroutePairs = [
    { nodeId: toNodeId(1), rerouteId: toRerouteId(1) },
    { nodeId: toNodeId(1), rerouteId: toRerouteId(3) },
    { nodeId: toNodeId(1), rerouteId: toRerouteId(4) },
    { nodeId: toNodeId(1), rerouteId: toRerouteId(2) },
    { nodeId: toNodeId(4), rerouteId: toRerouteId(7) },
    { nodeId: toNodeId(4), rerouteId: toRerouteId(6) },
    { nodeId: toNodeId(4), rerouteId: toRerouteId(8) },
    { nodeId: toNodeId(4), rerouteId: toRerouteId(10) },
    { nodeId: toNodeId(4), rerouteId: toRerouteId(12) }
  ]
  test.for(nodeReroutePairs)(
    'Should ignore connections from input to same node via reroutes',
    (
      { nodeId, rerouteId },
      { graph, connector, validateIntegrityNoChanges }
    ) => {
      const listener = vi.fn()
      connector.listenUntilReset('link-created', listener)

      const node = graph.getNodeById(nodeId)!
      const input = node.inputs[0]
      const reroute = graph.getReroute(rerouteId)!
      const dropEvent = createMockCanvasPointerEvent(
        reroute.pos[0],
        reroute.pos[1]
      )

      connector.dragNewFromInput(graph, node, input)
      connector.dropLinks(graph, dropEvent)
      connector.reset()

      expect(listener).not.toHaveBeenCalled()
      validateIntegrityNoChanges()

      // No links should have the same origin_id and target_id
      for (const link of graph.links.values()) {
        expect(link.origin_id).not.toEqual(link.target_id)
      }
    }
  )

  test.for(nodeReroutePairs)(
    'Should ignore connections looping back to the origin node from a reroute',
    (
      { nodeId, rerouteId },
      { graph, connector, validateIntegrityNoChanges }
    ) => {
      const listener = vi.fn()
      connector.listenUntilReset('link-created', listener)

      const node = graph.getNodeById(nodeId)!
      const reroute = graph.getReroute(rerouteId)!
      const dropEvent = createMockCanvasPointerEvent(node.pos[0], node.pos[1])

      connector.dragFromReroute(graph, reroute)
      connector.dropLinks(graph, dropEvent)
      connector.reset()

      expect(listener).not.toHaveBeenCalled()
      validateIntegrityNoChanges()

      // No links should have the same origin_id and target_id
      for (const link of graph.links.values()) {
        expect(link.origin_id).not.toEqual(link.target_id)
      }
    }
  )

  test.for(nodeReroutePairs)(
    'Should ignore connections looping back to the origin node input from a reroute',
    (
      { nodeId, rerouteId },
      { graph, connector, validateIntegrityNoChanges }
    ) => {
      const listener = vi.fn()
      connector.listenUntilReset('link-created', listener)

      const node = graph.getNodeById(nodeId)!
      const reroute = graph.getReroute(rerouteId)!
      const inputPos = node.getInputPos(0)
      const dropOnInputEvent = createMockCanvasPointerEvent(
        inputPos[0],
        inputPos[1]
      )

      connector.dragFromReroute(graph, reroute)
      connector.dropLinks(graph, dropOnInputEvent)
      connector.reset()

      expect(listener).not.toHaveBeenCalled()
      validateIntegrityNoChanges()

      // No links should have the same origin_id and target_id
      for (const link of graph.links.values()) {
        expect(link.origin_id).not.toEqual(link.target_id)
      }
    }
  )
})
