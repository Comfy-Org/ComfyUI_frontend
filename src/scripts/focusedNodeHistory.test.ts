import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'

import type { ComfyApp } from '@/types/comfy'
import { useWidgetHistoryStore } from '@/stores/widgetHistoryStore'

import { travelFocusedNodeHistory } from './focusedNodeHistory'

vi.mock(import('@/scripts/appInstance'), () => ({
  useApp: () =>
    fromPartial<ComfyApp>({
      rootGraph: { id: 'root' },
      canvas: { graph: { id: 'root' } }
    })
}))

const scope = {
  rootGraphId: 'root',
  widgetId: widgetId('root', toNodeId(7), 'mask')
}

function mountNode(nodeId: string) {
  const node = document.createElement('div')
  node.dataset.nodeId = nodeId
  const body = document.createElement('div')
  body.tabIndex = 0
  node.append(body)
  document.body.append(node)
  onTestFinished(() => node.remove())
  return body
}

function mountWidget() {
  const store = useWidgetHistoryStore()
  const travel = vi.fn()
  onTestFinished(
    store.registerTraveler({
      scope: () => scope,
      canTravel: (direction) =>
        direction === 'undo' ? store.canUndo(scope) : store.canRedo(scope),
      travel
    })
  )
  store.record(scope, 'before')
  return travel
}

describe(travelFocusedNodeHistory, () => {
  it('undoes the widget step of the node that holds focus', () => {
    const travel = mountWidget()
    mountNode('7').focus()

    expect(travelFocusedNodeHistory('undo')).toBe(true)
    expect(travel).toHaveBeenCalledExactlyOnceWith('undo')
  })

  it.for([
    { case: 'focus is on another node', focus: () => mountNode('8').focus() },
    { case: 'focus is outside any node', focus: () => document.body.focus() }
  ])('leaves the shortcut to graph history when $case', ({ focus }) => {
    const travel = mountWidget()
    focus()

    expect(travelFocusedNodeHistory('undo')).toBe(false)
    expect(travel).not.toHaveBeenCalled()
  })

  it('leaves the shortcut to graph history when the node has nothing to redo', () => {
    const travel = mountWidget()
    mountNode('7').focus()

    expect(travelFocusedNodeHistory('redo')).toBe(false)
    expect(travel).not.toHaveBeenCalled()
  })
})
