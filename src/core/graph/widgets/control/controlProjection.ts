import type {
  IBaseWidget,
  IComboWidget,
  IStringWidget
} from '@/lib/litegraph/src/types/widgets'
import { widgetControlLabel } from '@/lib/litegraph/src/widgetControlLabel'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import {
  COMBO_CONTROL_MODES,
  isValueControlMode,
  NUMBER_CONTROL_MODES
} from './valueControl'

const modeProjectionCache = new WeakMap<IBaseWidget, IComboWidget>()
const filterProjectionCache = new WeakMap<IBaseWidget, IStringWidget>()

function createModeProjection(target: IBaseWidget): IComboWidget {
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
      return target.widgetId
        ? (store.getWidgetControl(target.widgetId)?.mode ??
            target.controlConfig?.mode ??
            'fixed')
        : (target.controlConfig?.mode ?? 'fixed')
    },
    set value(value) {
      if (isValueControlMode(value)) {
        if (target.controlConfig) target.controlConfig.mode = value
        if (target.widgetId) {
          store.updateWidgetControl(target.widgetId, { mode: value })
        }
      }
    },
    callback(value) {
      if (isValueControlMode(value)) {
        this.value = value
      }
    }
  }
}

function createFilterProjection(target: IBaseWidget): IStringWidget {
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
      return target.widgetId
        ? (store.getWidgetControl(target.widgetId)?.filter ??
            target.controlConfig?.filter ??
            '')
        : (target.controlConfig?.filter ?? '')
    },
    set value(value) {
      const filter = String(value)
      if (target.controlConfig) target.controlConfig.filter = filter
      if (target.widgetId) {
        store.updateWidgetControl(target.widgetId, { filter })
      }
    },
    callback(value) {
      this.value = String(value)
    }
  }
}

export function getControlProjections(
  target: IBaseWidget
): [] | [IComboWidget, ...IStringWidget[]] {
  const control = target.widgetId
    ? useWidgetValueStore().getWidgetControl(target.widgetId)
    : undefined
  if (!control && !target.controlConfig) return []

  let mode = modeProjectionCache.get(target)
  if (!mode) {
    mode = createModeProjection(target)
    modeProjectionCache.set(target, mode)
  }
  if (control?.filter === undefined && !target.controlConfig?.hasFilter) {
    return [mode]
  }

  let filter = filterProjectionCache.get(target)
  if (!filter) {
    filter = createFilterProjection(target)
    filterProjectionCache.set(target, filter)
  }
  return [mode, filter]
}
