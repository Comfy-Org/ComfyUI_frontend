import { afterEach, describe, expect, it } from 'vitest'

import { createAgentGraphNodePresenter } from './agentGraphNodePresenter'

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
    const present = createAgentGraphNodePresenter(42, { x: 600, y: 100 })

    present({ x: 120, y: 500 })

    expect(node.style.getPropertyValue('translate')).toBe('-480px 400px')
    expect(node.style.willChange).toBe('translate')

    present(null)

    expect(node.style.getPropertyValue('translate')).toBe('')
    expect(node.style.willChange).toBe('')
  })

  it('reattaches presentation to a remounted node', () => {
    const container = document.createElement('div')
    container.id = 'graph-canvas-container'
    document.body.append(container)
    const first = addNode('node-a')
    const present = createAgentGraphNodePresenter('node-a', { x: 200, y: 80 })

    present({ x: 0, y: 300 })
    first.remove()
    const replacement = addNode('node-a')
    present({ x: 100, y: 180 })

    expect(replacement.style.getPropertyValue('translate')).toBe('-100px 100px')
  })

  it('does not attach playback to a same-id node after a graph switch', () => {
    const container = document.createElement('div')
    container.id = 'graph-canvas-container'
    document.body.append(container)
    let isCurrentGraph = true
    const first = addNode('7')
    const present = createAgentGraphNodePresenter(
      7,
      { x: 500, y: 100 },
      () => isCurrentGraph
    )

    present({ x: 100, y: 400 })
    expect(first.style.getPropertyValue('translate')).toBe('-400px 300px')

    isCurrentGraph = false
    first.remove()
    const otherGraphNode = addNode('7')
    present({ x: 300, y: 200 })

    expect(otherGraphNode.style.getPropertyValue('translate')).toBe('')
  })
})
