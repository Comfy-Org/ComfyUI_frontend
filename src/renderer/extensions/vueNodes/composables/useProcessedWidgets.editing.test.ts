import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { assert, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { useProcessedWidgets } from './useProcessedWidgets'

vi.mock(import('@/scripts/app'))

function pendingEdit() {
  const root = new LGraph()
  const first = new LGraphNode('First')
  const second = new LGraphNode('Second')
  root.add(first)
  root.add(second)
  const a = first.addWidget('number', 'value', 17, () => {})
  const b = second.addWidget('number', 'value', 29, () => {})
  first.addInput('value', 'FLOAT').widget = { name: 'value' }
  second.addOutput('value', 'FLOAT')
  assert.exists(a.widgetId)
  assert.exists(b.widgetId)
  const firstId = a.widgetId
  const secondId = b.widgetId
  vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(root)
  useCanvasStore().currentGraph = root
  const owner = shallowRef(first._state)
  const ids = shallowRef([firstId])
  const Probe = defineComponent({
    setup() {
      const { processedWidgets } = useProcessedWidgets(
        () => owner.value,
        () => ids.value
      )
      const initial = processedWidgets.value[0]
      assert.exists(initial)
      return () =>
        h('button', { onClick: () => initial.updateHandler(99) }, 'Finish edit')
    }
  })
  render(Probe)
  return { owner, ids, first, second, firstId, secondId }
}

describe('shared widget editing', () => {
  it('applies a retained update while its owner and local value are unchanged', async () => {
    const { firstId } = pendingEdit()

    await userEvent.click(screen.getByRole('button', { name: 'Finish edit' }))

    expect(useWidgetValueStore().getWidget(firstId)?.value).toBe(99)
  })

  it('rejects a retained update after a connection replaces its local value', async () => {
    const { first, second, firstId } = pendingEdit()
    second.connect(0, first, 0)

    await userEvent.click(screen.getByRole('button', { name: 'Finish edit' }))

    expect(useWidgetValueStore().getWidget(firstId)?.value).toBe(17)
  })
  it('rejects a retained update after its owner changes', async () => {
    const { owner, ids, second, firstId, secondId } = pendingEdit()
    owner.value = second._state
    ids.value = [secondId]

    await userEvent.click(screen.getByRole('button', { name: 'Finish edit' }))

    const store = useWidgetValueStore()
    expect([
      store.getWidget(firstId)?.value,
      store.getWidget(secondId)?.value
    ]).toEqual([17, 29])
  })

  it.for(['isReadOnly', 'isPickingNodes'] as const)(
    'rejects pending edits while %s is active',
    async (mode) => {
      const { firstId } = pendingEdit()
      useCanvasStore()[mode] = true

      await userEvent.click(screen.getByRole('button', { name: 'Finish edit' }))

      expect(useWidgetValueStore().getWidget(firstId)?.value).toBe(17)
    }
  )
})
