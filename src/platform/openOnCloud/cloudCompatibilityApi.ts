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

function collectModels(nodes: PromptNode[]) {
  const store = useModelToNodeStore()
  store.registerDefaults()
  const models = new Map<string, { folder: string; name: string }>()
  for (const [folder, providers] of Object.entries(store.modelToNodeMap)) {
    for (const provider of providers ?? []) {
      const names = modelNames(nodes, provider.nodeDef.name, provider.key)
      for (const name of names) {
        models.set(JSON.stringify([folder, name]), { folder, name })
      }
    }
  }
  return [...models.values()]
}

function modelNames(
  nodes: PromptNode[],
  nodeType: string,
  key: string | RegExp
) {
  return nodes
    .filter((node) => node.class_type === nodeType)
    .flatMap((node) =>
      Object.entries(node.inputs).flatMap(([input, value]) =>
        typeof value === 'string' && matchesWidgetName(input, key)
          ? [value]
          : []
      )
    )
}

async function postCompatibilityCheck(): Promise<Response> {
  const { output } = await app.graphToPrompt()
  const nodes = Object.values(output)
  const nodeTypes = [...new Set(nodes.map((node) => node.class_type))]
  const auth = await useAuthStore().getAuthHeader()
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
