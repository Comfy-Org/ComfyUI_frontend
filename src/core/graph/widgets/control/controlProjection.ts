import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { t } from '@/i18n'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'

import { COMBO_CONTROL_MODES, NUMBER_CONTROL_MODES } from './valueControl'

const projectionCache = new WeakMap<LGraphNode, Map<string, IBaseWidget>>()

function getCache(node: LGraphNode): Map<string, IBaseWidget> {
  let cache = projectionCache.get(node)
  if (!cache) {
    cache = new Map()
    projectionCache.set(node, cache)
  }
  return cache
}

function createModeProjection(
  targetId: WidgetId,
  isCombo: boolean
): IBaseWidget {
  const store = useWidgetValueStore()
  return {
    type: 'combo',
    name: 'control_after_generate',
    options: {
      values: [...(isCombo ? COMBO_CONTROL_MODES : NUMBER_CONTROL_MODES)],
      serialize: false
    },
    serialize: false,
    y: 0,
    get label() {
      return t('g.control_after_generate')
    },
    get value() {
      return store.getWidgetControl(targetId)?.mode ?? 'fixed'
    },
    callback(next) {
      store.setControlMode(targetId, next as never)
    }
  } as IBaseWidget
}

function createFilterProjection(targetId: WidgetId): IBaseWidget {
  const store = useWidgetValueStore()
  return {
    type: 'string',
    name: 'control_filter_list',
    options: { serialize: false },
    serialize: false,
    y: 0,
    get value() {
      return store.getWidgetControl(targetId)?.filter ?? ''
    },
    callback(next) {
      store.setControlFilter(targetId, String(next))
    }
  } as IBaseWidget
}

/**
 * Render-only widgets for a target's control component, drawn on the classic
 * canvas without ever entering `node.widgets`. Cached per node so layout fields
 * (`y`, `last_y`) persist across arrange/draw/hit-test.
 */
export function getControlProjections(
  node: LGraphNode,
  target: IBaseWidget
): IBaseWidget[] {
  const targetId = target.widgetId
  if (!targetId) return []

  const control = useWidgetValueStore().getWidgetControl(targetId)
  if (!control) return []

  const cache = getCache(node)
  const modeKey = `${targetId}:mode`
  let mode = cache.get(modeKey)
  if (!mode) {
    mode = createModeProjection(targetId, target.type === 'combo')
    cache.set(modeKey, mode)
  }
  if (control.filter === undefined) return [mode]

  const filterKey = `${targetId}:filter`
  let filter = cache.get(filterKey)
  if (!filter) {
    filter = createFilterProjection(targetId)
    cache.set(filterKey, filter)
  }
  return [mode, filter]
}
