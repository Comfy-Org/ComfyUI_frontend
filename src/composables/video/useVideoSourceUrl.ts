import { onMounted, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'
import { parseImageWidgetValue } from '@/utils/imageUtil'

const REMOTE_WIDGET_PLACEHOLDER = 'Loading...'

function resolveFileWidgetVideoUrl(rawValue: unknown): string | undefined {
  if (
    typeof rawValue !== 'string' ||
    !rawValue ||
    rawValue === REMOTE_WIDGET_PLACEHOLDER
  ) {
    return undefined
  }

  const { filename, subfolder, type } = parseImageWidgetValue(rawValue)
  if (!filename) return undefined

  const params = new URLSearchParams({ filename, subfolder, type })
  appendCloudResParam(params, filename)
  return api.apiURL(`/view?${params}${app.getPreviewFormatParam()}`)
}

export function useVideoSourceUrl(
  node: ComputedRef<LGraphNode | null | undefined>,
  inputName = 'video'
) {
  const nodeOutputStore = useNodeOutputStore()
  const widgetValueStore = useWidgetValueStore()
  const { nodeToNodeLocatorId } = useWorkflowStore()

  const videoUrl = ref<string | undefined>()

  function resolveSourceNode(): LGraphNode | undefined {
    const current = node.value
    if (!current) return undefined

    const slot =
      current.inputs?.findIndex((input) => input.name === inputName) ?? -1
    if (slot < 0) return current

    let upstream = current.getInputNode(slot)
    let link = current.getInputLink(slot)
    const visited = new Set<LGraphNode>()
    while (upstream?.isSubgraphNode()) {
      if (!link || visited.has(upstream)) return undefined
      visited.add(upstream)
      const resolved = upstream.resolveSubgraphOutputLink(link.origin_slot)
      if (!resolved) return undefined
      upstream = resolved.outputNode ?? null
      link = resolved.link
    }
    return upstream ?? undefined
  }

  function sourceFileWidgetValue(source: LGraphNode): unknown {
    const graphId = source.graph?.rootGraph?.id
    return (
      (graphId
        ? widgetValueStore.getWidget(widgetId(graphId, source.id, 'file'))
            ?.value
        : undefined) ??
      source.widgets?.find((widget) => widget.name === 'file')?.value
    )
  }

  function stripRandParam(url: string): string {
    const [base, query] = url.split('?')
    if (!query) return url
    const params = new URLSearchParams(query)
    params.delete('rand')
    return `${base}?${params}`
  }

  function resolveVideoUrl(): string | undefined {
    const source = resolveSourceNode()
    if (!source) return undefined

    const rawOutputUrl = nodeOutputStore.getNodeImageUrls(source)?.[0]
    const outputUrl = rawOutputUrl && stripRandParam(rawOutputUrl)
    const fileUrl = resolveFileWidgetVideoUrl(sourceFileWidgetValue(source))

    return source === node.value
      ? (fileUrl ?? outputUrl)
      : (outputUrl ?? fileUrl)
  }

  function updateVideoUrl() {
    videoUrl.value = resolveVideoUrl()
  }

  watch(() => {
    const source = resolveSourceNode()
    if (!source) return undefined
    const locatorId = nodeToNodeLocatorId(source)
    return [
      nodeOutputStore.nodeOutputs[locatorId],
      nodeOutputStore.nodePreviewImages[locatorId],
      sourceFileWidgetValue(source)
    ]
  }, updateVideoUrl)

  onMounted(updateVideoUrl)

  return { videoUrl }
}
