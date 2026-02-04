import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { useWidget } from './useWidget'

describe('useWidget', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('returns undefined widget when not registered', () => {
    const { widget, value, isHidden, isDisabled, isAdvanced, isPromoted } =
      useWidget(1, 'test_widget')

    expect(widget.value).toBeUndefined()
    expect(value.value).toBeUndefined()
    expect(isHidden.value).toBe(false)
    expect(isDisabled.value).toBe(false)
    expect(isAdvanced.value).toBe(false)
    expect(isPromoted.value).toBe(false)
  })

  it('returns widget state when registered', () => {
    const store = useWidgetValueStore()
    store.registerWidget(1, 'test_widget', 'text', 'initial_value', {
      hidden: true,
      advanced: true,
      label: 'Custom Label'
    })

    const { widget, value, isHidden, isAdvanced, label } = useWidget(
      1,
      'test_widget'
    )

    expect(widget.value).toBeDefined()
    expect(value.value).toBe('initial_value')
    expect(isHidden.value).toBe(true)
    expect(isAdvanced.value).toBe(true)
    expect(label.value).toBe('Custom Label')
  })

  it('allows setting value through writable computed', () => {
    const store = useWidgetValueStore()
    store.registerWidget(1, 'test_widget', 'number', 42)

    const { value } = useWidget(1, 'test_widget')

    expect(value.value).toBe(42)

    value.value = 100
    expect(store.getWidget(1, 'test_widget')?.value).toBe(100)
  })

  it('reacts to nodeId ref changes', () => {
    const store = useWidgetValueStore()
    store.registerWidget(1, 'shared_widget', 'text', 'node1_value')
    store.registerWidget(2, 'shared_widget', 'text', 'node2_value')

    const nodeId = ref<NodeId>(1)
    const { value } = useWidget(nodeId, 'shared_widget')

    expect(value.value).toBe('node1_value')

    nodeId.value = 2
    expect(value.value).toBe('node2_value')
  })

  it('reacts to widgetName ref changes', () => {
    const store = useWidgetValueStore()
    store.registerWidget(1, 'widget_a', 'text', 'value_a')
    store.registerWidget(1, 'widget_b', 'text', 'value_b')

    const widgetName = ref('widget_a')
    const { value } = useWidget(1, widgetName)

    expect(value.value).toBe('value_a')

    widgetName.value = 'widget_b'
    expect(value.value).toBe('value_b')
  })

  it('reacts to store state changes', () => {
    const store = useWidgetValueStore()
    store.registerWidget(1, 'test_widget', 'toggle', false)

    const { value, isHidden } = useWidget(1, 'test_widget')

    expect(value.value).toBe(false)
    expect(isHidden.value).toBe(false)

    store.getWidget(1, 'test_widget')!.value = true
    expect(value.value).toBe(true)

    store.setHidden(1, 'test_widget', true)
    expect(isHidden.value).toBe(true)
  })

  it('returns correct disabled and promoted states', () => {
    const store = useWidgetValueStore()
    store.registerWidget(1, 'test_widget', 'text', 'value', {
      disabled: true,
      promoted: true
    })

    const { isDisabled, isPromoted } = useWidget(1, 'test_widget')

    expect(isDisabled.value).toBe(true)
    expect(isPromoted.value).toBe(true)
  })
})
