import { afterEach, describe, expect, it } from 'vitest'
import { fromPartial } from '@total-typescript/shoehorn'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LinkRenderType } from '@/lib/litegraph/src/types/globalEnums'

import {
  createAgentGraphNodePresenter,
  suspendAgentGraphConnections
} from './agentGraphNodePresenter'

function addNode(nodeId: string): HTMLElement {
  const node = document.createElement('div')
  node.className = 'lg-node'
  node.dataset.nodeId = nodeId
  document.querySelector('#graph-canvas-container')?.append(node)
  return node
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('agent graph node presenter', () => {
  it('moves the real rendered node without changing its authoritative layout', () => {
    const container = document.createElement('div')
    container.id = 'graph-canvas-container'
    document.body.append(container)
    const node = addNode('42')
    const presenter = createAgentGraphNodePresenter(42, { x: 600, y: 100 })

    presenter.present({ x: 120, y: 500 })

    expect(node.style.getPropertyValue('translate')).toBe('-480px 400px')
    expect(node.style.willChange).toBe('translate')

    presenter.present(null)

    expect(node.style.getPropertyValue('translate')).toBe('')
    expect(node.style.willChange).toBe('')
  })

  it('reattaches presentation to a remounted node', () => {
    const container = document.createElement('div')
    container.id = 'graph-canvas-container'
    document.body.append(container)
    const first = addNode('node-a')
    const presenter = createAgentGraphNodePresenter('node-a', {
      x: 200,
      y: 80
    })

    presenter.present({ x: 0, y: 300 })
    first.remove()
    const replacement = addNode('node-a')
    presenter.present({ x: 100, y: 180 })

    expect(replacement.style.getPropertyValue('translate')).toBe('-100px 100px')
  })

  it('does not attach playback to a same-id node after a graph switch', () => {
    const container = document.createElement('div')
    container.id = 'graph-canvas-container'
    document.body.append(container)
    let isCurrentGraph = true
    const first = addNode('7')
    const presenter = createAgentGraphNodePresenter(
      7,
      { x: 500, y: 100 },
      () => isCurrentGraph
    )

    presenter.present({ x: 100, y: 400 })
    expect(first.style.getPropertyValue('translate')).toBe('-400px 300px')

    isCurrentGraph = false
    first.remove()
    const otherGraphNode = addNode('7')
    presenter.present({ x: 300, y: 200 })

    expect(otherGraphNode.style.getPropertyValue('translate')).toBe('')
  })

  it('keeps a queued node hidden until its simulated drag begins', () => {
    const container = document.createElement('div')
    container.id = 'graph-canvas-container'
    document.body.append(container)
    const node = addNode('queued')
    node.style.visibility = 'collapse'
    const presenter = createAgentGraphNodePresenter('queued', {
      x: 500,
      y: 100
    })

    presenter.prepare()
    expect(node.style.visibility).toBe('hidden')

    presenter.present({ x: 20, y: 400 })
    expect(node.style.visibility).toBe('collapse')
    expect(node.style.getPropertyValue('translate')).toBe('-480px 300px')

    presenter.present(null)
    expect(node.style.visibility).toBe('collapse')
  })

  it('temporarily hides final-position links without overwriting a newer mode', () => {
    const canvas = fromPartial<LGraphCanvas>({
      links_render_mode: LinkRenderType.SPLINE_LINK,
      setDirty: () => {}
    })
    const restore = suspendAgentGraphConnections(canvas)

    expect(canvas.links_render_mode).toBe(LinkRenderType.HIDDEN_LINK)
    restore()
    expect(canvas.links_render_mode).toBe(LinkRenderType.SPLINE_LINK)

    const restoreAgain = suspendAgentGraphConnections(canvas)
    canvas.links_render_mode = LinkRenderType.STRAIGHT_LINK
    restoreAgain()
    expect(canvas.links_render_mode).toBe(LinkRenderType.STRAIGHT_LINK)
  })
})
