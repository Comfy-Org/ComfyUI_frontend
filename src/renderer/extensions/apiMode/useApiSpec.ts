import { computed } from 'vue'

import { useResolvedSelectedInputs } from '@/components/builder/useResolvedSelectedInputs'
import type { ResolvedSelection } from '@/components/builder/useResolvedSelectedInputs'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAppModeStore } from '@/stores/appModeStore'

import type { ApiInputSpec, ApiInputType } from './buildOpenApiSpec'
import { buildOpenApiSpec } from './buildOpenApiSpec'

interface WidgetOptions {
  min?: number
  max?: number
  step?: number
  precision?: number
  values?: unknown[]
}

function resolveType(
  widget: IBaseWidget,
  options: WidgetOptions
): ApiInputType {
  const type = String(widget.type ?? '').toLowerCase()
  const value = widget.value

  if (type === 'toggle' || typeof value === 'boolean') return 'BOOLEAN'
  if (type === 'combo' || Array.isArray(options.values)) return 'COMBO'
  if (type === 'number' || type === 'slider' || typeof value === 'number') {
    const isInt =
      options.precision === 0 ||
      (Number.isInteger(value as number) &&
        (options.step === undefined || Number.isInteger(options.step)))
    return isInt ? 'INT' : 'FLOAT'
  }
  return 'STRING'
}

function widgetToApiInput(
  name: string,
  selection: Extract<ResolvedSelection, { status: 'resolved' }>
): ApiInputSpec {
  const { widget, node } = selection
  const options = (widget.options ?? {}) as WidgetOptions
  const type = resolveType(widget, options)
  return {
    name,
    type,
    default: widget.value,
    options: type === 'COMBO' ? (options.values ?? []) : undefined,
    minimum: type === 'INT' || type === 'FLOAT' ? options.min : undefined,
    maximum: type === 'INT' || type === 'FLOAT' ? options.max : undefined,
    description: `node ${String(node.id)}.${widget.name}`
  }
}

/**
 * Where an API field's value lives in the graph, so request payloads can be
 * mapped back onto the workflow's node inputs before execution.
 */
export interface ApiInputFieldTarget {
  nodeId: string
  widgetName: string
}

type ResolvedInput = Extract<ResolvedSelection, { status: 'resolved' }>

/**
 * Compute the API field name for each resolved input, disambiguating duplicate
 * display names the same way for both the spec and the request→graph mapping.
 */
function fieldNamesFor(
  resolved: ResolvedInput[]
): { fieldName: string; entry: ResolvedInput }[] {
  const nameCounts = new Map<string, number>()
  for (const entry of resolved) {
    nameCounts.set(
      entry.displayName,
      (nameCounts.get(entry.displayName) ?? 0) + 1
    )
  }
  return resolved.map((entry) => ({
    fieldName:
      (nameCounts.get(entry.displayName) ?? 0) > 1
        ? `${String(entry.node.id)}_${entry.displayName}`
        : entry.displayName,
    entry
  }))
}

/**
 * Reactively derive an OpenAPI spec from the workflow's API configuration
 * (promoted inputs + selected output nodes), for rendering with Swagger UI.
 * Also exposes the mapping from API fields/outputs back to the graph so a
 * request payload can be executed against the live workflow.
 */
export function useApiSpec() {
  const resolvedInputs = useResolvedSelectedInputs()
  const appModeStore = useAppModeStore()
  const workflowStore = useWorkflowStore()

  const resolved = computed<ResolvedInput[]>(() =>
    resolvedInputs.value.filter(
      (entry): entry is ResolvedInput => entry.status === 'resolved'
    )
  )

  const selectedOutputs = computed(() =>
    appModeStore.selectedOutputs.map(String)
  )

  // The promoted inputs (with current values + constraints) described by the
  // GET /api/workflow/inputs endpoint.
  const inputs = computed<ApiInputSpec[]>(() =>
    fieldNamesFor(resolved.value).map(({ fieldName, entry }) =>
      widgetToApiInput(fieldName, entry)
    )
  )

  const spec = computed(() => {
    const title = workflowStore.activeWorkflow?.filename ?? 'workflow'
    return buildOpenApiSpec({
      title,
      inputs: inputs.value,
      outputs: selectedOutputs.value
    })
  })

  // Maps each API field name to the node + widget it controls.
  const inputFieldMap = computed<Record<string, ApiInputFieldTarget>>(() => {
    const map: Record<string, ApiInputFieldTarget> = {}
    for (const { fieldName, entry } of fieldNamesFor(resolved.value)) {
      map[fieldName] = {
        nodeId: String(entry.node.id),
        widgetName: entry.widget.name
      }
    }
    return map
  })

  return { spec, inputs, inputFieldMap, selectedOutputs }
}
