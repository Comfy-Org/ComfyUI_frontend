import {
  frontendResolverMap,
  frontendSupplierMap,
  projectedPromptInputOmissions
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
} from '@comfyorg/graph-model/workflowSchema'

import { zNodePackMetadata } from '@comfyorg/graph-model/workflowSchema'

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

/** Builds the executable prompt and its embedded workflow. */
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

  const workflow = whileEmbeddingWorkflow(() => graph.serialize({ sortNodes }))

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

  const resolutions = new Map<string, ResolvedSource>()
  const supplied = new Map<string, ResolvedSource>()
  const omissions = new Map<string, readonly string[]>()
  for (const [prefix, scope] of executionScopes(graph)) {
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
    for (const node of scope.nodes) {
      const id = prefix + node.id
      if (
        !nodeDtoMap.has(id) ||
        node.isVirtualNode ||
        node.mode === LGraphEventMode.NEVER ||
        node.mode === LGraphEventMode.BYPASS
      ) {
        continue
      }
      omissions.set(id, await projectedPromptInputOmissions(node.type, node))
    }
  }

  function executableSource(
    source: ResolvedSource | undefined,
    type: ExecutableLGraphNode['inputs'][number]['type']
  ):
    | ResolvedSource
    | { readonly kind: 'literal'; readonly value: unknown }
    | undefined {
    const visited = new Set<string>()
    while (source?.kind === 'output') {
      const key = `${source.nodeId}:${source.output}`
      if (visited.has(key)) {
        return { kind: 'omitted', reason: `cycle through ${key}` }
      }
      visited.add(key)
      const resolved = nodeDtoMap
        .get(source.nodeId)
        ?.resolveOutput(source.output, type, new Set())
      if (!resolved) {
        return { kind: 'omitted', reason: `no executable output ${key}` }
      }
      if (resolved.widgetInfo) {
        return { kind: 'literal', value: resolved.widgetInfo.value }
      }
      const projected = resolutions.get(
        `${resolved.origin_id}:${resolved.origin_slot}`
      )
      if (!projected) {
        return {
          kind: 'output',
          nodeId: resolved.origin_id,
          output: resolved.origin_slot
        }
      }
      source = projected
    }
    return source
  }

  const output: ComfyApiWorkflow = {}
  for (const node of nodeDtoMap.values()) {
    if (
      node.isVirtualNode ||
      node.mode === LGraphEventMode.NEVER ||
      node.mode === LGraphEventMode.BYPASS
    ) {
      continue
    }

    const inputs: ComfyApiWorkflow[string]['inputs'] = {}
    const { widgets } = node

    if (widgets) {
      for (const [i, widget] of widgets.entries()) {
        if (!widget.name || widget.options.serialize === false) continue

        const widgetValue = widget.serializeValue
          ? await widget.serializeValue(node, i)
          : widget.value
        inputs[widget.name] =
          widget.type === 'curve' && widgetValue != null
            ? { __type__: 'CURVE', __value__: widgetValue }
            : Array.isArray(widgetValue)
              ? { __value__: widgetValue }
              : widgetValue
      }
    }

    for (const [i, input] of node.inputs.entries()) {
      const resolvedInput = node.resolveInput(i)
      if (!resolvedInput) {
        const offered = executableSource(
          supplied.get(`${node.id}:${i}`),
          input.type
        )
        if (offered?.kind === 'output') {
          inputs[input.name] = [offered.nodeId, offered.output]
        } else if (offered?.kind === 'literal') {
          inputs[input.name] = Array.isArray(offered.value)
            ? { __value__: offered.value }
            : offered.value
        }
        continue
      }

      if (resolvedInput.widgetInfo) {
        const { value } = resolvedInput.widgetInfo
        inputs[input.name] = Array.isArray(value) ? { __value__: value } : value
        continue
      }

      const resolved = executableSource(
        resolutions.get(
          `${resolvedInput.origin_id}:${resolvedInput.origin_slot}`
        ),
        input.type
      )
      if (resolved?.kind === 'omitted') continue
      if (resolved?.kind === 'literal') {
        inputs[input.name] = Array.isArray(resolved.value)
          ? { __value__: resolved.value }
          : resolved.value
        continue
      }
      if (resolved?.kind === 'output') {
        inputs[input.name] = [resolved.nodeId, resolved.output]
        continue
      }

      inputs[input.name] = [resolvedInput.origin_id, resolvedInput.origin_slot]
    }

    for (const name of omissions.get(node.id) ?? []) {
      delete inputs[name]
    }

    const cnrId = zNodePackMetadata.shape.cnr_id.safeParse(
      node.properties.cnr_id
    ).data
    const auxId = zNodePackMetadata.shape.aux_id.safeParse(
      node.properties.aux_id
    ).data
    const packVersion = zNodePackMetadata.shape.ver.safeParse(
      node.properties.ver
    ).data
    output[node.id] = {
      inputs,
      class_type: node.comfyClass!,
      _meta: {
        title: node.title,
        ...(cnrId && { cnr_id: cnrId }),
        ...(auxId && { aux_id: auxId }),
        ...(packVersion && { ver: packVersion })
      }
    }
  }

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
