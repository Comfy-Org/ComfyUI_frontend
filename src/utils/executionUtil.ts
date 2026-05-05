import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import type {
  ExecutableLGraphNode,
  ExecutionId,
  LGraph
} from '@/lib/litegraph/src/litegraph'
import {
  ExecutableNodeDTO,
  LGraphEventMode
} from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { usePromotionStore } from '@/stores/promotionStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { makeCompositeKey } from '@/utils/compositeKey'

import { ExecutableGroupNodeDTO, isGroupNode } from './executableGroupNodeDto'
import { compressWidgetInputSlots } from './litegraphUtil'

/**
 * Looks up the effective value for a flattened interior widget by walking the
 * ancestor SubgraphNode chain (outermost → innermost) and returning the first
 * per-instance promoted-widget override that targets this exact widget object.
 *
 * Mirrors the read semantics used by the Vue / canvas render paths so that
 * prompt-build does not desync from the on-screen value.
 */
function resolvePromotedWidgetOverride(
  node: ExecutableLGraphNode,
  widget: IBaseWidget
): { hit: true; value: unknown } | { hit: false } {
  if (!(node instanceof ExecutableNodeDTO)) return { hit: false }
  if (node.subgraphNodePath.length === 0) return { hit: false }

  const rootGraph = node.graph.rootGraph
  const hosts = rootGraph.resolveSubgraphIdPath(node.subgraphNodePath)
  const promotionStore = usePromotionStore()
  const widgetStore = useWidgetValueStore()

  for (const host of hosts) {
    const entries = promotionStore.getPromotionsRef(rootGraph.id, host.id)
    for (const entry of entries) {
      const resolved = resolveConcretePromotedWidget(
        host,
        entry.sourceNodeId,
        entry.sourceWidgetName,
        entry.disambiguatingSourceNodeId
      )
      if (resolved.status !== 'resolved') continue
      if (resolved.resolved.widget !== widget) continue

      const storeName = makeCompositeKey([
        entry.sourceNodeId,
        entry.sourceWidgetName,
        entry.disambiguatingSourceNodeId ?? ''
      ])
      const state = widgetStore.getWidget(rootGraph.id, host.id, storeName)
      if (state) return { hit: true, value: state.value }
    }
  }

  return { hit: false }
}

/**
 * Computes the value used for prompt serialization for a single widget.
 * Falls back to the standard `widget.serializeValue` / `widget.value` path,
 * but routes through the per-instance promoted override when one applies. When a
 * custom `serializeValue` is defined, it is invoked on a proxy widget whose
 * `.value` returns the override, preserving widget-specific serialization.
 */
async function getExecutableWidgetValue(
  node: ExecutableLGraphNode,
  widget: IBaseWidget,
  index: number
): Promise<unknown> {
  const override = resolvePromotedWidgetOverride(node, widget)

  if (!override.hit) {
    return widget.serializeValue
      ? await widget.serializeValue(node, index)
      : widget.value
  }

  if (!widget.serializeValue) return override.value

  const widgetProxy = Object.create(widget) as IBaseWidget
  Object.defineProperty(widgetProxy, 'value', {
    get: () => override.value,
    set: () => {},
    enumerable: true,
    configurable: true
  })
  return await widget.serializeValue.call(widgetProxy, node, index)
}

/**
 * Converts the current graph workflow for sending to the API.
 * @note Node widgets are updated before serialization to prepare queueing.
 *
 * @param graph The graph to convert.
 * @param options The options for the conversion.
 *  - `sortNodes`: Whether to sort the nodes by execution order.
 * @returns The workflow and node links
 */
export const graphToPrompt = async (
  graph: LGraph,
  options: { sortNodes?: boolean } = {}
): Promise<{ workflow: ComfyWorkflowJSON; output: ComfyApiWorkflow }> => {
  const { sortNodes = false } = options

  for (const node of graph.computeExecutionOrder(false)) {
    const innerNodes = node.getInnerNodes
      ? node.getInnerNodes(new Map())
      : [node]
    for (const innerNode of innerNodes) {
      if (innerNode.isVirtualNode) {
        innerNode.applyToGraph?.()
      }
    }
  }

  const workflow = graph.serialize({ sortNodes })

  // Remove localized_name from the workflow
  for (const node of workflow.nodes) {
    for (const slot of node.inputs ?? []) {
      delete slot.localized_name
    }
    for (const slot of node.outputs ?? []) {
      delete slot.localized_name
    }
  }

  compressWidgetInputSlots(workflow)
  workflow.extra ??= {}
  workflow.extra.frontendVersion = __COMFYUI_FRONTEND_VERSION__

  const nodeDtoMap = new Map<ExecutionId, ExecutableLGraphNode>()
  for (const node of graph.computeExecutionOrder(false)) {
    const dto: ExecutableLGraphNode = isGroupNode(node)
      ? new ExecutableGroupNodeDTO(node, [], nodeDtoMap)
      : new ExecutableNodeDTO(node, [], nodeDtoMap)

    nodeDtoMap.set(dto.id, dto)

    if (
      node.mode === LGraphEventMode.NEVER ||
      node.mode === LGraphEventMode.BYPASS
    ) {
      continue
    }

    for (const innerNode of dto.getInnerNodes()) {
      nodeDtoMap.set(innerNode.id, innerNode)
    }
  }

  const output: ComfyApiWorkflow = {}
  // Process nodes in order of execution
  for (const node of nodeDtoMap.values()) {
    // Don't serialize muted nodes
    if (
      node.isVirtualNode ||
      node.mode === LGraphEventMode.NEVER ||
      node.mode === LGraphEventMode.BYPASS
    ) {
      continue
    }

    const inputs: ComfyApiWorkflow[string]['inputs'] = {}
    const { widgets } = node

    // Store all widget values in the API prompt.
    // Note: widget.options.serialize controls prompt inclusion (checked here).
    // widget.serialize controls workflow persistence (checked by LGraphNode).
    if (widgets) {
      for (const [i, widget] of widgets.entries()) {
        if (!widget.name || widget.options?.serialize === false) continue

        const widgetValue = await getExecutableWidgetValue(node, widget, i)
        // By default, Array values are reserved to represent node connections.
        // We need to wrap the array as an object to avoid the misinterpretation
        // of the array as a node connection.
        // The backend automatically unwraps the object to an array during
        // execution.
        inputs[widget.name] = Array.isArray(widgetValue)
          ? widget.type === 'curve'
            ? { __type__: 'CURVE', __value__: widgetValue }
            : { __value__: widgetValue }
          : widgetValue
      }
    }

    // Store all node links
    for (const [i, input] of node.inputs.entries()) {
      const resolvedInput = node.resolveInput(i)
      if (!resolvedInput) continue

      // Resolved to an actual widget value rather than a node connection
      if (resolvedInput.widgetInfo) {
        const { value } = resolvedInput.widgetInfo
        inputs[input.name] = Array.isArray(value) ? { __value__: value } : value
        continue
      }

      inputs[input.name] = [
        String(resolvedInput.origin_id),
        // @ts-expect-error link.origin_slot is already number.
        parseInt(resolvedInput.origin_slot)
      ]
    }

    output[String(node.id)] = {
      inputs,
      // TODO(huchenlei): Filter out all nodes that cannot be mapped to a
      // comfyClass.
      class_type: node.comfyClass!,
      // Ignored by the backend.
      _meta: {
        title: node.title
      }
    }
  }

  // Remove inputs connected to removed nodes
  for (const { inputs } of Object.values(output)) {
    for (const [i, input] of Object.entries(inputs)) {
      if (Array.isArray(input) && input.length === 2 && !output[input[0]]) {
        delete inputs[i]
      }
    }
  }

  return { workflow: workflow as ComfyWorkflowJSON, output }
}
