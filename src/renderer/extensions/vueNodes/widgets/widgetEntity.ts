import { getActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { computed, hasInjectionContext, inject, toRaw, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'

import { buildPromotedSourceExecutionId } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import { normalizeControlOption } from '@/core/graph/widgets/controlWidget'
import type { SafeControlWidget } from '@/core/graph/widgets/controlWidget'
import { resolveDynamicInputSpec } from '@/core/graph/widgets/dynamicInputSpec'
import type { LinkedUpstreamInfo } from '@/composables/useUpstreamValue'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useApp } from '@/scripts/appInstance'
import { AdvancedWidgetRingKey } from '@/types/widgetTypes'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { executionIdFromState } from '@/utils/graphTraversalUtil'
import { mapLiveWidgetsById } from '@/utils/litegraphUtil'
import {
  toOwningGraphId,
  toRootGraphId
} from '@comfyorg/graph-model/graphScopeId'
import {
  createNodeExecutionId,
  createNodeLocatorId
} from '@comfyorg/graph-model/nodeIdentification'
import type {
  NodeExecutionId,
  NodeLocatorId
} from '@comfyorg/graph-model/nodeIdentification'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { parseWidgetId, widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetValue } from '@comfyorg/graph-model/widgetValue'
import type { IBaseWidget, IWidgetOptions } from '@comfyorg/graph-model/widgets'
import { transformInputSpecV1ToV2 } from '@comfyorg/object-info-parser/migration'
import type { InputSpec as InputSpecV2 } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'

export interface WidgetErrorTarget {
  executionId: NodeExecutionId
  widgetName: string
}

function cachedPerPinia<TStore>(useStore: () => TStore): () => TStore {
  const stores = new WeakMap<Pinia, TStore>()
  return () => {
    const pinia = getActivePinia()
    if (!pinia) return useStore()
    let store = stores.get(pinia)
    if (!store) {
      store = useStore()
      stores.set(pinia, store)
    }
    return store
  }
}

const widgetStore = cachedPerPinia(useWidgetValueStore)
const nodeStore = cachedPerPinia(useNodeDataStore)
const linkStore = cachedPerPinia(useLinkStore)
const nodeDefStore = cachedPerPinia(useNodeDefStore)

const NO_OPTIONS: IWidgetOptions = Object.freeze({})

const inputSlotIndexes = new WeakMap<
  NodeState,
  ComputedRef<ReadonlyMap<string, number>>
>()

function hostState(id: WidgetId): NodeState | undefined {
  const { graphId, nodeId } = parseWidgetId(id)
  return nodeStore().getNode(graphId, nodeId)
}

function inputSlotIndex(state: NodeState): ReadonlyMap<string, number> {
  const raw = toRaw(state)
  let index = inputSlotIndexes.get(raw)
  if (!index) {
    index = computed(() => {
      const byName = new Map<string, number>()
      for (const [slot, input] of state.inputs.entries()) {
        const name =
          input.widget?.name ||
          (input.widgetId !== undefined ? input.name : undefined)
        if (name !== undefined && !byName.has(name)) byName.set(name, slot)
      }
      return byName
    })
    inputSlotIndexes.set(raw, index)
  }
  return index.value
}

function liveRootGraph(id: WidgetId): LGraph | undefined {
  const app = useApp()
  if (!app.isGraphReady) return undefined
  return app.rootGraph.id === parseWidgetId(id).graphId
    ? app.rootGraph
    : undefined
}

function findLiveWidget(node: LGraphNode, id: WidgetId) {
  const { name } = parseWidgetId(id)
  return node.widgets?.find(
    (candidate) => candidate.name === name && candidate.widgetId === id
  )
}

/** The live litegraph node and widget behind a widget id, for writes only. */
export function widgetLive(
  id: WidgetId
): { node: LGraphNode; widget: IBaseWidget } | undefined {
  const rootGraph = liveRootGraph(id)
  const state = hostState(id)
  if (!rootGraph || !state) return undefined
  const graph =
    state.graphId === rootGraph.id
      ? rootGraph
      : rootGraph.subgraphs.get(state.graphId)
  const node = graph?.getNodeById(state.id)
  if (!node) return undefined
  const widget = findLiveWidget(node, id) ?? mapLiveWidgetsById(node).get(id)
  return widget ? { node, widget } : undefined
}

/** The widget's display name, falling back to the name in its id. */
export function widgetName(id: WidgetId): string {
  return widgetStore().getWidget(id)?.name ?? parseWidgetId(id).name
}

export function widgetLabel(id: WidgetId): string | undefined {
  return widgetStore().getWidget(id)?.label
}

export function widgetType(id: WidgetId): string | undefined {
  return widgetStore().getWidget(id)?.type
}

/** The ring class for an advanced widget in a grid that rings them. */
export function useWidgetBorderStyle(
  id: MaybeRefOrGetter<WidgetId>
): ComputedRef<string | undefined> {
  const ringsAdvanced =
    hasInjectionContext() && inject(AdvancedWidgetRingKey, false)
  return computed(() =>
    ringsAdvanced && widgetIsAdvanced(toValue(id))
      ? 'ring ring-primary'
      : undefined
  )
}

export function widgetValue(id: WidgetId): WidgetValue {
  return widgetStore().getWidget(id)?.value
}

function widgetInputLink(id: WidgetId) {
  const state = hostState(id)
  if (!state) return undefined
  const slot = inputSlotIndex(state).get(widgetName(id))
  if (slot === undefined) return undefined
  const { graphId } = parseWidgetId(id)
  return linkStore().getInputSlotLink(
    {
      rootGraphId: toRootGraphId(graphId),
      owningGraphId: toOwningGraphId(state.graphId)
    },
    state.id,
    slot
  )
}

/** The upstream node and output feeding the widget's input, if linked. */
export function widgetLinkedUpstream(
  id: WidgetId
): LinkedUpstreamInfo | undefined {
  const link = widgetInputLink(id)
  if (!link) return undefined
  const origin = nodeStore().getNode(
    parseWidgetId(id).graphId,
    link.originNodeId
  )
  return {
    nodeId: link.originNodeId,
    outputName: origin?.outputs[link.originSlot]?.name
  }
}

/** The widget's options, disabled while its input is linked. */
export function widgetOptions(id: WidgetId): IWidgetOptions {
  const state = widgetStore().getWidget(id)
  if (!state) return NO_OPTIONS
  const options = { ...state.options }
  if (state.disabled || widgetInputLink(id)) options.disabled = true
  return options
}

function widgetIsAdvanced(id: WidgetId): boolean {
  const store = widgetStore()
  const visibility = store.getWidgetVisibility(id)
  return visibility
    ? visibility.surfaces.vueNode === 'advanced'
    : (store.getWidget(id)?.options.advanced ?? false)
}

function widgetPromotion(id: WidgetId) {
  return widgetStore().getWidgetRenderState(id)?.promotion
}

/** The interior widget a promoted widget's errors are reported against. */
export function widgetErrorTarget(
  id: WidgetId,
  render = widgetStore().getWidgetRenderState(id)
): WidgetErrorTarget | undefined {
  const promotion = render?.promotion
  const hostExecutionId = promotion && widgetNodeExecutionId(id)
  const executionId =
    hostExecutionId &&
    buildPromotedSourceExecutionId(hostExecutionId, promotion.nodePath)
  return executionId
    ? {
        executionId,
        widgetName: parseWidgetId(promotion.sourceWidgetId).name
      }
    : undefined
}

/** The control-after-generate widget attached to the widget, if any. */
export function widgetControl(id: WidgetId): SafeControlWidget | undefined {
  const store = widgetStore()
  const sourceWidgetId = widgetPromotion(id)?.sourceWidgetId
  const controlId =
    store.getWidgetRenderState(id)?.control ??
    (sourceWidgetId && store.getWidgetRenderState(sourceWidgetId)?.control)
  const control = controlId && store.getWidget(controlId)
  if (!controlId || !control) return undefined
  return {
    value: normalizeControlOption(control.value),
    update: (value) => store.setValue(controlId, normalizeControlOption(value))
  }
}

function ownNodeLocatorId(id: WidgetId): NodeLocatorId | undefined {
  const { graphId, nodeId } = parseWidgetId(id)
  if (String(nodeId).includes(':')) return undefined
  const owningGraphId = hostState(id)?.graphId
  return createNodeLocatorId(
    owningGraphId && owningGraphId !== graphId ? owningGraphId : null,
    nodeId
  )
}

/** The node the widget edits, through any subgraph promotion. */
export function widgetNodeLocatorId(id: WidgetId): NodeLocatorId | undefined {
  const sourceWidgetId = widgetPromotion(id)?.sourceWidgetId
  return (
    (sourceWidgetId && ownNodeLocatorId(sourceWidgetId)) || ownNodeLocatorId(id)
  )
}

function nodeDefInputSpec(
  id: WidgetId,
  type: string | undefined
): InputSpecV2 | undefined {
  const nodeDef = type ? nodeDefStore().nodeDefsByName[type] : undefined
  if (!nodeDef) return undefined
  const { graphId, nodeId, name } = parseWidgetId(id)
  if (Object.hasOwn(nodeDef.inputs, name)) return nodeDef.inputs[name]
  const store = widgetStore()
  const resolved = resolveDynamicInputSpec(
    nodeDef.input,
    name,
    (sibling) => store.getWidget(widgetId(graphId, nodeId, sibling))?.value
  )
  return (
    resolved &&
    transformInputSpecV1ToV2(resolved.spec, {
      name,
      isOptional: resolved.isOptional
    })
  )
}

/** The input spec the widget was created from. */
export function widgetSpec(
  id: WidgetId,
  render = widgetStore().getWidgetRenderState(id),
  hostType = hostState(id)?.type
): InputSpecV2 | undefined {
  if (render?.spec) return render.spec
  if (render?.promotion) return widgetSpec(render.promotion.sourceWidgetId)
  return nodeDefInputSpec(id, hostType)
}

function widgetNodeExecutionId(id: WidgetId): NodeExecutionId | null {
  const rootGraph = liveRootGraph(id)
  const state = hostState(id)
  if (!rootGraph || !state)
    return createNodeExecutionId([parseWidgetId(id).nodeId])
  return executionIdFromState(rootGraph, state)
}

function normalizeWidgetValue(value: unknown): WidgetValue {
  if (value === undefined || value === null) return value
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'object'
  )
    return value
  console.warn(`Invalid widget value type: ${typeof value}`, value)
  return undefined
}

/** Writes a value from the UI: store, live widget callback, and stale errors. */
export function setWidgetValue(id: WidgetId, value: WidgetValue): void {
  const store = widgetStore()
  if (!store.getWidget(id)) return
  store.setValue(id, value)
  const live = widgetLive(id)
  if (live) {
    const normalized = normalizeWidgetValue(value)
    live.widget.value = normalized
    live.widget.callback?.(normalized, useApp().canvas, live.node)
    live.node.widgets?.forEach((w) => w.triggerDraw?.())
  }

  const { min, max } = widgetOptions(id)
  const executionErrorStore = useExecutionErrorStore()
  const errorTarget = widgetErrorTarget(id)
  if (errorTarget)
    executionErrorStore.clearWidgetRelatedErrors(
      errorTarget.executionId,
      errorTarget.widgetName,
      errorTarget.widgetName,
      value,
      { min, max }
    )
  const nodeExecId = widgetNodeExecutionId(id)
  const name = widgetName(id)
  if (nodeExecId)
    executionErrorStore.clearWidgetRelatedErrors(
      nodeExecId,
      name,
      name,
      value,
      {
        min,
        max
      }
    )
}
