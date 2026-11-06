import { zCheckCloudCompatibilityResponse } from '@comfyorg/ingest-types/zod'
import { reportError } from '@comfyorg/telemetry/reportError'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { app } from '@/scripts/app'
import { useAuthStore } from '@/stores/authStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { matchesWidgetName } from '@/utils/widgetBinding'
import type { CloudWorkflowVerdict } from '@/platform/openOnCloud/cloudWorkflowCheck'

type PromptNode = Awaited<
  ReturnType<typeof app.graphToPrompt>
>['output'][string]

type CloudModel = { folder: string; name: string }

/** Model inputs per loader node type, so the graph is walked once. */
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

function collectModels(nodes: PromptNode[]): CloudModel[] {
  const inputsByType = modelInputsByNodeType()
  const models = new Map<string, CloudModel>()
  for (const node of nodes) {
    for (const [folder, key] of inputsByType.get(node.class_type) ?? []) {
      for (const [input, name] of Object.entries(node.inputs)) {
        if (typeof name === 'string' && matchesWidgetName(input, key))
          models.set(JSON.stringify([folder, name]), { folder, name })
      }
    }
  }
  return [...models.values()]
}

async function postCompatibilityCheck(): Promise<Response> {
  const [{ output }, auth] = await Promise.all([
    app.graphToPrompt(),
    useAuthStore().getAuthHeader()
  ])
  const nodes = Object.values(output)
  const nodeTypes = [...new Set(nodes.map((node) => node.class_type))]
  return fetch(new URL('/api/cloud/compatibility', getComfyCloudBaseUrl()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({
      node_types: nodeTypes,
      models: collectModels(nodes)
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
