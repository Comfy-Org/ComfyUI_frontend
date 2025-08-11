import { describe, expect, it, vi } from 'vitest'

import { ToOutputRenderLink } from '@/lib/litegraph/src/canvas/ToOutputRenderLink'
import { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'

describe('ToOutputRenderLink', () => {
  describe('connectToOutput', () => {
    it('should return early if inputNode is null', () => {
      // Setup
      const mockNetwork = {}
      const mockFromSlot = {}
      const mockNode = {
        id: 'test-id',
        inputs: [mockFromSlot],
        getInputPos: vi.fn().mockReturnValue([0, 0])
      }

      const renderLink = new ToOutputRenderLink(
        mockNetwork as any,
        mockNode as any,
        mockFromSlot as any,
        undefined,
        LinkDirection.CENTER
      )

      // Override the node property to simulate null case
      Object.defineProperty(renderLink, 'node', {
        value: null
      })

      const mockTargetNode = {
        connectSlots: vi.fn()
      }
      const mockEvents = {
        dispatch: vi.fn()
      }

      // Act
      renderLink.connectToOutput(
        mockTargetNode as any,
        {} as any,
        mockEvents as any
      )

      // Assert
      expect(mockTargetNode.connectSlots).not.toHaveBeenCalled()
      expect(mockEvents.dispatch).not.toHaveBeenCalled()
    })

    it('should create connection and dispatch event when inputNode exists', () => {
      // Setup
      const mockNetwork = {}
      const mockFromSlot = {}
      const mockNode = {
        id: 'test-id',
        inputs: [mockFromSlot],
        getInputPos: vi.fn().mockReturnValue([0, 0])
      }

      const renderLink = new ToOutputRenderLink(
        mockNetwork as any,
        mockNode as any,
        mockFromSlot as any,
        undefined,
        LinkDirection.CENTER
      )

      const mockNewLink = { id: 'new-link' }
      const mockTargetNode = {
        connectSlots: vi.fn().mockReturnValue(mockNewLink)
      }
      const mockEvents = {
        dispatch: vi.fn()
      }

      // Act
      renderLink.connectToOutput(
        mockTargetNode as any,
        {} as any,
        mockEvents as any
      )

      // Assert
      expect(mockTargetNode.connectSlots).toHaveBeenCalledWith(
        expect.anything(),
        mockNode,
        mockFromSlot,
        undefined
      )
      expect(mockEvents.dispatch).toHaveBeenCalledWith(
        'link-created',
        mockNewLink
      )
    })
  })
})
