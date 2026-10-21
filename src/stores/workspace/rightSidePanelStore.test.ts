import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

function addTextNode(graph = createTestRootGraph()) {
  const node = new LGraphNode('CLIP Text Encode')
  graph.add(node)
  const widget = node.addWidget('text', 'text', 'a portrait', () => {})
  return { graph, target: { node, widget } }
}

describe('rightSidePanelStore text editor', () => {
  it('opens the Text tab on the widget', () => {
    const store = useRightSidePanelStore()
    const { target } = addTextNode()

    store.openTextEditor(target)

    expect(store.isTextEditorActive).toBe(true)
    expect(store.textEditorTarget).toEqual(target)
  })

  it.for([
    { event: 'its node is removed', closes: true, other: false },
    { event: 'another node is removed', closes: false, other: true }
  ])('closes when $event: $closes', ({ closes, other }) => {
    const store = useRightSidePanelStore()
    const { graph, target } = addTextNode()
    const bystander = addTextNode(graph).target
    store.openTextEditor(target)

    graph.remove(other ? bystander.node : target.node)

    expect(store.textEditorTarget === null).toBe(closes)
  })

  it('closes when the graph reloads', () => {
    const store = useRightSidePanelStore()
    const { graph, target } = addTextNode()
    store.openTextEditor(target)

    graph.configure(graph.serialize())

    expect(store.textEditorTarget).toBeNull()
  })

  it('stops watching a widget once another one is opened', () => {
    const store = useRightSidePanelStore()
    const { graph, target: first } = addTextNode()
    const second = addTextNode(graph).target
    store.openTextEditor(first)
    store.openTextEditor(second)

    graph.remove(first.node)

    expect(store.textEditorTarget).toEqual(second)
  })
})
