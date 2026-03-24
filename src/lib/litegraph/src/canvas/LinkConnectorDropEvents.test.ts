import { beforeEach, describe, expect, test, vi } from 'vitest'

import { LinkConnector } from '@/lib/litegraph/src/litegraph'
import {
  createMockCanvasPointerEvent,
  createMockLGraphNode,
  createMockLinkNetwork,
  createMockNodeInputSlot,
  createMockNodeOutputSlot
} from '@/utils/__tests__/litegraphTestUtils'

const mockSetConnectingLinks = vi.fn()

type RenderLinkItem = LinkConnector['renderLinks'][number]

function createMockRenderLink(): RenderLinkItem {
  const partial: Partial<RenderLinkItem> = {
    toType: 'input',
    fromPos: [0, 0],
    fromSlotIndex: 0,
    fromDirection: 0,
    network: createMockLinkNetwork(),
    node: createMockLGraphNode(),
    fromSlot: createMockNodeOutputSlot(),
    dragDirection: 0,
    canConnectToInput: vi.fn().mockReturnValue(false),
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

describe('LinkConnector.dropOnNothing event dispatch', () => {
  let connector: LinkConnector

  beforeEach(() => {
    connector = new LinkConnector(mockSetConnectingLinks)
    vi.clearAllMocks()
  })

  test('dispatches before-drop-on-canvas before dropped-on-canvas', () => {
    connector.renderLinks.push(createMockRenderLink())

    const callOrder: string[] = []
    connector.events.addEventListener('before-drop-on-canvas', () => {
      callOrder.push('before-drop-on-canvas')
    })
    connector.events.addEventListener('dropped-on-canvas', () => {
      callOrder.push('dropped-on-canvas')
    })

    connector.dropOnNothing(createMockCanvasPointerEvent(100, 100))

    expect(callOrder).toEqual(['before-drop-on-canvas', 'dropped-on-canvas'])
  })

  test('skips dropped-on-canvas when before-drop-on-canvas is intercepted', () => {
    connector.renderLinks.push(createMockRenderLink())

    const droppedListener = vi.fn()
    connector.events.addEventListener('before-drop-on-canvas', (e) => {
      e.preventDefault()
    })
    connector.events.addEventListener('dropped-on-canvas', droppedListener)

    connector.dropOnNothing(createMockCanvasPointerEvent(100, 100))

    expect(droppedListener).not.toHaveBeenCalled()
  })

  test('does not dispatch events when renderLinks is empty', () => {
    const beforeListener = vi.fn()
    const droppedListener = vi.fn()
    connector.events.addEventListener('before-drop-on-canvas', beforeListener)
    connector.events.addEventListener('dropped-on-canvas', droppedListener)

    connector.dropOnNothing(createMockCanvasPointerEvent(100, 100))

    expect(beforeListener).not.toHaveBeenCalled()
    expect(droppedListener).not.toHaveBeenCalled()
  })
})

describe('LinkConnector rewire flows dispatch connecting event', () => {
  let connector: LinkConnector

  beforeEach(() => {
    connector = new LinkConnector(mockSetConnectingLinks)
    vi.clearAllMocks()
  })

  test('moveInputLink dispatches connecting with connectingTo: input', () => {
    const connectingListener = vi.fn()
    connector.events.addEventListener('connecting', connectingListener)

    // Use a floating link path (no link ID, has _floatingLinks) which is
    // simpler to mock than the full link resolution path.
    const floatingLink = {
      id: 1,
      parentId: 'reroute-1',
      _dragging: false
    }
    const reroute = { id: 'reroute-1' }
    const reroutes = new Map([['reroute-1', reroute]])
    const network = createMockLinkNetwork({
      links: new Map(),
      reroutes,
      getReroute: (id: string) => reroutes.get(id)
    } as never)

    const floatingLinks = new Set([floatingLink])
    const input = createMockNodeInputSlot({
      link: null,
      _floatingLinks: floatingLinks
    } as never)

    connector.moveInputLink(network, input)

    expect(connectingListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { connectingTo: 'input' }
      })
    )
  })

  test('moveOutputLink dispatches connecting with connectingTo: output', () => {
    const connectingListener = vi.fn()
    connector.events.addEventListener('connecting', connectingListener)

    // Inject a render link directly so moveOutputLink reaches the dispatch
    // without needing full link resolution mocking.
    connector.renderLinks.push(createMockRenderLink())

    const network = createMockLinkNetwork({
      links: new Map(),
      reroutes: new Map()
    } as never)

    // Empty output (no links/floating) — the method will find renderLinks
    // already populated from our injection and proceed to dispatch.
    const output = createMockNodeOutputSlot({ links: [] })

    connector.moveOutputLink(network, output)

    expect(connectingListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { connectingTo: 'output' }
      })
    )
  })
})
