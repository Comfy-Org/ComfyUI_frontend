import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'

describe('LGraphCanvas.showEditPropertyValue', () => {
  let canvas: LGraphCanvas
  let node: LGraphNode

  beforeEach(() => {
    document.body.innerHTML = ''
    const canvasElement = document.createElement('canvas')
    canvasElement.getContext = vi
      .fn()
      .mockReturnValue({} as CanvasRenderingContext2D)
    document.body.append(canvasElement)

    const graph = new LGraph()
    canvas = new LGraphCanvas(canvasElement, graph, {
      skip_render: true,
      skip_events: true
    })

    node = new LGraphNode('test')
    node.properties = {}
    graph.add(node)
  })

  it('renders a markup-bearing property name as text', () => {
    const hostileName = '<img src=x onerror="globalThis.__pwned = true">'
    node.properties[hostileName] = 'value'

    canvas.showEditPropertyValue(node, hostileName, {})

    const dialog = document.querySelector('.graphdialog')
    expect(dialog).not.toBeNull()
    expect(dialog!.querySelector('img')).toBeNull()
    expect(dialog!.querySelector('.name')?.textContent).toBe(hostileName)
  })

  it('preserves an ordinary property name', () => {
    node.properties['seed'] = 1

    canvas.showEditPropertyValue(node, 'seed', {})

    expect(document.querySelector('.graphdialog .name')?.textContent).toBe(
      'seed'
    )
  })
})
