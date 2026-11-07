import type { CompatibilityModel } from '@comfyorg/ingest-types'
import { zCheckCloudCompatibilityResponse } from '@comfyorg/ingest-types/zod'
import { reportError } from '@comfyorg/telemetry/reportError'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { app } from '@/scripts/app'
import { useAuthStore } from '@/stores/authStore'
import { useModelStore } from '@/stores/modelStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { isModelFileName } from '@/platform/workflowErrors/missingModel/missingModelScan'
import { matchesWidgetName } from '@/utils/widgetBinding'
import type { CloudWorkflowVerdict } from '@/platform/openOnCloud/cloudWorkflowCheck'

type PromptNode = Awaited<
  ReturnType<typeof app.graphToPrompt>
>['output'][string]

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

function scanModelInputs(nodes: PromptNode[]) {
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

async function resolveUnmapped(names: string[]): Promise<CompatibilityModel[]> {
  if (!names.length) return []
  const folderByName = await localModelFolders()
  return names.flatMap((name) => {
    const folder = folderByName.get(name)
    return folder ? [{ folder, name }] : []
  })
}

async function collectModels(
  nodes: PromptNode[]
): Promise<CompatibilityModel[]> {
  const { mapped, unmapped } = scanModelInputs(nodes)
  const models = new Map<string, CompatibilityModel>()
  for (const model of [...mapped, ...(await resolveUnmapped(unmapped))])
    models.set(JSON.stringify([model.folder, model.name]), model)
  return [...models.values()]
}

async function postCompatibilityCheck(): Promise<Response> {
  const [{ output }, auth] = await Promise.all([
    app.graphToPrompt(),
    useAuthStore().getAuthHeader()
  ])
  const nodes = Object.values(output)
  const nodeTypes = [...new Set(nodes.map((node) => node.class_type))]
  const models = await collectModels(nodes)
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

/** Resolves null after reporting any failure, so callers only branch. */
export async function checkCloudCompatibility(): Promise<CloudWorkflowVerdict | null> {
  let body: unknown
  try {
    const response = await postCompatibilityCheck()
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
