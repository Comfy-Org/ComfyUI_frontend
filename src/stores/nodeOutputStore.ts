import { useTimeoutFn } from '@vueuse/core'
import { isEqual, mapKeys, mapValues, pickBy } from 'es-toolkit'
import { defineStore } from 'pinia'
import { onScopeDispose, ref, toRaw } from 'vue'

import type {
  LGraph,
  LGraphNode,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import { onGraphIntent } from '@/lib/litegraph/src/graphIntents'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type {
  ExecutedWsMessage,
  ResultItem
} from '@comfyorg/api-client/executionTypes'
import type { ResultItemType } from '@comfyorg/api-client/resultItemTypeSchema'
import { parseNodeOutput } from '@/stores/resultItemParsing'
import { resultItemPreviewUrl, resultItemUrl } from '@/utils/resultItemUrl'
import { api } from '@/scripts/api'
import { useApp } from '@/scripts/appInstance'
import { clone } from '@/scripts/utils'
import { reportError } from '@comfyorg/telemetry/reportError'
import {
  createNodeLocatorId,
  parseNodeLocatorId,
  tryNormalizeNodeExecutionId
} from '@comfyorg/graph-model/nodeIdentification'
import type {
  NodeExecutionId,
  NodeLocatorId
} from '@comfyorg/graph-model/nodeIdentification'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { parseAnnotatedPath } from '@/utils/createAnnotatedPath'
import { parseFilePath } from '@/utils/formatUtil'
import {
  executionIdToNodeLocatorId,
  getNodeByLocatorId
} from '@/utils/graphTraversalUtil'
import { parseImageWidgetValue } from '@/utils/imageUtil'
import {
  isAnimatedOutput,
  isVideoNode,
  resolveNode
} from '@/utils/litegraphUtil'
import { isInputPreviewOutput, mergeNodeOutput } from '@/utils/nodeOutputUtil'
import type { NodeOutputLayers } from '@/utils/nodeOutputUtil'
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
    animated: filenames.map((image) => {
      const { filepath } = parseAnnotatedPath(image, type)
      return (
        isAnimated && (filepath.endsWith('.webp') || filepath.endsWith('.png'))
      )
    })
  }
}

function isResolvedPreviewOf(
  output: ExecutedWsMessage['output'] | undefined,
  widgetValue: string
): boolean {
  const images = output?.images ?? []
  if (images.length !== 1 || !images[0].preview_id) return false
  const [image] = images
  const { filename, subfolder, type } = parseImageWidgetValue(widgetValue)
  return (
    image.filename === filename &&
    (image.subfolder ?? '') === subfolder &&
    image.type === type
  )
}

const isResultItem = (
  image: ResultItem | null | undefined
): image is ResultItem => image != null

interface SetOutputOptions {
  merge?: boolean
}

type NodePreviewMap = Partial<Record<string, string[]>>
type InstanceMap<T> = Partial<Record<string, Partial<Record<string, T>>>>
type InstancePreviewMap = InstanceMap<string[]>
type RevokeTimers = Partial<Record<string, { stop: () => void }>>
interface PreviewStash {
  shared: NodePreviewMap
  instances: InstancePreviewMap
}
type RuntimeOutput = Pick<ExecutedWsMessage['output'], 'animated'> & {
  images?: (ResultItem | null)[]
}

function locatesInGraph(
  rootGraph: LGraph | undefined,
  nodeLocatorId: string
): boolean {
  const subgraphUuid = parseNodeLocatorId(nodeLocatorId)?.subgraphUuid
  return !subgraphUuid || !!rootGraph?.subgraphs.has(subgraphUuid)
}

function isInteriorLocator(nodeLocatorId: NodeLocatorId): boolean {
  return !!parseNodeLocatorId(nodeLocatorId)?.subgraphUuid
}

function preserveInputPreviewImages(
  existingOutput: ExecutedWsMessage['output'] | undefined,
  outputs: ExecutedWsMessage['output'] | ResultItem
): ExecutedWsMessage['output'] {
  const incomingImages = 'images' in outputs ? outputs.images : undefined
  if (Array.isArray(incomingImages) && incomingImages.length > 0) return outputs
  return isInputPreviewOutput(existingOutput)
    ? { ...outputs, images: existingOutput.images }
    : outputs
}

function inputPreviewOf(
  output: ExecutedWsMessage['output'] | undefined
): ExecutedWsMessage['output'] | undefined {
  return isInputPreviewOutput(output) ? { images: output.images } : undefined
}

function mergeOutput(
  existingOutput: ExecutedWsMessage['output'] | undefined,
  outputs: ExecutedWsMessage['output'] | ResultItem,
  { merge }: SetOutputOptions
): ExecutedWsMessage['output'] {
  const merged =
    merge && existingOutput ? mergeNodeOutput(existingOutput, outputs) : outputs
  return preserveInputPreviewImages(existingOutput, merged)
}

/** Writes one execution's output into both layers and returns the node's new shared output. */
export function writeExecutedOutput(
  layers: NodeOutputLayers,
  nodeLocatorId: NodeLocatorId,
  executionId: NodeExecutionId,
  outputs: ExecutedWsMessage['output'] | ResultItem,
  options: SetOutputOptions
): ExecutedWsMessage['output'] {
  const shared = layers.shared[nodeLocatorId]
  const merged = mergeOutput(shared, outputs, options)
  layers.shared[nodeLocatorId] = merged
  if (isInteriorLocator(nodeLocatorId)) {
    const instances = (layers.instances[nodeLocatorId] ??= {})
    instances[executionId] = mergeOutput(
      instances[executionId] ?? inputPreviewOf(shared),
      outputs,
      options
    )
  }
  return merged
}

function forEachDetachedInstance<T>(
  rootGraph: LGraph | undefined,
  instances: InstanceMap<T>,
  visit: (group: Partial<Record<string, T>>, executionId: string) => void
) {
  for (const [nodeLocatorId, group = {}] of Object.entries(instances)) {
    for (const executionId of Object.keys(group)) {
      if (executionIdToNodeLocatorId(rootGraph, executionId) !== nodeLocatorId)
        visit(group, executionId)
    }
  }
}

export const useNodeOutputStore = defineStore('nodeOutput', () => {
  const workflowStore = useWorkflowStore()
  const { nodeIdToNodeLocatorId, nodeToNodeLocatorId } = workflowStore
  const sharedRevokes: RevokeTimers = {}
  const instanceRevokes: RevokeTimers = {}
  const latestPreview = ref<string[]>([])
  /**
   * Previews belonging to open-but-inactive workflows, keyed by workflow path.
   * The stash owns the object URL retain taken when the previews were set.
   */
  const stashedPreviews = new Map<string, PreviewStash>()

  function scheduleRevoke(timers: RevokeTimers, key: string, cb: () => void) {
    timers[key]?.stop()

    const { stop } = useTimeoutFn(() => {
      delete timers[key]
      cb()
    }, PREVIEW_REVOKE_DELAY_MS)

    timers[key] = { stop }
  }

  function cancelRevoke(timers: RevokeTimers, key: string) {
    timers[key]?.stop()
    delete timers[key]
  }

  const nodeOutputs = ref<Partial<Record<string, ExecutedWsMessage['output']>>>(
    {
      ...useApp().nodeOutputs
    }
  )
  const nodePreviewImages = ref<NodePreviewMap>(
    Object.fromEntries(
      Object.entries(useApp().nodePreviewImages).flatMap(([id, urls]) =>
        urls ? [[id, [...urls]]] : []
      )
    )
  )
  const instanceOutputs = ref<InstanceMap<ExecutedWsMessage['output']>>({})
  const instancePreviewImages = ref<InstancePreviewMap>({})

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
    outputs: RuntimeOutput
  ): boolean => {
    if (isAnimatedOutput(outputs) || isVideoNode(node)) return false

    const images = outputs.images?.filter((image) => image !== null)
    if (!images?.length) return false

    if (images.some((image) => image.filename?.toLowerCase().endsWith('.svg')))
      return false

    return true
  }

  function getPreviewParam(
    node: LGraphNode,
    outputs: ExecutedWsMessage['output']
  ): string {
    return isImageOutputs(node, outputs) ? useApp().getPreviewFormatParam() : ''
  }

  const randParamByOutputs = new WeakMap<object, string>()

  function randParamFor(outputs: ExecutedWsMessage['output']): string {
    const key = toRaw(outputs)
    let rand = randParamByOutputs.get(key)
    if (rand === undefined) {
      rand = useApp().getRandParam()
      randParamByOutputs.set(key, rand)
    }
    return rand
  }

  function getNodeOutputItems(
    node: LGraphNode,
    outputs = getNodeOutputs(node)
  ) {
    if (!outputs) return []
    const rand = randParamFor(outputs)
    return parseNodeOutput(node.id, outputs).map((item) => {
      const { filepath, rootFolder } = parseAnnotatedPath(
        item.filename,
        item.type
      )
      const result = {
        ...item,
        filename:
          node.comfyClass === 'LoadImageOutput' ? item.filename : filepath,
        type: rootFolder
      }
      return {
        ...result,
        url: result.url ?? resultItemUrl(result) + rand,
        previewUrl: resultItemPreviewUrl(result, {
          previewFormat: getPreviewParam(node, outputs),
          rand
        })
      }
    })
  }

  function buildImageUrls(
    node: LGraphNode,
    outputs: ExecutedWsMessage['output'] | undefined
  ): string[] | undefined {
    if (!outputs?.images?.length) return

    const rand = randParamFor(outputs)
    const previewParam = getPreviewParam(node, outputs)

    return outputs.images.filter(isResultItem).map((image) => {
      const filename = image.filename ?? ''
      const { filepath, rootFolder } = parseAnnotatedPath(filename, image.type)
      const params = new URLSearchParams({
        ...image,
        filename: node.comfyClass === 'LoadImageOutput' ? filename : filepath,
        type: rootFolder
      })
      return api.apiURL(`/view?${params}${previewParam}${rand}`)
    })
  }

  function getNodeImageUrls(node: LGraphNode): string[] | undefined {
    const previews = getNodePreviews(node)
    if (previews?.length) return previews

    return buildImageUrls(node, getNodeOutputs(node))
  }

  function resolveLocator(
    executionId: NodeExecutionId
  ): NodeLocatorId | undefined {
    return executionIdToNodeLocatorId(
      useApp().rootGraphOrUndefined,
      executionId
    )
  }

  /**
   * Outputs of one instance. Inside a subgraph, falls back to the node's shared
   * outputs only while no instance of the node has executed.
   */
  function getNodeOutputByExecutionId(
    executionId: NodeExecutionId
  ): ExecutedWsMessage['output'] | undefined {
    const locatorId = resolveLocator(executionId)
    if (!locatorId) return undefined
    const shared = nodeOutputs.value[locatorId]
    const instances = instanceOutputs.value[locatorId]
    if (!shared || !instances || !isInteriorLocator(locatorId)) return shared
    return instances[executionId]
  }

  /** Reads one instance's live previews; see {@link getNodeOutputByExecutionId}. */
  function getNodePreviewImagesByExecutionId(
    executionId: NodeExecutionId
  ): string[] | undefined {
    const locatorId = resolveLocator(executionId)
    if (!locatorId) return undefined
    const instances = instancePreviewImages.value[locatorId]
    if (!instances || !isInteriorLocator(locatorId))
      return nodePreviewImages.value[locatorId]
    return instances[executionId]
  }

  function getNodeImageUrlsByExecutionId(
    executionId: NodeExecutionId,
    node: LGraphNode
  ): string[] | undefined {
    const previews = getNodePreviewImagesByExecutionId(executionId)
    if (previews?.length) return previews

    return buildImageUrls(node, getNodeOutputByExecutionId(executionId))
  }

  function writeSharedOutputs(
    nodeLocatorId: NodeLocatorId,
    outputs: ExecutedWsMessage['output']
  ) {
    nodeOutputs.value[nodeLocatorId] = outputs
    useApp().nodeOutputs[nodeLocatorId] = clone(outputs)
  }

  /** Sets outputs that belong to the node rather than one execution, for every instance. */
  function setOutputsByLocatorId(
    nodeLocatorId: NodeLocatorId,
    outputs: ExecutedWsMessage['output'] | ResultItem | null | undefined,
    options: SetOutputOptions = {}
  ) {
    if (outputs == null) return

    delete instanceOutputs.value[nodeLocatorId]
    writeSharedOutputs(
      nodeLocatorId,
      mergeOutput(nodeOutputs.value[nodeLocatorId], outputs, options)
    )
  }

  function setNodeOutputs(
    node: LGraphNode | null | undefined,
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
      const existingOutput = nodeOutputs.value[locatorId]
      const outputs = createOutputs([filenames], folder, isAnimated)
      setOutputsByLocatorId(
        locatorId,
        isResolvedPreviewOf(existingOutput, filenames)
          ? { ...outputs, images: existingOutput?.images }
          : outputs
      )
    } else if (!Array.isArray(filenames)) {
      setOutputsByLocatorId(locatorId, filenames)
    } else {
      const resultItems = createOutputs(filenames, folder, isAnimated)
      if (!resultItems.images?.length) return
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

  /**
   * Replaces a node's output with exactly these images, dropping any media
   * metadata the previous output carried. `animated`, `video` and friends are
   * parallel to the images they were produced with, so an editor that rewrites
   * the image list wholesale must not inherit them.
   */
  function replaceNodeOutputImages(
    node: LGraphNode,
    images: NonNullable<ExecutedWsMessage['output']['images']>
  ) {
    if (!images.length) return

    const locatorId = nodeToNodeLocatorId(node)
    if (!locatorId) return

    revokePreviewsByLocatorId(locatorId)
    setOutputsByLocatorId(locatorId, { images })
    node.images = images
  }

  function setNodeOutputsByExecutionId(
    executionId: NodeExecutionId,
    outputs: ExecutedWsMessage['output'] | ResultItem | null | undefined,
    options: SetOutputOptions = {}
  ) {
    const rootGraph = useApp().rootGraphOrUndefined
    const nodeLocatorId = executionIdToNodeLocatorId(rootGraph, executionId)
    const node =
      rootGraph && nodeLocatorId
        ? getNodeByLocatorId(rootGraph, nodeLocatorId)
        : undefined
    if (!nodeLocatorId || (rootGraph && !node)) {
      reportUnresolvedExecutionId(executionId, outputs)
      return
    }
    const emptyTextOutput =
      outputs == null &&
      (node?.comfyClass === 'PreviewAny' || node?.comfyClass === 'SaveText')
    writeExecutedOutputs(
      nodeLocatorId,
      executionId,
      emptyTextOutput ? {} : outputs,
      emptyTextOutput ? {} : options
    )
  }

  function writeExecutedOutputs(
    nodeLocatorId: NodeLocatorId,
    executionId: NodeExecutionId,
    outputs: ExecutedWsMessage['output'] | ResultItem | null | undefined,
    options: SetOutputOptions
  ) {
    if (outputs == null) return

    const shared = writeExecutedOutput(
      { shared: nodeOutputs.value, instances: instanceOutputs.value },
      nodeLocatorId,
      executionId,
      outputs,
      options
    )
    useApp().nodeOutputs[nodeLocatorId] = clone(shared)
  }

  function reportUnresolvedExecutionId(
    executionId: NodeExecutionId,
    outputs: ExecutedWsMessage['output'] | ResultItem | null | undefined
  ) {
    const incomingImages =
      typeof outputs === 'object' && outputs !== null && 'images' in outputs
        ? outputs.images
        : undefined
    const filenames = Array.isArray(incomingImages)
      ? incomingImages
          .filter(isResultItem)
          .map((image) => image.filename)
          .filter((filename): filename is string => !!filename)
      : undefined
    reportError(new Error('No live node resolves the executed output'), {
      surface: 'graph',
      errorType: 'failure_resolving_node_output_execution_id',
      level: 'warning',
      sentryMode: 'never',
      tags: { executionId },
      context: {
        filenames: filenames?.length ? filenames : undefined
      }
    })
  }

  function setNodePreviewsByExecutionId(
    executionId: NodeExecutionId,
    previewImages: string[]
  ) {
    const nodeLocatorId = resolveLocator(executionId)
    if (!nodeLocatorId) return
    writeSharedPreviews(nodeLocatorId, previewImages)
    if (isInteriorLocator(nodeLocatorId)) {
      cancelRevoke(instanceRevokes, executionId)
      const instances = (instancePreviewImages.value[nodeLocatorId] ??= {})
      releaseUrls(instances[executionId])
      instances[executionId] = retainUrls(previewImages)
    }
    latestPreview.value = [...previewImages]
  }

  function retainUrls(urls: string[]): string[] {
    for (const url of urls) retainSharedObjectUrl(url)
    return [...urls]
  }

  function releaseUrls(urls: string[] | undefined) {
    for (const url of urls ?? []) releaseSharedObjectUrl(url)
  }

  function writeSharedPreviews(
    nodeLocatorId: NodeLocatorId,
    previewImages: string[]
  ) {
    cancelRevoke(sharedRevokes, nodeLocatorId)
    releaseUrls(nodePreviewImages.value[nodeLocatorId])
    nodePreviewImages.value[nodeLocatorId] = retainUrls(previewImages)
    useApp().nodePreviewImages[nodeLocatorId] = [...previewImages]
  }

  /** Sets previews that belong to the node rather than one execution, for every instance. */
  function setNodePreviewsByLocatorId(
    nodeLocatorId: NodeLocatorId,
    previewImages: string[]
  ) {
    releaseInstancePreviews(nodeLocatorId)
    writeSharedPreviews(nodeLocatorId, previewImages)
  }

  function setNodePreviewsByNodeId(nodeId: NodeId, previewImages: string[]) {
    setNodePreviewsByLocatorId(nodeIdToNodeLocatorId(nodeId), previewImages)
  }

  function revokePreviewsByExecutionId(executionId: NodeExecutionId) {
    const nodeLocatorId = resolveLocator(executionId)
    if (!nodeLocatorId) return
    const sharedFrame = nodePreviewImages.value[nodeLocatorId]
    const instances = instancePreviewImages.value[nodeLocatorId]
    const instanceFrame = instances?.[executionId]

    if (!instances || isEqual(sharedFrame, instanceFrame))
      scheduleRevoke(sharedRevokes, nodeLocatorId, () => {
        if (nodePreviewImages.value[nodeLocatorId] === sharedFrame)
          releaseSharedPreviews(nodeLocatorId)
      })
    if (!instanceFrame) return

    scheduleRevoke(instanceRevokes, executionId, () => {
      const current = instancePreviewImages.value[nodeLocatorId]
      if (current?.[executionId] !== instanceFrame) return
      releaseUrls(instanceFrame)
      delete current[executionId]
    })
  }

  function releaseSharedPreviews(nodeLocatorId: NodeLocatorId) {
    const previews = nodePreviewImages.value[nodeLocatorId]
    if (!previews) return

    releaseUrls(previews)
    delete nodePreviewImages.value[nodeLocatorId]
    delete useApp().nodePreviewImages[nodeLocatorId]
  }

  function releaseInstancePreviews(nodeLocatorId: NodeLocatorId) {
    const instances = instancePreviewImages.value[nodeLocatorId]
    if (!instances) return

    for (const urls of Object.values(instances)) releaseUrls(urls)
    delete instancePreviewImages.value[nodeLocatorId]
  }

  /** Removes the node's previews from every instance. */
  function revokePreviewsByLocatorId(nodeLocatorId: NodeLocatorId) {
    releaseInstancePreviews(nodeLocatorId)
    releaseSharedPreviews(nodeLocatorId)
  }

  function releasePreviewUrls(previews: NodePreviewMap) {
    for (const urls of Object.values(previews)) {
      if (!urls) continue

      for (const url of urls) {
        releaseSharedObjectUrl(url)
      }
    }
  }

  function releaseInstancePreviewUrls(instances: InstancePreviewMap) {
    for (const group of Object.values(instances))
      releasePreviewUrls(group ?? {})
  }

  function clearLivePreviews() {
    nodePreviewImages.value = {}
    instancePreviewImages.value = {}
    useApp().nodePreviewImages = {}
  }

  function revokeAllPreviews() {
    releasePreviewUrls(nodePreviewImages.value)
    releaseInstancePreviewUrls(instancePreviewImages.value)
    clearLivePreviews()
  }

  /** Release the previews held for a workflow that is going away. */
  function discardPreviewsForWorkflow(workflowPath: string) {
    const stashed = stashedPreviews.get(workflowPath)
    if (!stashed) return

    stashedPreviews.delete(workflowPath)
    releasePreviewUrls(stashed.shared)
    releaseInstancePreviewUrls(stashed.instances)
  }

  function discardClosedWorkflowPreviews() {
    const openPaths = new Set(workflowStore.openWorkflows.map((wf) => wf.path))
    for (const path of Array.from(stashedPreviews.keys())) {
      if (!openPaths.has(path)) discardPreviewsForWorkflow(path)
    }
  }

  function stashPreviewsForWorkflow(workflowPath: string) {
    discardClosedWorkflowPreviews()

    const stash: PreviewStash = {
      shared: nodePreviewImages.value,
      instances: instancePreviewImages.value
    }
    if (
      Object.keys(stash.shared).length ||
      Object.keys(stash.instances).length
    ) {
      discardPreviewsForWorkflow(workflowPath)
      stashedPreviews.set(workflowPath, stash)
    }
    clearLivePreviews()
  }

  function addLivePreviewsToStash(workflowPath: string) {
    const stashed = stashedPreviews.get(workflowPath)
    if (!stashed) {
      stashPreviewsForWorkflow(workflowPath)
      return
    }

    const superseded: string[][] = []
    function moveInto(target: NodePreviewMap, live: NodePreviewMap) {
      for (const [key, urls] of Object.entries(live)) {
        if (!urls) continue

        const replaced = target[key]
        if (replaced) superseded.push(replaced)
        target[key] = urls
      }
    }
    moveInto(stashed.shared, nodePreviewImages.value)
    for (const [nodeLocatorId, group] of Object.entries(
      instancePreviewImages.value
    )) {
      moveInto((stashed.instances[nodeLocatorId] ??= {}), group ?? {})
    }
    for (const urls of superseded) releaseUrls(urls)
    clearLivePreviews()
  }

  function restorePreviewsForWorkflow(workflowPath: string | undefined) {
    if (!workflowPath) return

    const stashed = stashedPreviews.get(workflowPath)
    if (!stashed) return
    stashedPreviews.delete(workflowPath)

    const rootGraph = useApp().rootGraphOrUndefined
    const released: string[][] = []
    function restoreInto(
      live: NodePreviewMap,
      stashedMap: NodePreviewMap,
      nodeLocatorIdOf: (key: string) => string
    ) {
      for (const [key, urls] of Object.entries(stashedMap)) {
        if (!urls) continue

        if (live[key] || !locatesInGraph(rootGraph, nodeLocatorIdOf(key)))
          released.push(urls)
        else live[key] = urls
      }
    }

    const live = nodePreviewImages.value
    restoreInto(live, stashed.shared, (key) => key)
    const liveInstances = instancePreviewImages.value
    for (const [nodeLocatorId, group] of Object.entries(stashed.instances)) {
      restoreInto(
        (liveInstances[nodeLocatorId] ??= {}),
        group ?? {},
        () => nodeLocatorId
      )
    }
    for (const urls of released) releaseUrls(urls)
    nodePreviewImages.value = { ...live }
    instancePreviewImages.value = { ...liveInstances }
    useApp().nodePreviewImages = clone(nodePreviewImages.value)
  }

  function pruneDetachedInstances() {
    const rootGraph = useApp().rootGraphOrUndefined
    forEachDetachedInstance(
      rootGraph,
      instanceOutputs.value,
      (group, executionId) => {
        delete group[executionId]
      }
    )
    forEachDetachedInstance(
      rootGraph,
      instancePreviewImages.value,
      (group, executionId) => {
        cancelRevoke(instanceRevokes, executionId)
        releaseUrls(group[executionId])
        delete group[executionId]
      }
    )
  }

  onScopeDispose(
    onGraphIntent((intent) => {
      if (intent.type === 'remove_node' && intent.node.isSubgraphNode())
        pruneDetachedInstances()
    })
  )

  function revokeSubgraphPreviews(subgraphNode: SubgraphNode, graph: LGraph) {
    revokePreviewsByLocatorId(
      createNodeLocatorId(graph.isRootGraph ? null : graph.id, subgraphNode.id)
    )
    for (const node of subgraphNode.subgraph.nodes) {
      releaseSharedPreviews(
        createNodeLocatorId(subgraphNode.subgraph.id, node.id)
      )
    }
  }

  function removeOutputsByLocatorId(nodeLocatorId: NodeLocatorId) {
    const hadOutputs = !!nodeOutputs.value[nodeLocatorId]
    delete nodeOutputs.value[nodeLocatorId]
    delete instanceOutputs.value[nodeLocatorId]
    delete useApp().nodeOutputs[nodeLocatorId]
    revokePreviewsByLocatorId(nodeLocatorId)

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

  /** Both output layers, detached from the store. */
  function snapshotOutputs(): NodeOutputLayers {
    return clone({
      shared: pickBy(
        toRaw(nodeOutputs.value),
        (_, locatorId) => !outlivedEveryInstance(locatorId)
      ),
      instances: toRaw(instanceOutputs.value)
    })
  }

  function outlivedEveryInstance(locatorId: string) {
    const instances = instanceOutputs.value[locatorId]
    return !!instances && Object.keys(instances).length === 0
  }

  function replaceOutputsFromLegacy(
    outputs: Partial<Record<string, ExecutedWsMessage['output']>>
  ) {
    const parsedOutputs = mapKeys(
      outputs,
      (_, id) => executionIdToNodeLocatorId(useApp().rootGraph, id) ?? id
    )
    nodeOutputs.value = { ...parsedOutputs }
    instanceOutputs.value = pickBy(
      instanceOutputs.value,
      (_, nodeLocatorId) => nodeLocatorId in parsedOutputs
    )
  }

  function setOutputFromLegacy(
    id: string,
    output: ExecutedWsMessage['output']
  ): void {
    const locatorId = executionIdToNodeLocatorId(useApp().rootGraph, id) ?? id
    nodeOutputs.value[locatorId] = { ...output }
  }

  function removeOutputFromLegacy(id: string): void {
    const locatorId = executionIdToNodeLocatorId(useApp().rootGraph, id) ?? id
    delete nodeOutputs.value[locatorId]
    delete instanceOutputs.value[locatorId]
  }

  /** Restores a {@link snapshotOutputs} record, keeping each instance's outputs apart. */
  function restoreOutputs({ shared, instances }: NodeOutputLayers) {
    nodeOutputs.value = clone(shared)
    instanceOutputs.value = clone(instances)
    pruneDetachedInstances()
    useApp().nodeOutputs = clone(shared)
  }

  /** Replaces every output with a job's outputs keyed by execution ID. */
  function restoreJobOutputs(
    outputs: Partial<Record<string, ExecutedWsMessage['output']>>
  ) {
    const layers: NodeOutputLayers = { shared: {}, instances: {} }
    for (const [id, output] of Object.entries(outputs)) {
      const executionId = tryNormalizeNodeExecutionId(id)
      const nodeLocatorId = executionId && resolveLocator(executionId)
      if (output && executionId && nodeLocatorId)
        writeExecutedOutput(layers, nodeLocatorId, executionId, output, {})
    }
    restoreOutputs(layers)
  }

  function refreshNodeOutputs(node: LGraphNode) {
    const locatorId = nodeToNodeLocatorId(node)
    if (!locatorId) return

    const outputs = nodeOutputs.value[locatorId]
    if (!outputs) return

    nodeOutputs.value[locatorId] = { ...outputs }
    const instances = instanceOutputs.value[locatorId]
    if (instances)
      instanceOutputs.value[locatorId] = mapValues(
        instances,
        (output) => output && { ...output }
      )
  }

  function resetAllOutputsAndPreviews() {
    nodeOutputs.value = {}
    instanceOutputs.value = {}
    useApp().nodeOutputs = {}
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
    getNodeOutputItems,
    getNodeImageUrls,
    getNodeImageUrlsByExecutionId,
    getNodeOutputByExecutionId,
    getNodePreviewImagesByExecutionId,
    getNodePreviews,
    getPreviewParam,

    setNodeOutputs,
    setOutputsByLocatorId,
    setNodeOutputImages,
    replaceNodeOutputImages,
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
    addLivePreviewsToStash,
    restorePreviewsForWorkflow,
    discardPreviewsForWorkflow,
    removeNodeOutputs,
    removeNodeOutputsForNode,
    snapshotOutputs,
    replaceOutputsFromLegacy,
    setOutputFromLegacy,
    removeOutputFromLegacy,
    restoreOutputs,
    restoreJobOutputs,
    resetAllOutputsAndPreviews,

    nodeOutputs,
    nodePreviewImages,
    latestPreview
  }
})
