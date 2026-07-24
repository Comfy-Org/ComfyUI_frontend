import { useTimeoutFn } from '@vueuse/core'
import { mapKeys } from 'es-toolkit'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type {
  ExecutedWsMessage,
  ResultItem,
  ResultItemType
} from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { clone } from '@/scripts/utils'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import type { NodeExecutionId, NodeLocatorId } from '@/types/nodeIdentification'
import type { NodeId } from '@/types/nodeId'
import { parseFilePath } from '@/utils/formatUtil'
import { executionIdToNodeLocatorId } from '@/utils/graphTraversalUtil'
import {
  isAnimatedOutput,
  isVideoNode,
  resolveNode
} from '@/utils/litegraphUtil'
import {
  releaseSharedObjectUrl,
  retainSharedObjectUrl
} from '@/utils/objectUrlUtil'

const PREVIEW_REVOKE_DELAY_MS = 400

const createOutputs = (
  filenames: string[],
  type: ResultItemType,
  isAnimated: boolean
): ExecutedWsMessage['output'] => {
  return {
    images: filenames.map((image) => ({ type, ...parseFilePath(image) })),
    animated: filenames.map(
      (image) =>
        isAnimated && (image.endsWith('.webp') || image.endsWith('.png'))
    )
  }
}

interface SetOutputOptions {
  merge?: boolean
}

export const useNodeOutputStore = defineStore('nodeOutput', () => {
  const { nodeIdToNodeLocatorId, nodeToNodeLocatorId } = useWorkflowStore()
  const scheduledRevoke: Record<NodeLocatorId, { stop: () => void }> = {}
  const latestPreview = ref<string[]>([])

  function scheduleRevoke(locator: NodeLocatorId, cb: () => void) {
    scheduledRevoke[locator]?.stop()

    const { stop } = useTimeoutFn(() => {
      delete scheduledRevoke[locator]
      cb()
    }, PREVIEW_REVOKE_DELAY_MS)

    scheduledRevoke[locator] = { stop }
  }

  const nodeOutputs = ref<Record<string, ExecutedWsMessage['output']>>({})
  const nodePreviewImages = ref<Record<string, string[]>>(
    app.nodePreviewImages || {}
  )

  function getNodeOutputs(
    node: LGraphNode
  ): ExecutedWsMessage['output'] | undefined {
    return app.nodeOutputs[nodeToNodeLocatorId(node)]
  }

  function getNodePreviews(node: LGraphNode): string[] | undefined {
    return app.nodePreviewImages[nodeToNodeLocatorId(node)]
  }

  const isImageOutputs = (
    node: LGraphNode,
    outputs: ExecutedWsMessage['output']
  ): boolean => {
    if (isAnimatedOutput(outputs) || isVideoNode(node)) return false

    if (!outputs?.images?.length) return false

    const images = outputs.images.filter((image) => image != null)
    if (!images.length) return false

    if (images.some((image) => image.filename?.toLowerCase().endsWith('.svg')))
      return false

    return true
  }

  function getPreviewParam(
    node: LGraphNode,
    outputs: ExecutedWsMessage['output']
  ): string {
    return isImageOutputs(node, outputs) ? app.getPreviewFormatParam() : ''
  }

  function buildImageUrls(
    node: LGraphNode,
    outputs: ExecutedWsMessage['output'] | undefined
  ): string[] | undefined {
    if (!outputs?.images?.length) return

    const rand = app.getRandParam()
    const previewParam = getPreviewParam(node, outputs)

    return outputs.images
      .filter((image) => image != null)
      .map((image) => {
        const params = new URLSearchParams(image)
        return api.apiURL(`/view?${params}${previewParam}${rand}`)
      })
  }

  function getNodeImageUrls(node: LGraphNode): string[] | undefined {
    const previews = getNodePreviews(node)
    if (previews?.length) return previews

    return buildImageUrls(node, getNodeOutputs(node))
  }

  function getNodeOutputByExecutionId(
    executionId: NodeExecutionId
  ): ExecutedWsMessage['output'] | undefined {
    const locatorId = executionIdToNodeLocatorId(app.rootGraph, executionId)
    if (!locatorId) return undefined
    return nodeOutputs.value[locatorId]
  }

  function getNodePreviewImagesByExecutionId(
    executionId: NodeExecutionId
  ): string[] | undefined {
    const locatorId = executionIdToNodeLocatorId(app.rootGraph, executionId)
    if (!locatorId) return undefined
    return nodePreviewImages.value[locatorId]
  }

  function getNodeImageUrlsByExecutionId(
    executionId: NodeExecutionId,
    node: LGraphNode
  ): string[] | undefined {
    const previews = getNodePreviewImagesByExecutionId(executionId)
    if (previews?.length) return previews

    return buildImageUrls(node, getNodeOutputByExecutionId(executionId))
  }

  function isInputPreviewOutput(
    output: ExecutedWsMessage['output'] | ResultItem | undefined
  ): boolean {
    const images = (output as ExecutedWsMessage['output'] | undefined)?.images
    return (
      Array.isArray(images) &&
      images.length > 0 &&
      images.every((i) => i?.type === 'input')
    )
  }

  function setOutputsByLocatorId(
    nodeLocatorId: NodeLocatorId,
    outputs: ExecutedWsMessage['output'] | ResultItem,
    options: SetOutputOptions = {}
  ) {
    if (outputs == null) return

    const incomingImages = (outputs as ExecutedWsMessage['output']).images
    const hasIncomingImages =
      Array.isArray(incomingImages) && incomingImages.length > 0
    if (
      !hasIncomingImages &&
      isInputPreviewOutput(app.nodeOutputs[nodeLocatorId])
    ) {
      outputs = {
        ...outputs,
        images: app.nodeOutputs[nodeLocatorId].images
      }
    }

    if (options.merge) {
      const existingOutput = app.nodeOutputs[nodeLocatorId]
      if (existingOutput && outputs) {
        for (const k in outputs) {
          const existingValue = existingOutput[k]
          const newValue = (outputs as Record<string, unknown>)[k]

          if (Array.isArray(existingValue) && Array.isArray(newValue)) {
            existingOutput[k] = existingValue.concat(newValue)
          } else {
            existingOutput[k] = newValue
          }
        }
        nodeOutputs.value[nodeLocatorId] = { ...existingOutput }
        return
      }
    }

    app.nodeOutputs[nodeLocatorId] = outputs
    nodeOutputs.value[nodeLocatorId] = outputs
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

    const locatorId = nodeToNodeLocatorId(node)
    if (!locatorId) return
    if (typeof filenames === 'string') {
      setOutputsByLocatorId(
        locatorId,
        createOutputs([filenames], folder, isAnimated)
      )
    } else if (!Array.isArray(filenames)) {
      setOutputsByLocatorId(locatorId, filenames)
    } else {
      const resultItems = createOutputs(filenames, folder, isAnimated)
      if (!resultItems?.images?.length) return
      setOutputsByLocatorId(locatorId, resultItems)
    }
  }

  function setNodeOutputsByExecutionId(
    executionId: NodeExecutionId,
    outputs: ExecutedWsMessage['output'] | ResultItem,
    options: SetOutputOptions = {}
  ) {
    const nodeLocatorId = executionIdToNodeLocatorId(app.rootGraph, executionId)
    if (!nodeLocatorId) return
    setOutputsByLocatorId(nodeLocatorId, outputs, options)
  }

  function setNodePreviewsByExecutionId(
    executionId: NodeExecutionId,
    previewImages: string[]
  ) {
    const nodeLocatorId = executionIdToNodeLocatorId(app.rootGraph, executionId)
    if (!nodeLocatorId) return
    setNodePreviewsByLocatorId(nodeLocatorId, previewImages)
    latestPreview.value = previewImages
  }

  function setNodePreviewsByLocatorId(
    nodeLocatorId: NodeLocatorId,
    previewImages: string[]
  ) {
    const existingPreviews = app.nodePreviewImages[nodeLocatorId]
    if (scheduledRevoke[nodeLocatorId]) {
      scheduledRevoke[nodeLocatorId].stop()
      delete scheduledRevoke[nodeLocatorId]
    }
    if (existingPreviews?.[Symbol.iterator]) {
      for (const url of existingPreviews) {
        releaseSharedObjectUrl(url)
      }
    }
    for (const url of previewImages) {
      retainSharedObjectUrl(url)
    }
    app.nodePreviewImages[nodeLocatorId] = previewImages
    nodePreviewImages.value[nodeLocatorId] = previewImages
  }

  function setNodePreviewsByNodeId(nodeId: NodeId, previewImages: string[]) {
    setNodePreviewsByLocatorId(nodeIdToNodeLocatorId(nodeId), previewImages)
  }

  function revokePreviewsByExecutionId(executionId: NodeExecutionId) {
    const nodeLocatorId = executionIdToNodeLocatorId(app.rootGraph, executionId)
    if (!nodeLocatorId) return
    scheduleRevoke(nodeLocatorId, () =>
      revokePreviewsByLocatorId(nodeLocatorId)
    )
  }

  function revokePreviewsByLocatorId(nodeLocatorId: NodeLocatorId) {
    const previews = app.nodePreviewImages[nodeLocatorId]
    if (!previews?.[Symbol.iterator]) return

    for (const url of previews) {
      releaseSharedObjectUrl(url)
    }

    delete app.nodePreviewImages[nodeLocatorId]
    delete nodePreviewImages.value[nodeLocatorId]
  }

  function revokeAllPreviews() {
    for (const nodeLocatorId of Object.keys(app.nodePreviewImages)) {
      const previews = app.nodePreviewImages[nodeLocatorId]
      if (!previews?.[Symbol.iterator]) continue

      for (const url of previews) {
        releaseSharedObjectUrl(url)
      }
    }
    app.nodePreviewImages = {}
    nodePreviewImages.value = {}
  }

  function revokeSubgraphPreviews(subgraphNode: SubgraphNode) {
    const { graph } = subgraphNode
    if (!graph) return

    revokePreviewsByLocatorId(
      createNodeLocatorId(graph.isRootGraph ? null : graph.id, subgraphNode.id)
    )
    for (const node of subgraphNode.subgraph.nodes) {
      revokePreviewsByLocatorId(
        createNodeLocatorId(subgraphNode.subgraph.id, node.id)
      )
    }
  }

  function removeOutputsByLocatorId(nodeLocatorId: NodeLocatorId) {
    const hadOutputs = !!app.nodeOutputs[nodeLocatorId]
    delete app.nodeOutputs[nodeLocatorId]
    delete nodeOutputs.value[nodeLocatorId]

    if (app.nodePreviewImages[nodeLocatorId]) {
      const previews = app.nodePreviewImages[nodeLocatorId]
      if (previews?.[Symbol.iterator]) {
        for (const url of previews) {
          releaseSharedObjectUrl(url)
        }
      }
      delete app.nodePreviewImages[nodeLocatorId]
      delete nodePreviewImages.value[nodeLocatorId]
    }

    return hadOutputs
  }

  function removeNodeOutputs(nodeId: NodeId) {
    const nodeLocatorId = nodeIdToNodeLocatorId(nodeId)
    if (!nodeLocatorId) return false
    return removeOutputsByLocatorId(nodeLocatorId)
  }

  function removeNodeOutputsForNode(node: LGraphNode) {
    return removeOutputsByLocatorId(nodeToNodeLocatorId(node))
  }

  function snapshotOutputs(): Record<string, ExecutedWsMessage['output']> {
    return clone(app.nodeOutputs)
  }

  function restoreOutputs(
    outputs: Record<string, ExecutedWsMessage['output']>
  ) {
    const parsedOutputs = mapKeys(
      outputs,
      (_, id) => executionIdToNodeLocatorId(app.rootGraph, id) ?? id
    )
    app.nodeOutputs = parsedOutputs
    nodeOutputs.value = { ...parsedOutputs }
  }

  function updateNodeImages(node: LGraphNode) {
    if (!node.images?.length) return

    const nodeLocatorId = nodeIdToNodeLocatorId(node.id)

    if (nodeLocatorId) {
      const existingOutputs = app.nodeOutputs[nodeLocatorId]

      if (existingOutputs) {
        const updatedOutputs = {
          ...existingOutputs,
          images: node.images
        }

        app.nodeOutputs[nodeLocatorId] = updatedOutputs
        nodeOutputs.value[nodeLocatorId] = updatedOutputs
      }
    }
  }

  function refreshNodeOutputs(node: LGraphNode) {
    const locatorId = nodeToNodeLocatorId(node)
    if (!locatorId) return

    const outputs = app.nodeOutputs[locatorId]
    if (!outputs) return

    nodeOutputs.value[locatorId] = { ...outputs }
  }

  function resetAllOutputsAndPreviews() {
    app.nodeOutputs = {}
    nodeOutputs.value = {}
    revokeAllPreviews()
  }

  function syncLegacyNodeImgs(
    nodeId: NodeId,
    element: HTMLImageElement,
    activeIndex: number = 0
  ) {
    if (!LiteGraph.vueNodesMode) return

    const node = resolveNode(nodeId)
    if (!node) return

    node.imgs = [element]
    node.imageIndex = activeIndex

    const outputs = getNodeOutputs(node)
    if (outputs?.images) node.images = outputs.images
  }

  return {
    getNodeOutputs,
    getNodeImageUrls,
    getNodeImageUrlsByExecutionId,
    getNodeOutputByExecutionId,
    getNodePreviewImagesByExecutionId,
    getNodePreviews,
    getPreviewParam,

    setNodeOutputs,
    setNodeOutputsByExecutionId,
    setNodePreviewsByExecutionId,
    setNodePreviewsByLocatorId,
    setNodePreviewsByNodeId,
    updateNodeImages,
    refreshNodeOutputs,
    syncLegacyNodeImgs,

    revokePreviewsByExecutionId,
    revokePreviewsByLocatorId,
    revokeAllPreviews,
    revokeSubgraphPreviews,
    removeNodeOutputs,
    removeNodeOutputsForNode,
    removeOutputsByLocatorId,
    snapshotOutputs,
    restoreOutputs,
    resetAllOutputsAndPreviews,

    nodeOutputs,
    nodePreviewImages,
    latestPreview
  }
})
