// oxlint-disable no-empty-pattern
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { test as baseTest, beforeEach, describe, expect, vi } from 'vitest'

import type {
  MovingInputLink,
  RerouteId,
  LinkNetwork,
  ISlotType
} from '@/lib/litegraph/src/litegraph'
import {
  LGraph,
  LGraphNode,
  LLink,
  Reroute,
  LinkConnector,
  ToInputRenderLink,
  LinkDirection
} from '@/lib/litegraph/src/litegraph'
import type { ConnectingLink } from '@/lib/litegraph/src/interfaces'
import type { LinkId } from '@/types/linkId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'
import {
  createMockNodeInputSlot,
  createMockNodeOutputSlot
} from '@/utils/__tests__/litegraphTestUtils'

import { registerLinkTopology } from '../LLink'
import { registerRerouteChain } from '../Reroute'

interface TestContext {
  network: LinkNetwork & { add(node: LGraphNode): void; rootGraph: LGraph }
  connector: LinkConnector
  setConnectingLinks: (value: ConnectingLink[]) => void
  createTestNode: (id: number, slotType?: ISlotType) => LGraphNode
  createTestLink: (
    id: number,
    sourceId: number,
    targetId: number,
    slotType?: ISlotType
  ) => LLink
}

beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

const test = baseTest.extend<TestContext>({
  network: async ({}, use) => {
    const graph = new LGraph()
    const floatingLinks = new Map<LinkId, LLink>()
    const reroutes = new Map<RerouteId, Reroute>()

    await use({
      links: new Map<LinkId, LLink>(),
      reroutes,
      floatingLinks,
      getLink: graph.getLink.bind(graph),
      getNodeById: (id) => graph.getNodeById(id),
      addFloatingLink: (link: LLink) => {
        floatingLinks.set(link.id, link)
        return link
      },
      removeFloatingLink: (link: LLink) => floatingLinks.delete(link.id),
      getReroute: ((id: RerouteId | null | undefined) =>
        id == null ? undefined : reroutes.get(id)) as LinkNetwork['getReroute'],
      removeReroute: (id: RerouteId) => reroutes.delete(id),
      _removeReroute: (id: RerouteId) => void reroutes.delete(id),
      add: (node: LGraphNode) => graph.add(node),
      rootGraph: graph
    })
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

  createTestNode: async ({ network }, use) => {
    await use((id: number): LGraphNode => {
      const node = new LGraphNode('test')
      node.id = toNodeId(id)
      network.add(node)
      return node
    })
  },
  createTestLink: async ({ network }, use) => {
    await use(
      (
        id: number,
        sourceId: number,
        targetId: number,
        slotType: ISlotType = 'number'
      ): LLink => {
        const link = new LLink(toLinkId(id), slotType, sourceId, 0, targetId, 0)
        network.links.set(link.id, link)
        return link
      }
    )
  }
})

describe('LinkConnector', () => {
  test('should initialize with default state', ({ connector }) => {
    expect(connector.state).toEqual({
      connectingTo: undefined,
      multi: false,
      draggingExistingLinks: false
    })
    expect(connector.renderLinks).toEqual([])
    expect(connector.inputLinks).toEqual([])
    expect(connector.outputLinks).toEqual([])
    expect(connector.hiddenReroutes.size).toBe(0)
  })

  describe('Moving Input Links', () => {
    test('should handle moving input links', ({
      network,
      connector,
      createTestNode
    }) => {
      const sourceNode = createTestNode(1)
      const targetNode = createTestNode(2)

      const slotType: ISlotType = 'number'
      sourceNode.addOutput('out', slotType)
      targetNode.addInput('in', slotType)

      const link = new LLink(toLinkId(1), slotType, 1, 0, 2, 0)
      network.links.set(link.id, link)
      targetNode.inputs[0].link = link.id

      connector.moveInputLink(network, targetNode, targetNode.inputs[0])

      expect(connector.state.connectingTo).toBe('input')
      expect(connector.state.draggingExistingLinks).toBe(true)
      expect(connector.inputLinks).toContain(link)
      expect(link._dragging).toBe(true)
    })

    test('should not move input link if already connecting', ({
      connector,
      network
    }) => {
      connector.state.connectingTo = 'input'

      expect(() => {
        connector.moveInputLink(
          network,
          new LGraphNode('mock'),
          createMockNodeInputSlot({ link: toLinkId(1) })
        )
      }).toThrow('Already dragging links.')
    })
  })

  describe('Moving Output Links', () => {
    test('should handle moving output links', ({
      network,
      connector,
      createTestNode
    }) => {
      const sourceNode = createTestNode(1)
      const targetNode = createTestNode(2)

      const slotType: ISlotType = 'number'
      sourceNode.addOutput('out', slotType)
      targetNode.addInput('in', slotType)

      const link = sourceNode.connect(0, targetNode, 0)!
      expect(link).toBeTruthy()

      connector.moveOutputLink(network, sourceNode, sourceNode.outputs[0])

      expect(connector.state.connectingTo).toBe('output')
      expect(connector.state.draggingExistingLinks).toBe(true)
      expect(connector.state.multi).toBe(true)
      expect(connector.outputLinks).toContain(link)
      expect(link._dragging).toBe(true)
    })

    test('should not move output link if already connecting', ({
      connector,
      network
    }) => {
      connector.state.connectingTo = 'output'

      expect(() => {
        connector.moveOutputLink(
          network,
          new LGraphNode('mock'),
          createMockNodeOutputSlot({ links: [toLinkId(1)] })
        )
      }).toThrow('Already dragging links.')
    })
  })

  describe('Dragging New Links', () => {
    test('should handle dragging new link from output', ({
      network,
      connector,
      createTestNode
    }) => {
      const sourceNode = createTestNode(1)
      const slotType: ISlotType = 'number'
      sourceNode.addOutput('out', slotType)

      connector.dragNewFromOutput(network, sourceNode, sourceNode.outputs[0])

      expect(connector.state.connectingTo).toBe('input')
      expect(connector.renderLinks.length).toBe(1)
      expect(connector.state.draggingExistingLinks).toBe(false)
    })

    test('should handle dragging new link from input', ({
      network,
      connector,
      createTestNode
    }) => {
      const targetNode = createTestNode(1)
      const slotType: ISlotType = 'number'
      targetNode.addInput('in', slotType)

      connector.dragNewFromInput(network, targetNode, targetNode.inputs[0])

      expect(connector.state.connectingTo).toBe('output')
      expect(connector.renderLinks.length).toBe(1)
      expect(connector.state.draggingExistingLinks).toBe(false)
    })
  })

  describe('Dragging from reroutes', () => {
    test('should handle dragging from reroutes', ({
      network,
      connector,
      createTestNode,
      createTestLink
    }) => {
      const originNode = createTestNode(1)
      const targetNode = createTestNode(2)

      const output = originNode.addOutput('out', 'number')
      targetNode.addInput('in', 'number')

      const link = createTestLink(1, 1, 2)
      const reroute = new Reroute(toRerouteId(1), network, [0, 0])
      network.reroutes.set(reroute.id, reroute)
      registerRerouteChain(network, reroute)
      link.parentId = reroute.id
      registerLinkTopology(network, link)

      connector.dragFromReroute(network, reroute)

      expect(connector.state.connectingTo).toBe('input')
      expect(connector.state.draggingExistingLinks).toBe(false)
      expect(connector.renderLinks.length).toBe(1)

      const renderLink = connector.renderLinks[0]
      expect(renderLink instanceof ToInputRenderLink).toBe(true)
      expect(renderLink.toType).toEqual('input')
      expect(renderLink.node).toEqual(originNode)
      expect(renderLink.fromSlot).toEqual(output)
      expect(renderLink.fromReroute).toEqual(reroute)
      expect(renderLink.fromDirection).toEqual(LinkDirection.NONE)
      expect(renderLink.network).toEqual(network)
    })
  })

  describe('Reset', () => {
    test('should reset state and clear links', ({ network, connector }) => {
      connector.state.connectingTo = 'input'
      connector.state.multi = true
      connector.state.draggingExistingLinks = true

      const link = new LLink(toLinkId(1), 'number', 1, 0, 2, 0)
      link._dragging = true
      connector.inputLinks.push(link)

      const reroute = new Reroute(toRerouteId(1), network)
      reroute.pos = [0, 0]
      reroute._dragging = true
      connector.hiddenReroutes.add(reroute)

      connector.reset()

      expect(connector.state).toEqual({
        connectingTo: undefined,
        multi: false,
        draggingExistingLinks: false
      })
      expect(connector.renderLinks).toEqual([])
      expect(connector.inputLinks).toEqual([])
      expect(connector.outputLinks).toEqual([])
      expect(connector.hiddenReroutes.size).toBe(0)
      expect(link._dragging).toBeUndefined()
      expect(reroute._dragging).toBeUndefined()
    })
  })

  describe('Event Handling', () => {
    test('should handle event listeners until reset', ({
      connector,
      createTestNode
    }) => {
      const listener = vi.fn()
      connector.listenUntilReset('input-moved', listener)

      const sourceNode = createTestNode(1)

      const mockRenderLink = {
        node: sourceNode,
        fromSlot: { name: 'out', type: 'number' },
        fromPos: [0, 0],
        fromDirection: LinkDirection.RIGHT,
        toType: 'input',
        link: new LLink(toLinkId(1), 'number', 1, 0, 2, 0)
      } as MovingInputLink

      connector.events.dispatch('input-moved', mockRenderLink)
      expect(listener).toHaveBeenCalled()

      connector.reset()
      connector.events.dispatch('input-moved', mockRenderLink)
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe('Export', () => {
    test('should export current state', ({ network, connector }) => {
      connector.state.connectingTo = 'input'
      connector.state.multi = true

      const link = new LLink(toLinkId(1), 'number', 1, 0, 2, 0)
      connector.inputLinks.push(link)

      const exported = connector.export(network)

      expect(exported.state).toEqual(connector.state)
      expect(exported.inputLinks).toEqual(connector.inputLinks)
      expect(exported.outputLinks).toEqual(connector.outputLinks)
      expect(exported.renderLinks).toEqual(connector.renderLinks)
      expect(exported.network).toBe(network)
    })
  })
})
