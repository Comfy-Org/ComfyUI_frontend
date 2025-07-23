import { LGraphNode } from '@comfyorg/litegraph'
import { defineStore } from 'pinia'

import {
  ExecutedWsMessage,
  ResultItem,
  ResultItemType
} from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useExecutionStore } from '@/stores/executionStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { parseFilePath } from '@/utils/formatUtil'
import { isVideoNode } from '@/utils/litegraphUtil'

const createOutputs = (
  filenames: string[],
  type: ResultItemType,
  isAnimated: boolean
): ExecutedWsMessage['output'] => {
  return {
    images: filenames.map((image) => ({ type, ...parseFilePath(image) })),
    animated: filenames.map((image) => isAnimated && image.endsWith('.webp'))
  }
}

export const useNodeOutputStore = defineStore('nodeOutput', () => {
  const { nodeIdToNodeLocatorId } = useWorkflowStore()
  const { executionIdToNodeLocatorId } = useExecutionStore()

  function getNodeOutputs(
    node: LGraphNode
  ): ExecutedWsMessage['output'] | undefined {
    return app.nodeOutputs[nodeIdToNodeLocatorId(node.id)]
  }

  function getNodePreviews(node: LGraphNode): string[] | undefined {
    return app.nodePreviewImages[nodeIdToNodeLocatorId(node.id)]
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

  interface SetOutputOptions {
    merge?: boolean
  }

  /**
   * Internal function to set outputs by NodeLocatorId.
   * Handles the merge logic when needed.
   */
  function setOutputsByLocatorId(
    nodeLocatorId: NodeLocatorId,
    outputs: ExecutedWsMessage['output'] | ResultItem,
    options: SetOutputOptions = {}
  ) {
    if (options.merge) {
      const existingOutput = app.nodeOutputs[nodeLocatorId]
      if (existingOutput && outputs) {
        for (const k in outputs) {
          const existingValue = existingOutput[k]
          const newValue = (outputs as any)[k]

          if (Array.isArray(existingValue) && Array.isArray(newValue)) {
            existingOutput[k] = existingValue.concat(newValue)
          } else {
            existingOutput[k] = newValue
          }
        }
        return
      }
    }

    app.nodeOutputs[nodeLocatorId] = outputs
  }

  function setNodeOutputs(
    node: LGraphNode,
    filenames: string | string[] | ResultItem,
    {
      folder = 'input',
      isAnimated = false
    }: { folder?: ResultItemType; isAnimated?: boolean } = {}
  ) {
    if (!filenames || !node) return

    const nodeLocatorId = nodeIdToNodeLocatorId(node.id)

    if (typeof filenames === 'string') {
      setOutputsByLocatorId(
        nodeLocatorId,
        createOutputs([filenames], folder, isAnimated)
      )
    } else if (!Array.isArray(filenames)) {
      setOutputsByLocatorId(nodeLocatorId, filenames)
    } else {
      const resultItems = createOutputs(filenames, folder, isAnimated)
      if (!resultItems?.images?.length) return
      setOutputsByLocatorId(nodeLocatorId, resultItems)
    }
  }

  /**
   * Set node outputs by execution ID (hierarchical ID from backend).
   * Converts the execution ID to a NodeLocatorId before storing.
   *
   * @param executionId - The execution ID (e.g., "123:456:789" or "789")
   * @param outputs - The outputs to store
   * @param options - Options for setting outputs
   * @param options.merge - If true, merge with existing outputs (arrays are concatenated)
   */
  function setNodeOutputsByExecutionId(
    executionId: string,
    outputs: ExecutedWsMessage['output'] | ResultItem,
    options: SetOutputOptions = {}
  ) {
    const nodeLocatorId = executionIdToNodeLocatorId(executionId)
    if (!nodeLocatorId) return

    setOutputsByLocatorId(nodeLocatorId, outputs, options)
  }

  /**
   * Set node outputs by node ID.
   * Uses the current graph context to create the appropriate NodeLocatorId.
   *
   * @param nodeId - The node ID
   * @param outputs - The outputs to store
   * @param options - Options for setting outputs
   * @param options.merge - If true, merge with existing outputs (arrays are concatenated)
   */
  function setNodeOutputsByNodeId(
    nodeId: string | number,
    outputs: ExecutedWsMessage['output'] | ResultItem,
    options: SetOutputOptions = {}
  ) {
    const nodeLocatorId = nodeIdToNodeLocatorId(nodeId)
    setOutputsByLocatorId(nodeLocatorId, outputs, options)
  }

  return {
    getNodeOutputs,
    getNodeImageUrls,
    getNodePreviews,
    setNodeOutputs,
    setNodeOutputsByExecutionId,
    setNodeOutputsByNodeId,
    getPreviewParam
  }
})
