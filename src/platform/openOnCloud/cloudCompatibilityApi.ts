import type { CompatibilityModel } from '@comfyorg/ingest-types'
import { zCheckCloudCompatibilityResponse } from '@comfyorg/ingest-types/zod'
import { reportError } from '@comfyorg/telemetry/reportError'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import type {
  ExecutableLGraphNode,
  ExecutionId,
  LGraph
} from '@/lib/litegraph/src/litegraph'
import {
  ExecutableNodeDTO,
  LGraphEventMode
} from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useAuthStore } from '@/stores/authStore'
import { useModelStore } from '@/stores/modelStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { isModelFileName } from '@/platform/workflowErrors/missingModel/missingModelScan'
import { matchesWidgetName } from '@/utils/widgetBinding'
import type { CloudWorkflowVerdict } from '@/platform/openOnCloud/cloudWorkflowCheck'

const LINKED = Symbol('linked')

type CheckedNode = {
  class_type: string
  inputs: Record<string, unknown>
  pickerInputs: Set<string>
  hasUnreadableModels: boolean
}

const PICKER_WIDGET_TYPES = new Set(['combo', 'asset'])

function isSkippedByExecution(mode: LGraphEventMode | undefined): boolean {
  return mode === LGraphEventMode.NEVER || mode === LGraphEventMode.BYPASS
}

function executableNodes(graph: LGraph): ExecutableLGraphNode[] {
  const byId = new Map<ExecutionId, ExecutableLGraphNode>()
  for (const node of graph.nodes) {
    const dto = new ExecutableNodeDTO(node, [], byId)
    byId.set(dto.id, dto)
    if (isSkippedByExecution(node.mode)) continue
    for (const inner of dto.getInnerNodes()) byId.set(inner.id, inner)
  }
  return [...byId.values()].filter(
    (node) => !node.isVirtualNode && !isSkippedByExecution(node.mode)
  )
}

function nodeType(node: ExecutableLGraphNode): string {
  const source = node instanceof ExecutableNodeDTO ? node.node : null
  return source?.last_serialization?.type ?? node.comfyClass ?? node.type
}

function nodeInputs(node: ExecutableLGraphNode): Record<string, unknown> {
  const widgets = (node.widgets ?? []).filter(
    (widget) => widget.name && widget.options.serialize !== false
  )
  const inputs: Record<string, unknown> = Object.fromEntries(
    widgets.map((widget) => [widget.name, widget.value])
  )
  for (const [slot, input] of node.inputs.entries()) {
    const resolved = node.resolveInput(slot)
    if (!resolved) continue
    inputs[input.name] = resolved.widgetInfo
      ? resolved.widgetInfo.value
      : LINKED
  }
  return inputs
}

function pickerInputs(node: ExecutableLGraphNode): Set<string> {
  const widgets = (node.widgets ?? []).filter((widget) =>
    PICKER_WIDGET_TYPES.has(widget.type)
  )
  return new Set(widgets.map((widget) => widget.name))
}

function hasUnreadableModels(node: ExecutableLGraphNode): boolean {
  if (node.comfyClass || !(node instanceof ExecutableNodeDTO)) return false
  const values: unknown = node.node.last_serialization?.widgets_values
  const saved = Array.isArray(values)
    ? values
    : values && typeof values === 'object'
      ? Object.values(values)
      : []
  return saved.some(
    (value) => typeof value === 'string' && isModelFileName(value)
  )
}

function checkedNodes(graph: LGraph): CheckedNode[] {
  return executableNodes(graph).map((node) => ({
    class_type: nodeType(node),
    inputs: nodeInputs(node),
    pickerInputs: pickerInputs(node),
    hasUnreadableModels: hasUnreadableModels(node)
  }))
}

function modelInputsByNodeType() {
  const store = useModelToNodeStore()
  store.registerDefaults()
  const inputs = new Map<string, [folder: string, key: string | RegExp][]>()
  for (const [folder, providers] of Object.entries(store.modelToNodeMap)) {
    for (const { nodeDef, key } of providers ?? []) {
      const entries = inputs.get(nodeDef.name) ?? []
      inputs.set(nodeDef.name, [...entries, [folder, key]])
    }
  }
  return inputs
}

async function localModelFolders(): Promise<Map<string, string | null>> {
  const folders = await useModelStore().loadModels()
  const folderByName = new Map<string, string | null>()
  for (const folder of folders) {
    for (const model of Object.values(folder.models)) {
      const known = folderByName.get(model.file_name)
      folderByName.set(
        model.file_name,
        known === undefined || known === folder.directory
          ? folder.directory
          : null
      )
    }
  }
  return folderByName
}

function loaderFolders(
  loaderInputs: [folder: string, key: string | RegExp][],
  input: string
): string[] {
  return loaderInputs
    .filter(([, key]) => matchesWidgetName(input, key))
    .map(([folder]) => folder)
}

type ModelScan = {
  mapped: CompatibilityModel[]
  unmapped: string[]
  hasLinkedModelInput: boolean
}

function scanNode(
  node: CheckedNode,
  loaderInputs: [folder: string, key: string | RegExp][],
  scan: ModelScan
) {
  for (const [input, value] of Object.entries(node.inputs)) {
    const folders = loaderFolders(loaderInputs, input)
    const isModelInput = folders.length > 0 || node.pickerInputs.has(input)
    if (value === LINKED) {
      if (isModelInput) scan.hasLinkedModelInput = true
      continue
    }
    if (typeof value !== 'string') continue
    scan.mapped.push(...folders.map((folder) => ({ folder, name: value })))
    if (!folders.length && isModelInput && isModelFileName(value))
      scan.unmapped.push(value)
  }
}

function scanModelInputs(nodes: CheckedNode[]): ModelScan {
  const inputsByType = modelInputsByNodeType()
  const scan: ModelScan = {
    mapped: [],
    unmapped: [],
    hasLinkedModelInput: false
  }
  for (const node of nodes)
    scanNode(node, inputsByType.get(node.class_type) ?? [], scan)
  return scan
}

async function resolveUnmapped(
  names: string[]
): Promise<CompatibilityModel[] | null> {
  if (!names.length) return []
  const folderByName = await localModelFolders()
  const resolved: CompatibilityModel[] = []
  for (const name of names) {
    const folder = folderByName.get(name)
    if (!folder) return null
    resolved.push({ folder, name })
  }
  return resolved
}

async function collectModels(
  nodes: CheckedNode[]
): Promise<CompatibilityModel[] | null> {
  if (nodes.some((node) => node.hasUnreadableModels)) return null
  const { mapped, unmapped, hasLinkedModelInput } = scanModelInputs(nodes)
  if (hasLinkedModelInput) return null
  const resolved = await resolveUnmapped(unmapped)
  if (!resolved) return null
  const models = new Map<string, CompatibilityModel>()
  for (const model of [...mapped, ...resolved])
    models.set(JSON.stringify([model.folder, model.name]), model)
  return [...models.values()]
}

async function postCompatibilityCheck(): Promise<Response | null> {
  const nodes = checkedNodes(app.rootGraph)
  const models = await collectModels(nodes)
  if (!models) return null
  const nodeTypes = [...new Set(nodes.map((node) => node.class_type))]
  const auth = await useAuthStore().getAuthHeader()
  return fetch(new URL('/api/cloud/compatibility', getComfyCloudBaseUrl()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({
      node_types: nodeTypes,
      models
    }),
    signal: AbortSignal.timeout(10_000)
  })
}

function giveUp(cause: unknown): null {
  reportError(cause, {
    errorType: 'failure_checking_cloud_compatibility',
    surface: 'platform'
  })
  return null
}

/** Resolves null when no verdict is available. */
export async function checkCloudCompatibility(): Promise<CloudWorkflowVerdict | null> {
  let body: unknown
  try {
    const response = await postCompatibilityCheck()
    if (!response) return null
    if (!response.ok)
      return giveUp(
        new Error(`Cloud compatibility returned ${response.status}`)
      )
    body = await response.json()
  } catch (error) {
    return giveUp(error)
  }
  const parsed = zCheckCloudCompatibilityResponse.safeParse(body)
  if (!parsed.success) return giveUp(parsed.error)
  const { missing_node_types: nodePacks, missing_models: models = [] } =
    parsed.data.cloud
  return nodePacks.length || models.length
    ? { kind: 'missing', gaps: { nodePacks, models } }
    : { kind: 'canOpen' }
}
