import { computed, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { parseImageWidgetValue } from '@/utils/imageUtil'

function resolveVideoUrlFromFileWidget(node: LGraphNode): string | undefined {
  const fileWidget = node.widgets?.find((widget) => widget.name === 'file')
  const raw = fileWidget?.value
  if (typeof raw !== 'string' || !raw) return undefined

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
  const fileSize = ref<number | undefined>()

  const videoUrl = computed(() => {
    const currentNode = node.value
    if (!currentNode) return undefined

    void nodeOutputStore.nodeOutputs

    return (
      nodeOutputStore.getNodeImageUrls(currentNode)?.[0] ??
      resolveVideoUrlFromFileWidget(currentNode)
    )
  })

  watch(
    videoUrl,
    async (url) => {
      fileSize.value = undefined
      if (!url) return

      try {
        const response = await fetch(url, { method: 'HEAD' })
        const contentLength = response.headers.get('Content-Length')
        if (contentLength) {
          fileSize.value = Number.parseInt(contentLength, 10)
        }
      } catch {
        fileSize.value = undefined
      }
    },
    { immediate: true }
  )

  return { videoUrl, fileSize }
}
