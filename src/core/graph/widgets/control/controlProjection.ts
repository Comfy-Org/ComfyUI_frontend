import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { widgetControlLabel } from '@/lib/litegraph/src/widgetControlLabel'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'

import {
  COMBO_CONTROL_MODES,
  isValueControlMode,
  NUMBER_CONTROL_MODES
} from './valueControl'

const projectionCache = new WeakMap<IBaseWidget, Map<string, IBaseWidget>>()

function getCache(target: IBaseWidget): Map<string, IBaseWidget> {
  const cached = projectionCache.get(target)
  if (cached) return cached
  const cache = new Map<string, IBaseWidget>()
  projectionCache.set(target, cache)
  return cache
}

function createModeProjection(
  targetId: WidgetId,
  target: IBaseWidget
): IBaseWidget {
  const store = useWidgetValueStore()
  return {
    type: 'combo',
    name: 'control_after_generate',
    options: {
      values:
        target.type === 'combo'
          ? [...COMBO_CONTROL_MODES]
          : [...NUMBER_CONTROL_MODES],
      serialize: false
    },
    serialize: false,
    tooltip:
      'Allows the linked widget to be changed automatically, for example randomizing the noise seed.',
    y: 0,
    get computedDisabled() {
      return target.computedDisabled
    },
    get label() {
      return widgetControlLabel()
    },
    get value() {
      return store.getWidgetControl(targetId)?.mode ?? 'fixed'
    },
    set value(value) {
      if (isValueControlMode(value)) {
        store.updateWidgetControl(targetId, { mode: value })
      }
    },
    callback(value) {
      if (isValueControlMode(value)) {
        store.updateWidgetControl(targetId, { mode: value })
      }
    }
  }
}

function createFilterProjection(
  targetId: WidgetId,
  target: IBaseWidget
): IBaseWidget {
  const store = useWidgetValueStore()
  return {
    type: 'string',
    name: 'control_filter_list',
    options: { serialize: false },
    serialize: false,
    tooltip:
      "Allows for filtering the list of values when changing the value via the control generate mode. Allows for RegEx matches in the format /abc/ to only filter to values containing 'abc'.",
    y: 0,
    get computedDisabled() {
      return target.computedDisabled
    },
    get value() {
      return store.getWidgetControl(targetId)?.filter ?? ''
    },
    set value(value) {
      store.updateWidgetControl(targetId, { filter: String(value) })
    },
    callback(value) {
      store.updateWidgetControl(targetId, { filter: String(value) })
    }
  }
}

export function getControlProjections(target: IBaseWidget): IBaseWidget[] {
  const targetId = target.widgetId
  if (!targetId) return []

  const control = useWidgetValueStore().getWidgetControl(targetId)
  if (!control) return []

  const cache = getCache(target)
  const modeKey = `${targetId}:mode`
  let mode = cache.get(modeKey)
  if (!mode) {
    mode = createModeProjection(targetId, target)
    cache.set(modeKey, mode)
  }
  if (control.filter === undefined) return [mode]

  const filterKey = `${targetId}:filter`
  let filter = cache.get(filterKey)
  if (!filter) {
    filter = createFilterProjection(targetId, target)
    cache.set(filterKey, filter)
  }
  return [mode, filter]
}
