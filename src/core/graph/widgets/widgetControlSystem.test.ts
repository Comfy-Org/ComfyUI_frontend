import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

import { runWidgetControl } from './widgetControlSystem'

const controlMode = vi.hoisted(() => ({ value: 'after' as 'before' | 'after' }))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) =>
      key === 'Comfy.WidgetControlMode' ? controlMode.value : undefined
  })
}))

const GRAPH = 'graph'

function seedSetup(
  mode: string,
  { value = 1 }: { value?: number } = {}
): { targetId: ReturnType<typeof widgetId> } {
  const store = useWidgetValueStore()
  const targetId = widgetId(GRAPH, '1', 'seed')
  const controlId = widgetId(GRAPH, '1', 'control_after_generate')
  store.registerWidget(targetId, {
    type: 'number',
    value,
    options: { min: 0, max: 1_000_000, step2: 1 }
  })
  store.registerWidget(controlId, {
    type: 'combo',
    value: mode,
    options: {}
  })
  store.registerWidgetControl(targetId, { controlWidgetId: controlId })
  return { targetId }
}

describe('runWidgetControl', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    controlMode.value = 'after'
  })

  it('increments a controlled value after queueing', () => {
    const store = useWidgetValueStore()
    const { targetId } = seedSetup('increment')

    runWidgetControl(GRAPH, 'after')

    expect(store.getWidget(targetId)?.value).toBe(2)
  })

  it('leaves the value unchanged when the mode is fixed', () => {
    const store = useWidgetValueStore()
    const { targetId } = seedSetup('fixed')

    runWidgetControl(GRAPH, 'after')

    expect(store.getWidget(targetId)?.value).toBe(1)
  })

  it('does not run on a target whose input is link-fed', () => {
    const store = useWidgetValueStore()
    const { targetId } = seedSetup('increment')
    store.setInputLinked(targetId, true)

    runWidgetControl(GRAPH, 'after')

    expect(store.getWidget(targetId)?.value).toBe(1)
  })

  it('does not run during partial execution', () => {
    const store = useWidgetValueStore()
    const { targetId } = seedSetup('increment')

    runWidgetControl(GRAPH, 'after', { isPartialExecution: true })

    expect(store.getWidget(targetId)?.value).toBe(1)
  })

  it('skips the first queue in before mode, then advances', () => {
    controlMode.value = 'before'
    const store = useWidgetValueStore()
    const { targetId } = seedSetup('increment')

    runWidgetControl(GRAPH, 'before')
    expect(store.getWidget(targetId)?.value).toBe(1)

    runWidgetControl(GRAPH, 'before')
    expect(store.getWidget(targetId)?.value).toBe(2)
  })

  it('ignores after-phase work when in before mode', () => {
    controlMode.value = 'before'
    const store = useWidgetValueStore()
    const { targetId } = seedSetup('increment')

    runWidgetControl(GRAPH, 'after')

    expect(store.getWidget(targetId)?.value).toBe(1)
  })

  it('applies a combo filter when advancing a combo value', () => {
    const store = useWidgetValueStore()
    const targetId = widgetId(GRAPH, '1', 'ckpt')
    const controlId = widgetId(GRAPH, '1', 'control_after_generate')
    const filterId = widgetId(GRAPH, '1', 'control_filter_list')
    store.registerWidget(targetId, {
      type: 'combo',
      value: 'a.safetensors',
      options: { values: ['a.safetensors', 'b.ckpt', 'c.safetensors'] }
    })
    store.registerWidget(controlId, {
      type: 'combo',
      value: 'increment',
      options: {}
    })
    store.registerWidget(filterId, {
      type: 'string',
      value: 'safetensors',
      options: {}
    })
    store.registerWidgetControl(targetId, {
      controlWidgetId: controlId,
      filterWidgetId: filterId
    })

    runWidgetControl(GRAPH, 'after')

    expect(store.getWidget(targetId)?.value).toBe('c.safetensors')
  })

  it('only advances controls belonging to the queued graph', () => {
    const store = useWidgetValueStore()
    const { targetId } = seedSetup('increment')
    const otherTarget = widgetId('other-graph', '1', 'seed')
    const otherControl = widgetId('other-graph', '1', 'control_after_generate')
    store.registerWidget(otherTarget, {
      type: 'number',
      value: 1,
      options: { min: 0, max: 1_000_000, step2: 1 }
    })
    store.registerWidget(otherControl, {
      type: 'combo',
      value: 'increment',
      options: {}
    })
    store.registerWidgetControl(otherTarget, { controlWidgetId: otherControl })

    runWidgetControl(GRAPH, 'after')

    expect(store.getWidget(targetId)?.value).toBe(2)
    expect(store.getWidget(otherTarget)?.value).toBe(1)
  })

  it('preserves the before-mode skip across re-registration', () => {
    controlMode.value = 'before'
    const store = useWidgetValueStore()
    const { targetId } = seedSetup('increment')
    const controlId = widgetId(GRAPH, '1', 'control_after_generate')

    runWidgetControl(GRAPH, 'before')
    expect(store.getWidget(targetId)?.value).toBe(1)

    store.registerWidgetControl(targetId, { controlWidgetId: controlId })

    runWidgetControl(GRAPH, 'before')
    expect(store.getWidget(targetId)?.value).toBe(2)
  })

  it('skips a target whose control widget has an invalid mode string', () => {
    const store = useWidgetValueStore()
    const { targetId } = seedSetup('not-a-valid-mode')

    runWidgetControl(GRAPH, 'after')

    // Value should remain unchanged since 'not-a-valid-mode' is not a ValueControlMode
    expect(store.getWidget(targetId)?.value).toBe(1)
  })

  it('skips a target whose control widget is missing from the store', () => {
    const store = useWidgetValueStore()
    const targetId = widgetId(GRAPH, '1', 'seed')
    const missingControlId = widgetId(GRAPH, '1', 'nonexistent_control')
    store.registerWidget(targetId, {
      type: 'number',
      value: 5,
      options: { min: 0, max: 100, step2: 1 }
    })
    store.registerWidgetControl(targetId, { controlWidgetId: missingControlId })

    runWidgetControl(GRAPH, 'after')

    expect(store.getWidget(targetId)?.value).toBe(5)
  })

  it('decrements a controlled value after queueing', () => {
    const store = useWidgetValueStore()
    const { targetId } = seedSetup('decrement', { value: 5 })

    runWidgetControl(GRAPH, 'after')

    expect(store.getWidget(targetId)?.value).toBe(4)
  })

  it('ignores a non-string filter widget value', () => {
    const store = useWidgetValueStore()
    const targetId = widgetId(GRAPH, '1', 'ckpt')
    const controlId = widgetId(GRAPH, '1', 'control_after_generate')
    const filterId = widgetId(GRAPH, '1', 'control_filter_list')
    store.registerWidget(targetId, {
      type: 'combo',
      value: 'a',
      options: { values: ['a', 'b', 'c'] }
    })
    store.registerWidget(controlId, {
      type: 'combo',
      value: 'increment',
      options: {}
    })
    // Register filter with a numeric (non-string) value
    store.registerWidget(filterId, {
      type: 'number',
      value: 42,
      options: {}
    })
    store.registerWidgetControl(targetId, {
      controlWidgetId: controlId,
      filterWidgetId: filterId
    })

    runWidgetControl(GRAPH, 'after')

    // Non-string filter is ignored, so increment advances normally from 'a' to 'b'
    expect(store.getWidget(targetId)?.value).toBe('b')
  })

  it('advances multiple independent controls in the same graph', () => {
    const store = useWidgetValueStore()
    const { targetId: target1 } = seedSetup('increment', { value: 10 })
    const target2 = widgetId(GRAPH, '2', 'cfg')
    const control2 = widgetId(GRAPH, '2', 'control_after_generate')
    store.registerWidget(target2, {
      type: 'number',
      value: 20,
      options: { min: 0, max: 100, step2: 5 }
    })
    store.registerWidget(control2, {
      type: 'combo',
      value: 'decrement',
      options: {}
    })
    store.registerWidgetControl(target2, { controlWidgetId: control2 })

    runWidgetControl(GRAPH, 'after')

    expect(store.getWidget(target1)?.value).toBe(11)
    expect(store.getWidget(target2)?.value).toBe(15)
  })
})
