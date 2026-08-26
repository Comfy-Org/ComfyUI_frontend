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
import { isInputPreviewOutput } from '@/utils/nodeOutputUtil'
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
  const workflowStore = useWorkflowStore()
  const { nodeIdToNodeLocatorId, nodeToNodeLocatorId } = workflowStore
  const scheduledRevoke: Record<NodeLocatorId, { stop: () => void }> = {}
  const latestPreview = ref<string[]>([])
  /**
   * Previews belonging to open-but-inactive workflows, keyed by workflow path.
   * The stash owns the object URL retain taken when the previews were set.
   */
  const stashedPreviews = new Map<string, Record<string, string[]>>()

  function scheduleRevoke(locator: NodeLocatorId, cb: () => void) {
    scheduledRevoke[locator]?.stop()

    const { stop } = useTimeoutFn(() => {
      delete scheduledRevoke[locator]
      cb()
    }, PREVIEW_REVOKE_DELAY_MS)

    scheduledRevoke[locator] = { stop }
  }

  const nodeOutputs = ref<Record<string, ExecutedWsMessage['output']>>({
    ...app.nodeOutputs
  })
  const nodePreviewImages = ref<Record<string, string[]>>(
    Object.fromEntries(
      Object.entries(app.nodePreviewImages || {}).map(([id, urls]) => [
        id,
        [...urls]
      ])
    )
  )

  function getNodeOutputs(
    node: LGraphNode
  ): ExecutedWsMessage['output'] | undefined {
    return nodeOutputs.value[nodeToNodeLocatorId(node)]
  }

  function getNodePreviews(node: LGraphNode): string[] | undefined {
    return nodePreviewImages.value[nodeToNodeLocatorId(node)]
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
      isInputPreviewOutput(nodeOutputs.value[nodeLocatorId])
    ) {
      outputs = {
        ...outputs,
        images: nodeOutputs.value[nodeLocatorId].images
      }
    }

    if (options.merge) {
      const existingOutput = nodeOutputs.value[nodeLocatorId]
      if (existingOutput && outputs) {
        const mergedOutput = { ...existingOutput }
        for (const k in outputs) {
          const existingValue = existingOutput[k]
          const newValue = (outputs as Record<string, unknown>)[k]

          if (Array.isArray(existingValue) && Array.isArray(newValue)) {
            mergedOutput[k] = existingValue.concat(newValue)
          } else {
            mergedOutput[k] = newValue
          }
        }
        nodeOutputs.value[nodeLocatorId] = mergedOutput
        app.nodeOutputs[nodeLocatorId] = clone(mergedOutput)
        return
      }
    }

    nodeOutputs.value[nodeLocatorId] = outputs
    app.nodeOutputs[nodeLocatorId] = clone(outputs)
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

  function setNodeOutputImages(
    node: LGraphNode,
    images: NonNullable<ExecutedWsMessage['output']['images']>
  ) {
    const locatorId = nodeToNodeLocatorId(node)
    if (!locatorId) return

    setOutputsByLocatorId(locatorId, {
      ...nodeOutputs.value[locatorId],
      images
    })
    node.images = images
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
    latestPreview.value = [...previewImages]
  }

  function setNodePreviewsByLocatorId(
    nodeLocatorId: NodeLocatorId,
    previewImages: string[]
  ) {
    const existingPreviews = nodePreviewImages.value[nodeLocatorId]
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
    nodePreviewImages.value[nodeLocatorId] = [...previewImages]
    app.nodePreviewImages[nodeLocatorId] = [...previewImages]
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
    const previews = nodePreviewImages.value[nodeLocatorId]
    if (!previews?.[Symbol.iterator]) return

    for (const url of previews) {
      releaseSharedObjectUrl(url)
    }

    delete nodePreviewImages.value[nodeLocatorId]
    delete app.nodePreviewImages[nodeLocatorId]
  }

  function releasePreviewUrls(previews: Record<string, string[]>) {
    for (const urls of Object.values(previews)) {
      if (!urls?.[Symbol.iterator]) continue

      for (const url of urls) {
        releaseSharedObjectUrl(url)
      }
    }
  }

  function revokeAllPreviews() {
    releasePreviewUrls(nodePreviewImages.value)
    nodePreviewImages.value = {}
    app.nodePreviewImages = {}
  }

  /** Release the previews held for a workflow that is going away. */
  function discardPreviewsForWorkflow(workflowPath: string) {
    const stashed = stashedPreviews.get(workflowPath)
    if (!stashed) return

    stashedPreviews.delete(workflowPath)
    releasePreviewUrls(stashed)
  }

  function discardClosedWorkflowPreviews() {
    const openPaths = new Set(workflowStore.openWorkflows.map((wf) => wf.path))
    for (const path of [...stashedPreviews.keys()]) {
      if (!openPaths.has(path)) discardPreviewsForWorkflow(path)
    }
  }

  /**
   * Move the live previews into the stash so `app.clean()` cannot revoke them
   * while `workflowPath` is loaded out of the editor. Preview frames arrive
   * over the websocket and cannot be re-fetched, so releasing their object
   * URLs on a tab switch loses them for good.
   */
  function stashPreviewsForWorkflow(workflowPath: string) {
    discardClosedWorkflowPreviews()
    discardPreviewsForWorkflow(workflowPath)

    const previews = nodePreviewImages.value
    if (Object.keys(previews).length) {
      stashedPreviews.set(workflowPath, previews)
    }
    nodePreviewImages.value = {}
    app.nodePreviewImages = {}
  }

  function restorePreviewsForWorkflow(workflowPath: string | undefined) {
    if (!workflowPath) return

    const stashed = stashedPreviews.get(workflowPath)
    if (!stashed) return
    stashedPreviews.delete(workflowPath)

    const live = nodePreviewImages.value
    const superseded: Record<string, string[]> = {}
    for (const [nodeLocatorId, urls] of Object.entries(stashed)) {
      // A preview that arrived while the graph was loading wins; the stashed
      // copy for that node then has no owner left to release it.
      if (nodeLocatorId in live) superseded[nodeLocatorId] = urls
      else live[nodeLocatorId] = urls
    }
    releasePreviewUrls(superseded)
    nodePreviewImages.value = { ...live }
    app.nodePreviewImages = clone(nodePreviewImages.value)
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
    const hadOutputs = !!nodeOutputs.value[nodeLocatorId]
    delete nodeOutputs.value[nodeLocatorId]
    delete app.nodeOutputs[nodeLocatorId]

    if (nodePreviewImages.value[nodeLocatorId]) {
      const previews = nodePreviewImages.value[nodeLocatorId]
      if (previews?.[Symbol.iterator]) {
        for (const url of previews) {
          releaseSharedObjectUrl(url)
        }
      }
      delete nodePreviewImages.value[nodeLocatorId]
      delete app.nodePreviewImages[nodeLocatorId]
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
    return clone(nodeOutputs.value)
  }

  function replaceOutputsFromLegacy(
    outputs: Record<string, ExecutedWsMessage['output']>
  ) {
    const parsedOutputs = mapKeys(
      outputs,
      (_, id) => executionIdToNodeLocatorId(app.rootGraph, id) ?? id
    )
    nodeOutputs.value = { ...parsedOutputs }
  }

  function restoreOutputs(
    outputs: Record<string, ExecutedWsMessage['output']>
  ) {
    replaceOutputsFromLegacy(outputs)
    app.nodeOutputs = clone(nodeOutputs.value)
  }

  function refreshNodeOutputs(node: LGraphNode) {
    const locatorId = nodeToNodeLocatorId(node)
    if (!locatorId) return

    const outputs = nodeOutputs.value[locatorId]
    if (!outputs) return

    nodeOutputs.value[locatorId] = { ...outputs }
  }

  function resetAllOutputsAndPreviews() {
    nodeOutputs.value = {}
    app.nodeOutputs = {}
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
    setNodeOutputImages,
    setNodeOutputsByExecutionId,
    setNodePreviewsByExecutionId,
    setNodePreviewsByLocatorId,
    setNodePreviewsByNodeId,
    refreshNodeOutputs,
    syncLegacyNodeImgs,

    revokePreviewsByExecutionId,
    revokePreviewsByLocatorId,
    revokeAllPreviews,
    revokeSubgraphPreviews,
    stashPreviewsForWorkflow,
    restorePreviewsForWorkflow,
    discardPreviewsForWorkflow,
    removeNodeOutputs,
    removeNodeOutputsForNode,
    snapshotOutputs,
    replaceOutputsFromLegacy,
    restoreOutputs,
    resetAllOutputsAndPreviews,

    nodeOutputs,
    nodePreviewImages,
    latestPreview
  }
})
