import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'
import { setRevealedLinks } from '@/lib/litegraph/src/canvas/linkRevealState'
import {
  isRerouteVisibleForLinkDrag,
  resolvePointerTarget
} from '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { createTestLink } from '@/utils/__tests__/litegraphTestUtils'

describe('isRerouteVisibleForLinkDrag', () => {
  it('accepts a shared reroute kept visible by a disconnected floating branch', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.addOutput('out', 'MODEL')
    graph.add(source)
    const targets = [0, 1].map(() => {
      const target = new LGraphNode('Target')
      target.addInput('in', 'MODEL')
      graph.add(target)
      return target
    })
    const hidden = createTestLink(graph, source, 0, targets[0], 0)
    const detached = createTestLink(graph, source, 0, targets[1], 0)
    const shared = graph.createReroute([200, 100], hidden)
    if (!shared) throw new Error('Missing shared reroute')
    detached.parentId = shared.id
    const tail = graph.createReroute([300, 200], detached)
    if (!tail) throw new Error('Missing floating tail')
    expect(targets[1].disconnectInput(0, true)).toBe(true)
    useLinkPresentationStore().patch(graphScopeOf(graph), hidden.id, {
      hidden: true
    })

    expect(shared.floatingLinkIds.size).toBe(1)
    expect(isRerouteVisibleForLinkDrag(graph, shared)).toBe(true)
  })

  it('rejects only reroutes whose links are all hidden and unrevealed', () => {
    const graph = new LGraph()
    const link = new LLink(toLinkId(1), 'MODEL', 1, 0, 2, 0)
    graph._addLink(link)
    const scope = graphScopeOf(graph)
    useLinkPresentationStore().patch(scope, link.id, { hidden: true })
    const reroute = graph.setReroute({ pos: [0, 0], linkIds: [] })
    if (!reroute) throw new Error('Failed to create reroute')
    link.parentId = reroute.id

    expect(isRerouteVisibleForLinkDrag(graph, reroute)).toBe(false)

    const owner = {}
    setRevealedLinks(scope.rootGraphId, [link.id], owner)
    expect(isRerouteVisibleForLinkDrag(graph, reroute)).toBe(true)

    setRevealedLinks(scope.rootGraphId, [], owner)
    useLinkPresentationStore().patch(scope, link.id, { hidden: false })
    expect(isRerouteVisibleForLinkDrag(graph, reroute)).toBe(true)
  })
})

describe('resolvePointerTarget', () => {
  it('returns element from elementFromPoint when available', () => {
    const targetElement = document.createElement('div')
    targetElement.className = 'lg-slot'

    const spy = vi
      .spyOn(document, 'elementFromPoint')
      .mockReturnValue(targetElement)

    const fallback = document.createElement('span')
    const result = resolvePointerTarget(100, 200, fallback)

    expect(spy).toHaveBeenCalledWith(100, 200)
    expect(result).toBe(targetElement)
  })

  it('returns fallback when elementFromPoint returns null', () => {
    const spy = vi.spyOn(document, 'elementFromPoint').mockReturnValue(null)

    const fallback = document.createElement('span')
    fallback.className = 'fallback-element'

    const result = resolvePointerTarget(100, 200, fallback)

    expect(spy).toHaveBeenCalledWith(100, 200)
    expect(result).toBe(fallback)
  })

  it('returns null fallback when both elementFromPoint and fallback are null', () => {
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(null)

    const result = resolvePointerTarget(100, 200, null)

    expect(result).toBeNull()
  })

  describe('touch/mobile pointer capture simulation', () => {
    it('resolves correct target when touch moves over different element', () => {
      // Simulate the touch scenario:
      // - User touches slot A (event.target = slotA)
      // - User drags over slot B (elementFromPoint returns slotB)
      // - resolvePointerTarget should return slotB, not slotA

      const slotA = document.createElement('div')
      slotA.className = 'lg-slot slot-a'
      slotA.setAttribute('data-slot-key', 'node1-0-input')

      const slotB = document.createElement('div')
      slotB.className = 'lg-slot slot-b'
      slotB.setAttribute('data-slot-key', 'node2-0-input')

      // When pointer is over slotB, elementFromPoint returns slotB
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(slotB)

      // But the fallback (event.target on touch) is still slotA
      const result = resolvePointerTarget(150, 250, slotA)

      // Should return slotB (the actual element under pointer), not slotA
      expect(result).toBe(slotB)
      expect(result).not.toBe(slotA)
    })

    it('falls back to original target when pointer is outside viewport', () => {
      // When pointer is outside the document (e.g., dragged off screen),
      // elementFromPoint returns null

      const slotA = document.createElement('div')
      slotA.className = 'lg-slot slot-a'

      vi.spyOn(document, 'elementFromPoint').mockReturnValue(null)

      const result = resolvePointerTarget(-100, -100, slotA)

      // Should fall back to the original target
      expect(result).toBe(slotA)
    })
  })

  describe('integration with slot detection', () => {
    it('returned element can be used with closest() for slot detection', () => {
      // Create a nested structure like the real DOM
      const nodeContainer = document.createElement('div')
      nodeContainer.setAttribute('data-node-id', 'node123')

      const slotWrapper = document.createElement('div')
      slotWrapper.className = 'lg-slot'

      const slotDot = document.createElement('div')
      slotDot.className = 'slot-dot'
      slotDot.setAttribute('data-slot-key', 'node123-0-input')

      slotWrapper.appendChild(slotDot)
      nodeContainer.appendChild(slotWrapper)

      // elementFromPoint returns the innermost element (slot dot)
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(slotDot)

      const result = resolvePointerTarget(100, 100, null)

      // Verify we can use closest() to find parent slot and node
      expect(result).toBeInstanceOf(HTMLElement)
      const htmlResult = result as HTMLElement
      expect(htmlResult.closest('.lg-slot')).toBe(slotWrapper)
      expect(htmlResult.closest('[data-node-id]')).toBe(nodeContainer)
      expect(htmlResult.getAttribute('data-slot-key')).toBe('node123-0-input')
    })
  })
})
