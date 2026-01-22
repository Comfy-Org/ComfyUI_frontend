// TODO: Fix these tests after migration
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type {
  CanvasPointerEvent,
  INodeInputSlot,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
// We don't strictly need RenderLink interface import for the mock
import { LinkConnector } from '@/lib/litegraph/src/litegraph'

// Mocks
const mockSetConnectingLinks = vi.fn()

// Mock a structure that has the needed method
function mockRenderLinkImpl(canConnect: boolean) {
  return {
    canConnectToInput: vi.fn().mockReturnValue(canConnect)
    // Add other properties if they become necessary for tests
  }
}

const mockNode = {} as LGraphNode
const mockInput = {} as INodeInputSlot

describe.skip('LinkConnector', () => {
  let connector: LinkConnector

  beforeEach(() => {
    connector = new LinkConnector(mockSetConnectingLinks)
    // Clear the array directly before each test
    connector.renderLinks.length = 0
    vi.clearAllMocks()
  })

  describe.skip('isInputValidDrop', () => {
    test('should return false if there are no render links', () => {
      expect(connector.isInputValidDrop(mockNode, mockInput)).toBe(false)
    })

    test('should return true if at least one render link can connect', () => {
      const link1 = mockRenderLinkImpl(false)
      const link2 = mockRenderLinkImpl(true)
      type RenderLinkItem = (typeof connector.renderLinks)[number]
      connector.renderLinks.push(
        link1 as unknown as RenderLinkItem,
        link2 as unknown as RenderLinkItem
      )
      expect(connector.isInputValidDrop(mockNode, mockInput)).toBe(true)
      expect(link1.canConnectToInput).toHaveBeenCalledWith(mockNode, mockInput)
      expect(link2.canConnectToInput).toHaveBeenCalledWith(mockNode, mockInput)
    })

    test('should return false if no render links can connect', () => {
      const link1 = mockRenderLinkImpl(false)
      const link2 = mockRenderLinkImpl(false)
      type RenderLinkItem = (typeof connector.renderLinks)[number]
      connector.renderLinks.push(
        link1 as unknown as RenderLinkItem,
        link2 as unknown as RenderLinkItem
      )
      expect(connector.isInputValidDrop(mockNode, mockInput)).toBe(false)
      expect(link1.canConnectToInput).toHaveBeenCalledWith(mockNode, mockInput)
      expect(link2.canConnectToInput).toHaveBeenCalledWith(mockNode, mockInput)
    })

    test('should call canConnectToInput on each render link until one returns true', () => {
      const link1 = mockRenderLinkImpl(false)
      const link2 = mockRenderLinkImpl(true) // This one can connect
      const link3 = mockRenderLinkImpl(false)
      type RenderLinkItem = (typeof connector.renderLinks)[number]
      connector.renderLinks.push(
        link1 as unknown as RenderLinkItem,
        link2 as unknown as RenderLinkItem,
        link3 as unknown as RenderLinkItem
      )

      expect(connector.isInputValidDrop(mockNode, mockInput)).toBe(true)

      expect(link1.canConnectToInput).toHaveBeenCalledTimes(1)
      expect(link2.canConnectToInput).toHaveBeenCalledTimes(1) // Stops here
      expect(link3.canConnectToInput).not.toHaveBeenCalled() // Should not be called
    })
  })

  describe.skip('listenUntilReset', () => {
    test('should add listener for the specified event and for reset', () => {
      const listener = vi.fn()
      const addEventListenerSpy = vi.spyOn(connector.events, 'addEventListener')

      connector.listenUntilReset('before-drop-links', listener)

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'before-drop-links',
        listener,
        undefined
      )
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'reset',
        expect.any(Function),
        { once: true }
      )
    })

    test('should call the listener when the event is dispatched before reset', () => {
      const listener = vi.fn()
      const eventData = {
        renderLinks: [],
        event: {} as unknown as CanvasPointerEvent
      }
      connector.listenUntilReset('before-drop-links', listener)

      connector.events.dispatch('before-drop-links', eventData)

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(
        new CustomEvent('before-drop-links')
      )
    })

    test('should remove the listener when reset is dispatched', () => {
      const listener = vi.fn()
      const removeEventListenerSpy = vi.spyOn(
        connector.events,
        'removeEventListener'
      )

      connector.listenUntilReset('before-drop-links', listener)

      // Simulate the reset event being dispatched
      connector.events.dispatch('reset', false)

      // Check if removeEventListener was called correctly for the original listener
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'before-drop-links',
        listener
      )
    })

    test('should not call the listener after reset is dispatched', () => {
      const listener = vi.fn()
      const eventData = {
        renderLinks: [],
        event: {} as unknown as CanvasPointerEvent
      }
      connector.listenUntilReset('before-drop-links', listener)

      // Dispatch reset first
      connector.events.dispatch('reset', false)

      // Then dispatch the original event
      connector.events.dispatch('before-drop-links', eventData)

      expect(listener).not.toHaveBeenCalled()
    })

    test('should pass options to addEventListener', () => {
      const listener = vi.fn()
      const options = { once: true }
      const addEventListenerSpy = vi.spyOn(connector.events, 'addEventListener')

      connector.listenUntilReset('after-drop-links', listener, options)

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'after-drop-links',
        listener,
        options
      )
      // Still adds the reset listener
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'reset',
        expect.any(Function),
        { once: true }
      )
    })
  })
})
