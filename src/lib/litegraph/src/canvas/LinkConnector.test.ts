import { beforeEach, describe, expect, test, vi } from 'vitest'

import { LinkConnector } from '@/lib/litegraph/src/litegraph'
import {
  createMockLGraphNode,
  createMockLinkNetwork,
  createMockNodeInputSlot,
  createMockNodeOutputSlot
} from '@/utils/__tests__/litegraphTestUtils'

// Mocks
const mockSetConnectingLinks = vi.fn()

type RenderLinkItem = LinkConnector['renderLinks'][number]

// Mock a structure that has the needed method
function mockRenderLinkImpl(canConnect: boolean): RenderLinkItem {
  const partial: Partial<RenderLinkItem> = {
    toType: 'output',
    fromPos: [0, 0],
    fromSlotIndex: 0,
    fromDirection: 0,
    network: createMockLinkNetwork(),
    node: createMockLGraphNode(),
    fromSlot: createMockNodeOutputSlot(),
    dragDirection: 0,
    canConnectToInput: vi.fn().mockReturnValue(canConnect),
    canConnectToOutput: vi.fn().mockReturnValue(false),
    canConnectToReroute: vi.fn().mockReturnValue(false),
    connectToInput: vi.fn(),
    connectToOutput: vi.fn(),
    connectToSubgraphInput: vi.fn(),
    connectToRerouteOutput: vi.fn(),
    connectToSubgraphOutput: vi.fn(),
    connectToRerouteInput: vi.fn()
  }
  return partial as RenderLinkItem
}

const mockNode = createMockLGraphNode()
const mockInput = createMockNodeInputSlot()

describe('LinkConnector', () => {
  let connector: LinkConnector

  beforeEach(() => {
    connector = new LinkConnector(mockSetConnectingLinks)
    // Clear the array directly before each test
    connector.renderLinks.length = 0
    vi.clearAllMocks()
  })

  describe('isInputValidDrop', () => {
    test('should return false if there are no render links', () => {
      expect(connector.isInputValidDrop(mockNode, mockInput)).toBe(false)
    })

    test('should return true if at least one render link can connect', () => {
      const link1 = mockRenderLinkImpl(false)
      const link2 = mockRenderLinkImpl(true)
      connector.renderLinks.push(link1, link2)
      expect(connector.isInputValidDrop(mockNode, mockInput)).toBe(true)
      expect(link1.canConnectToInput).toHaveBeenCalledWith(mockNode, mockInput)
      expect(link2.canConnectToInput).toHaveBeenCalledWith(mockNode, mockInput)
    })

    test('should return false if no render links can connect', () => {
      const link1 = mockRenderLinkImpl(false)
      const link2 = mockRenderLinkImpl(false)
      connector.renderLinks.push(link1, link2)
      expect(connector.isInputValidDrop(mockNode, mockInput)).toBe(false)
      expect(link1.canConnectToInput).toHaveBeenCalledWith(mockNode, mockInput)
      expect(link2.canConnectToInput).toHaveBeenCalledWith(mockNode, mockInput)
    })
  })
})
