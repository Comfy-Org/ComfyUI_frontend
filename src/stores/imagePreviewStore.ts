import { LGraphNode } from '@comfyorg/litegraph'
import { defineStore } from 'pinia'

import { ExecutedWsMessage, ResultItem } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { parseFilePath } from '@/utils/formatUtil'
import { isVideoNode } from '@/utils/litegraphUtil'

const createOutputs = (
  filenames: string[],
  type: string,
  isAnimated: boolean
): ExecutedWsMessage['output'] => {
  return {
    images: filenames.map((image) => ({ type, ...parseFilePath(image) })),
    animated: filenames.map((image) => isAnimated && image.endsWith('.webp'))
  }
}

const getPreviewParam = (node: LGraphNode): string => {
  if (node.animatedImages || isVideoNode(node)) return ''
  return app.getPreviewFormatParam()
}

export const useNodeOutputStore = defineStore('nodeOutput', () => {
  const getNodeId = (node: LGraphNode): string => node.id.toString()

  function getNodeOutputs(
    node: LGraphNode
  ): ExecutedWsMessage['output'] | undefined {
    return app.nodeOutputs[getNodeId(node)]
  }

  function getNodePreviews(node: LGraphNode): string[] | undefined {
    return app.nodePreviewImages[getNodeId(node)]
  }

  function getNodeImageUrls(node: LGraphNode): string[] | undefined {
    const previews = getNodePreviews(node)
    if (previews?.length) return previews

    const outputs = getNodeOutputs(node)
    if (!outputs?.images?.length) return

    const rand = app.getRandParam()
    const previewParam = getPreviewParam(node)

    return outputs.images.map((image) => {
      const imgUrlPart = new URLSearchParams(image)
      return api.apiURL(`/view?${imgUrlPart}${previewParam}${rand}`)
    })
  }

  function setNodeOutputs(
    node: LGraphNode,
    filenames: string | string[] | ResultItem,
    {
      folder = 'input',
      isAnimated = false
    }: { folder?: string; isAnimated?: boolean } = {}
  ) {
    if (!filenames || !node) return

    const nodeId = getNodeId(node)

    if (typeof filenames === 'string') {
      app.nodeOutputs[nodeId] = createOutputs([filenames], folder, isAnimated)
    } else if (!Array.isArray(filenames)) {
      app.nodeOutputs[nodeId] = filenames
    } else {
      const resultItems = createOutputs(filenames, folder, isAnimated)
      if (!resultItems?.images?.length) return
      app.nodeOutputs[nodeId] = resultItems
    }
  }

  return {
    getNodeOutputs,
    getNodeImageUrls,
    getNodePreviews,
    setNodeOutputs
  }
})
