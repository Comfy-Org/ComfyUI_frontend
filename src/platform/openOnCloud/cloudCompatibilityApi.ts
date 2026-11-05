import { z } from 'zod'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { app } from '@/scripts/app'
import { useAuthStore } from '@/stores/authStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { matchesWidgetName } from '@/utils/widgetBinding'
import type { CloudWorkflowVerdict } from '@/platform/openOnCloud/cloudWorkflowCheck'

const responseSchema = z.object({
  cloud: z.object({
    missing_node_types: z.array(z.string()),
    missing_models: z.array(z.object({ folder: z.string(), name: z.string() }))
  })
})

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

export async function checkCloudCompatibility(): Promise<CloudWorkflowVerdict | null> {
  const { output } = await app.graphToPrompt()
  const nodes = Object.values(output)
  const nodeTypes = [...new Set(nodes.map((node) => node.class_type))]
  const models = collectModels(nodes)

  const auth = await useAuthStore().getAuthHeader()
  const response = await fetch(
    new URL('/api/cloud/compatibility', getComfyCloudBaseUrl()),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({
        node_types: nodeTypes,
        models
      }),
      signal: AbortSignal.timeout(10_000)
    }
  )
  if (!response.ok) return null
  const { cloud } = responseSchema.parse(await response.json())
  return cloud.missing_node_types.length || cloud.missing_models.length
    ? {
        kind: 'missing',
        gaps: {
          nodePacks: cloud.missing_node_types,
          models: cloud.missing_models
        }
      }
    : { kind: 'canOpen' }
}
