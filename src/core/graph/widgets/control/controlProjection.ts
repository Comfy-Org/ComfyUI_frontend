import type {
  IBaseWidget,
  IComboWidget,
  IStringWidget
} from '@comfyorg/graph-model/widgets'
import { t } from '@/i18n'
import { widgetControlLabel } from '@/lib/litegraph/src/widgetControlLabel'
import { emitGraphIntent } from '@/lib/litegraph/src/graphIntents'
import { parseWidgetId } from '@comfyorg/graph-model/widgetId'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import {
  COMBO_CONTROL_MODES,
  isValueControlMode,
  NUMBER_CONTROL_MODES
} from './valueControl'

const modeProjectionCache = new WeakMap<IBaseWidget, IComboWidget>()
const filterProjectionCache = new WeakMap<IBaseWidget, IStringWidget>()

function announceControlValue(
  target: IBaseWidget,
  control: IBaseWidget,
  previous: unknown
): void {
  if (!target.widgetId) return
  const state = useWidgetValueStore().getWidget(target.widgetId)
  if (!state) return
  emitGraphIntent({
    type: 'set_widget',
    graphId: parseWidgetId(target.widgetId).graphId,
    nodeId: state.nodeId,
    name: control.name,
    value: control.value,
    previous
  })
}

export function announceControlValues(target: IBaseWidget): void {
  for (const control of getControlProjections(target)) {
    announceControlValue(target, control, undefined)
  }
}

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
    get tooltip() {
      return t('widgets.valueControl.modeTooltip')
    },
    y: 0,
    get visibility() {
      return target.visibility
    },
    get hidden() {
      return target.hidden
    },
    get advanced() {
      return target.advanced
    },
    get connectionSuppressed() {
      return target.connectionSuppressed
    },
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
        const previous = this.value
        if (target.controlConfig) target.controlConfig.mode = value
        if (target.widgetId) {
          store.updateWidgetControl(target.widgetId, { mode: value })
        }
        if (value !== previous) announceControlValue(target, this, previous)
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
    get tooltip() {
      return t('widgets.valueControl.filterTooltip')
    },
    y: 0,
    get visibility() {
      return target.visibility
    },
    get hidden() {
      return target.hidden
    },
    get advanced() {
      return target.advanced
    },
    get connectionSuppressed() {
      return target.connectionSuppressed
    },
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
      const previous = this.value
      const filter = value
      if (target.controlConfig) target.controlConfig.filter = filter
      if (target.widgetId) {
        store.updateWidgetControl(target.widgetId, { filter })
      }
      if (value !== previous) announceControlValue(target, this, previous)
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
