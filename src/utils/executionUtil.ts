import type {
  ExecutableLGraphNode,
  ExecutionId,
  LGraph
} from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import {
  ExecutableNodeDTO,
  LGraphEventMode
} from '@/lib/litegraph/src/litegraph'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'

import { ExecutableGroupNodeDTO, isGroupNode } from './executableGroupNodeDto'
import { compressWidgetInputSlots } from './litegraphUtil'

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

  // Build a lookup from node ID to serialized workflow node so that
  // serializeValue results can be synced back into extra_pnginfo.
  // Keys are stringified because ExecutableNodeDTO.id is always a string
  // (e.g. "3") while workflow node IDs may be numbers.
  const workflowNodeById = new Map<string, ISerialisedNode>()
  for (const wfNode of workflow.nodes) {
    workflowNodeById.set(String(wfNode.id), wfNode)
  }

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
      // Find the matching workflow node to keep extra_pnginfo in sync.
      // For root-graph nodes the DTO id is the plain node ID; subgraph
      // inner nodes use a colon-separated path and are not present in the
      // root workflow node list.
      const wfNode = workflowNodeById.get(String(node.id))

      for (const [i, widget] of widgets.entries()) {
        if (!widget.name || widget.options?.serialize === false) continue

        const widgetValue = widget.serializeValue
          ? await widget.serializeValue(node, i)
          : widget.value

        // Sync the resolved value back into the workflow metadata so that
        // extra_pnginfo accurately reflects what was sent for execution.
        // This covers widgets whose serializeValue transforms the value
        // (e.g. dynamic prompts, randomised seeds) and also guards against
        // any drift between widget.value and the serialized workflow
        // snapshot captured earlier via graph.serialize().
        // Only update widgets that are persisted in the workflow
        // (widget.serialize !== false).
        if (wfNode?.widgets_values && widget.serialize !== false) {
          wfNode.widgets_values[i] =
            widgetValue != null && typeof widgetValue === 'object'
              ? JSON.parse(JSON.stringify(widgetValue))
              : (widgetValue ?? null)
        }

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
