import type { CompatibilityModel } from '@comfyorg/ingest-types'
import { zCheckCloudCompatibilityResponse } from '@comfyorg/ingest-types/zod'
import { reportError } from '@comfyorg/telemetry/reportError'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useAuthStore } from '@/stores/authStore'
import { useModelStore } from '@/stores/modelStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { isModelFileName } from '@/platform/workflowErrors/missingModel/missingModelScan'
import { matchesWidgetName } from '@/utils/widgetBinding'
import type { CloudWorkflowVerdict } from '@/platform/openOnCloud/cloudWorkflowCheck'

type CheckedNode = { class_type: string; inputs: Record<string, unknown> }

function isMuted(node: LGraphNode): boolean {
  return (
    node.mode === LGraphEventMode.NEVER || node.mode === LGraphEventMode.BYPASS
  )
}

function widgetInputs(node: LGraphNode): Record<string, unknown> {
  const widgets = (node.widgets ?? []).filter(
    (widget) => widget.name && widget.options.serialize !== false
  )
  return Object.fromEntries(
    widgets.map((widget) => [widget.name, widget.value])
  )
}

function executableNodes(graph: LGraph | Subgraph): CheckedNode[] {
  return graph.nodes.flatMap((node) => {
    if (isMuted(node)) return []
    if (node.isSubgraphNode()) return executableNodes(node.subgraph)
    const { comfyClass } = node
    if (node.isVirtualNode || !comfyClass) return []
    return [{ class_type: comfyClass, inputs: widgetInputs(node) }]
  })
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

async function localModelFolders(): Promise<Map<string, string>> {
  const folders = await useModelStore().loadModels()
  const folderByName = new Map<string, string>()
  for (const folder of folders) {
    for (const model of Object.values(folder.models)) {
      if (!folderByName.has(model.file_name))
        folderByName.set(model.file_name, folder.directory)
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

function scanModelInputs(nodes: CheckedNode[]) {
  const inputsByType = modelInputsByNodeType()
  const mapped: CompatibilityModel[] = []
  const unmapped: string[] = []
  for (const node of nodes) {
    const loaderInputs = inputsByType.get(node.class_type) ?? []
    for (const [input, name] of Object.entries(node.inputs)) {
      if (typeof name !== 'string') continue
      const folders = loaderFolders(loaderInputs, input)
      mapped.push(...folders.map((folder) => ({ folder, name })))
      if (!folders.length && isModelFileName(name)) unmapped.push(name)
    }
  }
  return { mapped, unmapped }
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
  const { mapped, unmapped } = scanModelInputs(nodes)
  const resolved = await resolveUnmapped(unmapped)
  if (!resolved) return null
  const models = new Map<string, CompatibilityModel>()
  for (const model of [...mapped, ...resolved])
    models.set(JSON.stringify([model.folder, model.name]), model)
  return [...models.values()]
}

async function postCompatibilityCheck(): Promise<Response | null> {
  const nodes = executableNodes(app.rootGraph)
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

/** Resolves null after any failure, or when a model's folder is unknown, so callers only branch. */
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
