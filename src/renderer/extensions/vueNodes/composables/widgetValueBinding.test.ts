import { assert, describe, expect, it } from 'vitest'

import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { createWidgetValueBinding } from './widgetValueBinding'

describe('shared widget value bindings', () => {
  it('rejects pending value and control updates after the source becomes linked', () => {
    const store = useWidgetValueStore()
    const id = widgetId('binding-test', toNodeId(17), 'value')
    const state = store.registerWidget(id, {
      type: 'number',
      value: 17,
      options: {}
    })
    assert.exists(state)
    let linked = false
    let control = 'fixed'
    const binding = createWidgetValueBinding({
      id,
      state,
      nodeExecId: null,
      linked: () => linked,
      controlWidget: {
        value: 'fixed',
        update: (value) => {
          control = String(value)
        }
      }
    })
    linked = true

    binding.updateHandler(99)
    binding.controlWidget?.update('increment')

    expect([state.value, control]).toEqual([17, 'fixed'])
  })
  it('applies the same current-target guard to values and value-control actions', () => {
    const store = useWidgetValueStore()
    const id = widgetId('binding-test', toNodeId(17), 'value')
    const controlId = widgetId('binding-test', toNodeId(17), 'control')
    const state = store.registerWidget(id, {
      type: 'number',
      value: 17,
      options: {}
    })
    store.registerWidget(controlId, {
      type: 'combo',
      value: 'fixed',
      options: {}
    })
    assert.exists(state)
    let current = true
    const binding = createWidgetValueBinding({
      id,
      state,
      nodeExecId: null,
      linked: () => false,
      canUpdate: () => current,
      controlWidget: {
        value: 'fixed',
        update: (value) => {
          store.setValue(controlId, value)
        }
      }
    })
    assert.exists(binding.controlWidget)
    binding.controlWidget.update('increment')
    current = false

    binding.controlWidget.update('decrement')
    binding.updateHandler(99)

    expect([
      store.getWidget(id)?.value,
      store.getWidget(controlId)?.value
    ]).toEqual([17, 'increment'])
  })

  it('rejects a retained edit after another widget occupies the same ID', () => {
    const store = useWidgetValueStore()
    const id = widgetId('binding-test', toNodeId(17), 'value')
    const state = store.registerWidget(id, {
      type: 'number',
      value: 17,
      options: {}
    })
    assert.exists(state)
    const binding = createWidgetValueBinding({
      id,
      state,
      nodeExecId: null,
      linked: () => false
    })
    store.deleteWidget(id)
    store.registerWidget(id, { type: 'number', value: 29, options: {} })

    binding.updateHandler(99)

    expect(store.getWidget(id)?.value).toBe(29)
  })
})
