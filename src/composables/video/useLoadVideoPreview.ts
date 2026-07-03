import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'
import { parseImageWidgetValue } from '@/utils/imageUtil'

const REMOTE_WIDGET_PLACEHOLDER = 'Loading...'

function isResolvableFileWidgetValue(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !raw || raw === REMOTE_WIDGET_PLACEHOLDER) {
    return false
  }

  const { filename } = parseImageWidgetValue(raw)
  return Boolean(filename)
}

function resolveVideoUrlFromFileWidget(node: LGraphNode): string | undefined {
  const fileWidget = node.widgets?.find((widget) => widget.name === 'file')
  const raw = fileWidget?.value
  if (!isResolvableFileWidgetValue(raw)) return undefined

  const { filename, subfolder, type } = parseImageWidgetValue(raw)
  if (!filename) return undefined

  const params = new URLSearchParams({ filename, subfolder, type })
  appendCloudResParam(params, filename)
  return api.apiURL(`/view?${params}${app.getPreviewFormatParam()}`)
}

export function nodeHasLoadVideoPreview(
  node: LGraphNode | null | undefined
): boolean {
  if (!node) return false

  const nodeOutputStore = useNodeOutputStore()
  if ((nodeOutputStore.getNodeImageUrls(node)?.length ?? 0) > 0) {
    return true
  }

  return resolveVideoUrlFromFileWidget(node) !== undefined
}

export function useLoadVideoPreview(
  node: ComputedRef<LGraphNode | null | undefined>
) {
  const nodeOutputStore = useNodeOutputStore()
  const widgetValueStore = useWidgetValueStore()

  const videoUrl = computed(() => {
    const currentNode = node.value
    if (!currentNode) return undefined

    void nodeOutputStore.nodeOutputs

    const graphId = currentNode.graph?.rootGraph?.id
    if (graphId) {
      void widgetValueStore.getWidget(widgetId(graphId, currentNode.id, 'file'))
        ?.value
    }

    return (
      nodeOutputStore.getNodeImageUrls(currentNode)?.[0] ??
      resolveVideoUrlFromFileWidget(currentNode)
    )
  })

  return { videoUrl }
}
