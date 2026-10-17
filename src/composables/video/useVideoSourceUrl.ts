import { onMounted, onScopeDispose, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useRetryableMediaSrc } from '@/composables/media/useRetryableMediaSrc'
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

function stripRandParam(url: string): string {
  const [base, query] = url.split('?')
  if (!query) return url
  const params = new URLSearchParams(query)
  params.delete('rand')
  return `${base}?${params}`
}

export function useVideoSourceResolver() {
  const nodeOutputStore = useNodeOutputStore()
  const widgetValueStore = useWidgetValueStore()
  const { nodeToNodeLocatorId } = useWorkflowStore()

  function resolveSourceOutput(
    node: LGraphNode,
    inputName: string
  ): { node: LGraphNode; slot?: number } | undefined {
    const slot = node.inputs.findIndex((input) => input.name === inputName)
    if (slot < 0) return { node }

    let upstream = node.getInputNode(slot)
    let link = node.getInputLink(slot)
    const visited = new Set<LGraphNode>()
    while (upstream?.isSubgraphNode()) {
      if (!link || visited.has(upstream)) return undefined
      visited.add(upstream)
      const resolved = upstream.resolveSubgraphOutputLink(link.origin_slot)
      if (!resolved) return undefined
      upstream = resolved.outputNode ?? null
      link = resolved.link
    }
    return upstream ? { node: upstream, slot: link?.origin_slot } : undefined
  }

  function resolveSourceNode(node: LGraphNode, inputName: string) {
    return resolveSourceOutput(node, inputName)?.node
  }

  function sourceFileWidgetValue(source: LGraphNode): unknown {
    const graphId = source.graph?.rootGraph.id
    return (
      (graphId
        ? widgetValueStore.getWidget(widgetId(graphId, source.id, 'file'))
            ?.value
        : undefined) ??
      source.widgets?.find((widget) => widget.name === 'file')?.value
    )
  }

  function resolveVideoUrl(
    node: LGraphNode,
    inputName: string
  ): string | undefined {
    const source = resolveSourceNode(node, inputName)
    if (!source) return undefined

    const rawOutputUrl = nodeOutputStore.getNodeImageUrls(source)?.[0]
    const outputUrl = rawOutputUrl && stripRandParam(rawOutputUrl)
    const fileUrl = resolveFileWidgetVideoUrl(sourceFileWidgetValue(source))

    return source === node ? (fileUrl ?? outputUrl) : (outputUrl ?? fileUrl)
  }

  function sourceDependencies(node: LGraphNode, inputName: string) {
    const source = resolveSourceNode(node, inputName)
    if (!source) return []
    const locatorId = nodeToNodeLocatorId(source)
    return [
      nodeOutputStore.nodeOutputs[locatorId],
      nodeOutputStore.nodePreviewImages[locatorId],
      sourceFileWidgetValue(source)
    ]
  }

  return { resolveVideoUrl, resolveSourceOutput, sourceDependencies }
}

export function useVideoSourceUrl(
  node: ComputedRef<LGraphNode | null | undefined>,
  inputName = 'video'
) {
  const { resolveVideoUrl, sourceDependencies } = useVideoSourceResolver()

  const resolvedUrl = ref<string | undefined>()

  function updateVideoUrl(reExecuted = false) {
    const current = node.value
    const next = current ? resolveVideoUrl(current, inputName) : undefined
    if (next !== undefined && next === resolvedUrl.value) {
      if (reExecuted) retry()
      return
    }
    resolvedUrl.value = next
  }

  const connectionVersion = ref(0)
  let scopeDisposed = false
  let listeningNode: LGraphNode | undefined
  let installedCallback: LGraphNode['onConnectionsChange']
  let previousCallback: LGraphNode['onConnectionsChange']

  function detachConnectionListener() {
    if (
      listeningNode &&
      listeningNode.onConnectionsChange === installedCallback
    ) {
      listeningNode.onConnectionsChange = previousCallback
    }
    listeningNode = undefined
    installedCallback = undefined
    previousCallback = undefined
  }

  function attachConnectionListener() {
    const current = node.value
    if (!current || current === listeningNode) return
    detachConnectionListener()
    previousCallback = current.onConnectionsChange
    installedCallback = useChainCallback(previousCallback, () => {
      if (!scopeDisposed) connectionVersion.value++
    })
    current.onConnectionsChange = installedCallback
    listeningNode = current
  }

  onScopeDispose(() => {
    scopeDisposed = true
    detachConnectionListener()
  })

  watch(node, attachConnectionListener)

  watch(
    () => {
      void connectionVersion.value
      const current = node.value
      return current ? sourceDependencies(current, inputName) : []
    },
    (newDeps, oldDeps) => {
      const outputs = newDeps[0]
      const reExecuted = outputs !== undefined && outputs !== oldDeps[0]
      updateVideoUrl(reExecuted)
    }
  )

  onMounted(() => {
    attachConnectionListener()
    updateVideoUrl()
  })

  const {
    src: videoUrl,
    status,
    onError,
    retry
  } = useRetryableMediaSrc(resolvedUrl)

  return { videoUrl, status, onError, retry }
}
