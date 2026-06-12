import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { UUID } from '@/utils/uuid'
import { widgetId } from '@/types/widgetId'

import { IS_CONTROL_WIDGET } from './controlWidgetMarker'
import { promoteWidgetControl } from './promoteWidgetControl'

const graphId = 'graph' as UUID
const hostTargetId = widgetId(graphId, 'host', 'seed')

function controlWidget(value: string): IBaseWidget {
  return {
    name: 'control_after_generate',
    type: 'combo',
    value,
    options: { values: ['fixed', 'increment', 'randomize'] },
    [IS_CONTROL_WIDGET]: true
  } as unknown as IBaseWidget
}

function filterWidget(value: string): IBaseWidget {
  return { name: 'control_filter_list', type: 'string', value } as IBaseWidget
}

function interiorWidget(linkedWidgets: IBaseWidget[]): IBaseWidget {
  return {
    name: 'seed',
    type: 'number',
    value: 1,
    linkedWidgets
  } as IBaseWidget
}

describe('promoteWidgetControl', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('mints a host-local control component seeded from the interior', () => {
    const store = useWidgetValueStore()
    promoteWidgetControl(
      hostTargetId,
      interiorWidget([controlWidget('increment')])
    )

    const control = store.getWidgetControl(hostTargetId)
    expect(control?.controlWidgetId).toBe(
      widgetId(graphId, 'host', 'seed:control')
    )
    expect(store.getWidget(control!.controlWidgetId)?.value).toBe('increment')
  })

  it('registers an independent filter when the interior has one', () => {
    const store = useWidgetValueStore()
    promoteWidgetControl(
      hostTargetId,
      interiorWidget([controlWidget('randomize'), filterWidget('cat')])
    )

    const control = store.getWidgetControl(hostTargetId)
    expect(control?.filterWidgetId).toBe(
      widgetId(graphId, 'host', 'seed:control_filter')
    )
    expect(store.getWidget(control!.filterWidgetId!)?.value).toBe('cat')
  })

  it('keeps the host control independent of the interior after promotion', () => {
    const store = useWidgetValueStore()
    const interior = controlWidget('randomize')
    promoteWidgetControl(hostTargetId, interiorWidget([interior]))

    const control = store.getWidgetControl(hostTargetId)!
    store.setValue(control.controlWidgetId, 'fixed')

    expect(store.getWidget(control.controlWidgetId)?.value).toBe('fixed')
    expect(interior.value).toBe('randomize')
  })

  it('clears any existing control when the interior has none', () => {
    const store = useWidgetValueStore()
    promoteWidgetControl(hostTargetId, interiorWidget([controlWidget('fixed')]))
    expect(store.getWidgetControl(hostTargetId)).toBeDefined()

    promoteWidgetControl(hostTargetId, interiorWidget([]))
    expect(store.getWidgetControl(hostTargetId)).toBeUndefined()
  })
})
