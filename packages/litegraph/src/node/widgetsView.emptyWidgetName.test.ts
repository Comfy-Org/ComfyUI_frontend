import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '#/litegraph'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useWidgetValueStore } from '@comfyorg/graph-state/widgetValueStore'

function createNode(): LGraphNode {
  const graph = new LGraph()
  const node = new LGraphNode('test')
  graph.add(node)
  return node
}

function names(node: LGraphNode): string[] {
  return (node.widgets ?? []).map((widget) => widget.name)
}

function storedNames(node: LGraphNode): string[] {
  return useWidgetValueStore()
    .getNodeWidgets(node.graph!.rootGraph.id, node.id)
    .map((widget) => widget.name)
}

describe('empty widget name', () => {
  beforeEach(() => {
    LiteGraph.vueNodesMode = false
  })

  it('keeps an unlabeled widget on the node, under the name it was given', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    node.addWidget('text', '', 'hello', () => undefined, {})
    node.addWidget('number', 'cfg', 3, () => undefined, {})

    expect(names(node)).toEqual(['seed', '', 'cfg'])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('declines the un-keyable id without withholding one from its siblings', () => {
    const node = createNode()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    node.addWidget('text', '', 'hello', () => undefined, {})
    node.addWidget('number', 'cfg', 3, () => undefined, {})

    expect(storedNames(node)).toEqual(['seed', 'cfg'])
  })

  it('still settles two unlabeled widgets, which do collide with each other', () => {
    const node = createNode()
    node.addWidget('text', '', 'first', () => undefined, {})
    node.addWidget('text', '', 'second', () => undefined, {})

    expect(names(node)).toEqual(['', '#1'])
    expect(node.widgets).toHaveLength(2)
    expect(reportError).not.toHaveBeenCalled()
  })
})
