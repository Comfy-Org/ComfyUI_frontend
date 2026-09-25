import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { useViewportNodeWiring } from './useViewportNodeWiring'
import type { WirableWidget } from './useViewportNodeWiring'

interface FakeNode {
  widgets: WirableWidget[]
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onConnectionsChange?: () => void
}

function makeNode(names: string[]): FakeNode {
  return { widgets: names.map((name) => ({ name, value: 0 })) }
}

function asGraphNode(node: FakeNode): LGraphNode {
  return node as unknown as LGraphNode
}

describe('useViewportNodeWiring', () => {
  it('wraps named widget callbacks, keeps the original and reports the widget', () => {
    const node = makeNode(['a', 'b', 'c'])
    const original = vi.fn()
    node.widgets[0].callback = original
    const onChange = vi.fn()
    const wiring = useViewportNodeWiring()

    wiring.wireWidgets(node, ['a', 'b', 'missing'], onChange)
    node.widgets[0].callback(5, 'extra')
    node.widgets[2].callback?.(1)

    expect(original).toHaveBeenCalledWith(5, 'extra')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(node.widgets[0])
    expect(node.widgets[1].callback).toBeDefined()
  })

  it('does not double-wrap a widget that is wired twice', () => {
    const node = makeNode(['a'])
    const onChange = vi.fn()
    const wiring = useViewportNodeWiring()

    wiring.wireWidgets(node, ['a'], onChange)
    wiring.wireWidgets(node, ['a'], onChange)
    node.widgets[0].callback!(1)

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('routes node hover into the viewport status and chains existing handlers', () => {
    const node = makeNode([])
    const existingEnter = vi.fn()
    node.onMouseEnter = existingEnter
    const viewport = {
      updateStatusMouseOnNode: vi.fn(),
      refreshViewport: vi.fn()
    }
    const onConnectionsChange = vi.fn()
    const wiring = useViewportNodeWiring()

    wiring.wireNode(asGraphNode(node), {
      viewport: () => viewport,
      onConnectionsChange
    })
    node.onMouseEnter()
    node.onMouseLeave?.()
    node.onConnectionsChange?.()

    expect(existingEnter).toHaveBeenCalledOnce()
    expect(viewport.updateStatusMouseOnNode).toHaveBeenNthCalledWith(1, true)
    expect(viewport.refreshViewport).toHaveBeenCalledOnce()
    expect(viewport.updateStatusMouseOnNode).toHaveBeenNthCalledWith(2, false)
    expect(onConnectionsChange).toHaveBeenCalledOnce()
  })

  it('restores widget callbacks and node handlers on unwire', () => {
    const node = makeNode(['a'])
    const original = vi.fn()
    node.widgets[0].callback = original
    const originalEnter = vi.fn()
    node.onMouseEnter = originalEnter
    const wiring = useViewportNodeWiring()
    wiring.wireWidgets(node, ['a'], vi.fn())
    wiring.wireNode(asGraphNode(node), { viewport: () => null })
    expect(node.onMouseEnter).not.toBe(originalEnter)

    wiring.unwire()

    expect(node.widgets[0].callback).toBe(original)
    expect(node.onMouseEnter).toBe(originalEnter)
    expect(node.onConnectionsChange).toBeUndefined()
  })
})
