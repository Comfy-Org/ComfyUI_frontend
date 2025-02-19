import { LGraphNode } from '@comfyorg/litegraph'
import { defineStore } from 'pinia'

import { api } from '@/scripts/api'
import { ExecutedWsMessage, ResultItem } from '@/types/apiTypes'
import { parseFilePath } from '@/utils/formatUtil'

const toOutputs = (
  filenames: string[],
  type: string
): ExecutedWsMessage['output'] => {
  return {
    images: filenames.map((image) => ({ type, ...parseFilePath(image) }))
  }
}

const getPreviewParam = (node: LGraphNode) => {
  if (node.animatedImages) return ''
  return app.getPreviewFormatParam()
}

export const useNodeOutputStore = defineStore('nodeOutput', () => {
  function getNodeOutputs(node: LGraphNode): ExecutedWsMessage['output'] {
    return app.nodeOutputs[node.id + '']
  }

  function getNodePreviews(node: LGraphNode): string[] {
    return app.nodePreviewImages[node.id + '']
  }

  function getNodeImageUrls(node: LGraphNode): string[] {
    const outputs = getNodeOutputs(node)
    if (!outputs?.images?.length) return []

    return outputs.images.map((image) => {
      const imgUrlPart = new URLSearchParams(image)
      const rand = app.getRandParam()
      const previewParam = getPreviewParam(node)
      return api.apiURL(`/view?${imgUrlPart}${previewParam}${rand}`)
    })
  }

  /**
   * Checks if the node's images have changed from what's stored
   * @returns true if images have changed, false otherwise
   */
  function isImagesChanged(node: LGraphNode): boolean {
    const currentImages = node.images || []
    const { images: newImages } = getNodeOutputs(node) ?? {}
    if (!newImages?.length) return false

    return currentImages !== newImages
  }

  function setNodeOutputs(
    node: LGraphNode,
    filenames: string | string[] | ResultItem,
    options: { folder?: string } = {}
  ) {
    if (!filenames) return

    const { folder = 'input' } = options
    const nodeId = node.id + ''

    if (typeof filenames === 'string') {
      app.nodeOutputs[nodeId] = toOutputs([filenames], folder)
    } else if (!Array.isArray(filenames)) {
      app.nodeOutputs[nodeId] = filenames
    } else {
      const resultItems = toOutputs(filenames, folder)
      if (!resultItems?.images?.length) return

      app.nodeOutputs[nodeId] = resultItems
    }
  }

  return {
    getNodeOutputs,
    getNodeImageUrls,
    getNodePreviews,
    setNodeOutputs,
    isImagesChanged
  }
})
