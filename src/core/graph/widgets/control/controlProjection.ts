import type {
  IBaseWidget,
  IComboWidget,
  IStringWidget
} from '@comfyorg/graph-model/widgets'
import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'
import { t } from '@/i18n'
import { emitGraphIntent } from '@/lib/litegraph/src/graphIntents'
import {
  ensureUniqueWidgetNames,
  parseWidgetId
} from '@comfyorg/graph-model/widgetId'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import {
  COMBO_CONTROL_MODES,
  isValueControlMode,
  NUMBER_CONTROL_MODES
} from './valueControl'

const modeProjectionCache = new WeakMap<IBaseWidget, IComboWidget>()
const filterProjectionCache = new WeakMap<IBaseWidget, IStringWidget>()
const projectionNames = new WeakMap<
  IBaseWidget,
  { requested: string; resolved: string; get: () => string }
>()

function trackProjectionName(projection: IBaseWidget): void {
  const state = {
    requested: projection.name,
    resolved: projection.name,
    get: () => state.resolved
  }
  projectionNames.set(projection, state)
  Object.defineProperty(projection, 'name', {
    configurable: true,
    enumerable: true,
    get: state.get,
    set(name: string) {
      state.requested = name
      state.resolved = name
    }
  })
}

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
  const projection: IComboWidget = {
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
      return useSettingStore().get('Comfy.WidgetControlMode') === 'before'
        ? t('g.control_before_generate')
        : t('g.control_after_generate')
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
        projection.value = value
      }
    }
  }
  trackProjectionName(projection)
  return projection
}

function createFilterProjection(target: IBaseWidget): IStringWidget {
  const store = useWidgetValueStore()
  const projection: IStringWidget = {
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
      projection.value = String(value)
    }
  }
  trackProjectionName(projection)
  return projection
}

function getCachedControlProjections(
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
  const hasFilter = control
    ? control.filter !== undefined
    : target.controlConfig?.hasFilter
  if (!hasFilter) {
    return [mode]
  }

  let filter = filterProjectionCache.get(target)
  if (!filter) {
    filter = createFilterProjection(target)
    filterProjectionCache.set(target, filter)
  }
  return [mode, filter]
}

export function getControlProjectionBatch(widgets: readonly IBaseWidget[]) {
  const batch = new Map(
    widgets.map((widget) => [widget, getCachedControlProjections(widget)])
  )
  const projections = [...batch.values()].flat()
  const names = projections.map((projection) => {
    const state = projectionNames.get(projection)
    const tracked =
      state &&
      Object.getOwnPropertyDescriptor(projection, 'name')?.get === state.get
    return tracked ? { name: state.requested } : projection
  })
  ensureUniqueWidgetNames([...widgets.map(({ name }) => ({ name })), ...names])
  projections.forEach((projection, index) => {
    const state = projectionNames.get(projection)
    if (state && names[index] !== projection) {
      state.resolved = names[index].name
    }
  })
  return batch
}

export function getControlProjections(
  target: IBaseWidget & { readonly node?: Pick<LGraphNode, 'widgets'> },
  widgets = target.node?.widgets ?? [target]
): [] | [IComboWidget, ...IStringWidget[]] {
  return (
    getControlProjectionBatch(widgets).get(target) ??
    getCachedControlProjections(target)
  )
}
