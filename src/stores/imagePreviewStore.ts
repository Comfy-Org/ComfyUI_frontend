import { LGraphNode } from '@comfyorg/litegraph'
import { defineStore } from 'pinia'

import { ExecutedWsMessage, ResultItem } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
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

  /**
   * Check if a node's outputs includes images that should/can be loaded normally
   * by PIL.
   */
  const isImageOutputs = (
    node: LGraphNode,
    outputs: ExecutedWsMessage['output']
  ): boolean => {
    // If animated webp/png or video outputs, return false
    if (node.animatedImages || isVideoNode(node)) return false

    // If no images, return false
    if (!outputs?.images?.length) return false

    // If svg images, return false
    if (outputs.images.some((image) => image.filename?.endsWith('svg')))
      return false

    return true
  }

  /**
   * Get the preview param for the node's outputs.
   *
   * If the output is an image, use the user's preferred format (from settings).
   * For non-image outputs, return an empty string, as including the preview param
   * will force the server to load the output file as an image.
   */
  function getPreviewParam(
    node: LGraphNode,
    outputs: ExecutedWsMessage['output']
  ): string {
    return isImageOutputs(node, outputs) ? app.getPreviewFormatParam() : ''
  }

  function getNodeImageUrls(node: LGraphNode): string[] | undefined {
    const previews = getNodePreviews(node)
    if (previews?.length) return previews

    const outputs = getNodeOutputs(node)
    if (!outputs?.images?.length) return

    const rand = app.getRandParam()
    const previewParam = getPreviewParam(node, outputs)

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
    setNodeOutputs,
    getPreviewParam
  }
})
