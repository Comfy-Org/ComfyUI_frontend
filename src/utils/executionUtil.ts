import {
  frontendResolverMap,
  frontendSupplierMap
} from '@/platform/nodeApi/defsRegistry'
import { whileEmbeddingWorkflow } from '@/platform/nodeApi/serializeContext'
import {
  resolveFrontendNodesAsync,
  resolveSuppliedInputsAsync
} from '@/platform/nodeApi/resolution'
import type { ResolvedSource } from '@/platform/nodeApi/resolution'

import type {
  ExecutableLGraphNode,
  ExecutionId,
  LGraph
} from '@/lib/litegraph/src/litegraph'
import {
  ExecutableNodeDTO,
  LGraphEventMode
} from '@/lib/litegraph/src/litegraph'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'

import { compressWidgetInputSlots } from './litegraphUtil'

type ExportedWidgetValueWrapper = {
  __type__?: unknown
  __value__: unknown
}

function isExportedWidgetValueWrapper(
  value: unknown
): value is ExportedWidgetValueWrapper {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    '__value__' in value
  )
}

/**
 * Inverse of the wrapping applied during Export (API). Curve values carry a
 * type marker and may be objects; untyped wrappers are reserved for arrays so
 * ordinary objects containing a `__value__` property pass through unchanged.
 */
export function unwrapExportedWidgetValue(value: unknown): unknown {
  if (
    isExportedWidgetValueWrapper(value) &&
    (value.__type__ === 'CURVE' || Array.isArray(value.__value__))
  ) {
    return value.__value__
  }
  return value
}

/**
 * Every graph the prompt draws from, keyed by the prefix its nodes carry.
 *
 * A node's execution id is its owning scope's prefix followed by its local id,
 * so the root is `''` and the interior of subgraph node `3` is `'3:'`. Built
 * from the graph rather than from the DTOs because `ExecutableLGraphNode`
 * deliberately omits `graph` and `node`.
 *
 */
function executionScopes(
  graph: LGraph,
  prefix = '',
  into = new Map<string, LGraph>(),
  ancestors = new Set<LGraph>()
): Map<string, LGraph> {
  if (ancestors.has(graph)) return into
  into.set(prefix, graph)
  const branch = new Set(ancestors)
  branch.add(graph)

  for (const node of graph.nodes) {
    if (node.isSubgraphNode()) {
      executionScopes(node.subgraph, `${prefix}${node.id}:`, into, branch)
    }
  }
  return into
}

/** Re-homes a resolved source into the scope its consumers name it from. */
function inScope(prefix: string, source: ResolvedSource): ResolvedSource {
  return source.kind === 'output'
    ? { ...source, nodeId: prefix + source.nodeId }
    : source
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

  // This copy travels with the prompt as `extra_pnginfo` and is what lands in
  // the output image — a different destination from a saved file, though the
  // same call builds it.
  const workflow = whileEmbeddingWorkflow(() => graph.serialize({ sortNodes }))

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
    const dto: ExecutableLGraphNode = new ExecutableNodeDTO(
      node,
      [],
      nodeDtoMap
    )

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

  // What each frontend node's outputs actually stand for. This replaces
  // `applyToGraph`, which mutated the live graph mid-serialize; resolution is
  // pure and leaves the graph untouched.
  //
  // Once per graph the prompt draws from, not once for the document. Both
  // passes answer within the graph they are handed, so running only the root
  // never asked a resolver or supplier living inside a subgraph — and the keys
  // could not have matched anyway, since resolution keys by local id while an
  // inner node looks itself up by execution id. Resolving each scope and
  // re-keying by that scope's prefix is what makes the two meet.
  //
  // Deliberately per scope rather than across them: a broadcast that reached
  // into a subgraph would make its interior depend on invisible outside state,
  // and the subgraph would stop meaning the same thing wherever it is placed.
  const resolutions = new Map<string, ResolvedSource>()
  const supplied = new Map<string, ResolvedSource>()
  for (const [prefix, scope] of executionScopes(graph)) {
    // The async entries: a sandboxed pack's resolver or supplier answers from
    // a worker, and the prompt is the one place that answer MUST be awaited —
    // an unawaited relay would serialize a node the backend has never heard
    // of. This path is already async; the synchronous readers degrade to
    // omitted, loudly, in resolution.ts.
    const scopeResolutions = await resolveFrontendNodesAsync(
      scope,
      frontendResolverMap()
    )
    const scopeSupplied = await resolveSuppliedInputsAsync(
      scope,
      frontendSupplierMap(),
      scopeResolutions
    )
    for (const [slot, source] of scopeResolutions) {
      resolutions.set(prefix + slot, inScope(prefix, source))
    }
    for (const [slot, source] of scopeSupplied) {
      supplied.set(prefix + slot, inScope(prefix, source))
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
        if (!widget.name || widget.options.serialize === false) continue

        const widgetValue = widget.serializeValue
          ? await widget.serializeValue(node, i)
          : widget.value
        // By default, Array values are reserved to represent node connections.
        // We need to wrap the array as an object to avoid the misinterpretation
        // of the array as a node connection.
        // The backend automatically unwraps the object to an array during
        // execution.
        inputs[widget.name] =
          widget.type === 'curve' && widgetValue != null
            ? { __type__: 'CURVE', __value__: widgetValue }
            : Array.isArray(widgetValue)
              ? { __value__: widgetValue }
              : widgetValue
      }
    }

    // Store all node links
    for (const [i, input] of node.inputs.entries()) {
      const resolvedInput = node.resolveInput(i)
      if (!resolvedInput) {
        // Nothing is linked here, but a pack may broadcast into it.
        const offered = supplied.get(`${node.id}:${i}`)
        if (offered?.kind === 'output') {
          inputs[input.name] = [offered.nodeId, offered.output]
        } else if (offered?.kind === 'literal') {
          inputs[input.name] = (
            Array.isArray(offered.value)
              ? { __value__: offered.value }
              : offered.value
          ) as ComfyApiWorkflow[string]['inputs'][string]
        }
        continue
      }

      // Resolved to an actual widget value rather than a node connection
      if (resolvedInput.widgetInfo) {
        const { value } = resolvedInput.widgetInfo
        inputs[input.name] = Array.isArray(value) ? { __value__: value } : value
        continue
      }

      // A frontend node stands for something else — the source a reroute
      // forwards, the value a Get node reads. Substitute it, or the prompt
      // would reference a node the backend has never heard of.
      const resolved = resolutions.get(
        `${resolvedInput.origin_id}:${resolvedInput.origin_slot}`
      )
      if (resolved?.kind === 'omitted') continue
      if (resolved?.kind === 'literal') {
        inputs[input.name] = (
          Array.isArray(resolved.value)
            ? { __value__: resolved.value }
            : resolved.value
        ) as ComfyApiWorkflow[string]['inputs'][string]
        continue
      }
      if (resolved?.kind === 'output') {
        inputs[input.name] = [resolved.nodeId, resolved.output]
        continue
      }

      inputs[input.name] = [
        resolvedInput.origin_id,
        // @ts-expect-error link.origin_slot is already number.
        parseInt(resolvedInput.origin_slot)
      ]
    }

    output[node.id] = {
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
      if (
        Array.isArray(input) &&
        input.length === 2 &&
        !Object.hasOwn(output, input[0])
      ) {
        delete inputs[i]
      }
    }
  }

  return { workflow: workflow as ComfyWorkflowJSON, output }
}
