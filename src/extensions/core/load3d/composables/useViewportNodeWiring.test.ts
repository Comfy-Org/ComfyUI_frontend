import { describe, expect, it, vi } from 'vitest'
import { fromPartial } from '@total-typescript/shoehorn'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

import {
  createSceneHoverHandlers,
  useViewportNodeWiring
} from './useViewportNodeWiring'

class TestNode extends LGraphNode {
  declare widgets: IBaseWidget[]
  override onMouseEnter?: () => void
  override onMouseLeave?: () => void
  override onConnectionsChange?: () => void
}

function makeNode(names: string[]): TestNode {
  const node = new TestNode('Viewport')
  node.widgets = names.map((name) =>
    fromPartial<IBaseWidget>({ name, value: 0 })
  )
  return node
}

describe('useViewportNodeWiring', () => {
  it('wraps named widget callbacks, keeps the original and reports the widget', () => {
    const node = makeNode(['a', 'b', 'c'])
    const original = vi.fn()
    node.widgets[0].callback = original
    const onChange = vi.fn()
    const wiring = useViewportNodeWiring()

    wiring.wireWidgets(node, ['a', 'b', 'missing'], onChange)
    node.widgets[0].callback(5, undefined, node)
    node.widgets[2].callback?.(1)

    expect(original).toHaveBeenCalledWith(5, undefined, node)
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

    wiring.wireNode(node, {
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
    wiring.wireNode(node, { viewport: () => null })
    expect(node.onMouseEnter).not.toBe(originalEnter)

    wiring.unwire()

    expect(node.widgets[0].callback).toBe(original)
    expect(node.onMouseEnter).toBe(originalEnter)
    expect(node.onConnectionsChange).toBeUndefined()
  })
})

describe('createSceneHoverHandlers', () => {
  it('routes scene hover into the current viewport status', () => {
    const viewport = {
      updateStatusMouseOnScene: vi.fn(),
      refreshViewport: vi.fn()
    }
    const { handleMouseEnter, handleMouseLeave } = createSceneHoverHandlers(
      () => viewport
    )

    handleMouseEnter()
    expect(viewport.updateStatusMouseOnScene).toHaveBeenLastCalledWith(true)
    expect(viewport.refreshViewport).toHaveBeenCalledOnce()

    handleMouseLeave()
    expect(viewport.updateStatusMouseOnScene).toHaveBeenLastCalledWith(false)
  })

  it('does nothing without a viewport', () => {
    const { handleMouseEnter, handleMouseLeave } = createSceneHoverHandlers(
      () => null
    )

    expect(() => {
      handleMouseEnter()
      handleMouseLeave()
    }).not.toThrow()
  })
})
