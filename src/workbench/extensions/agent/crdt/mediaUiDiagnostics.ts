import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isDOMWidget } from '@/scripts/domWidget'
import type { NodeExecutionOutput } from '@/platform/remote/comfyui/execution/types'

export interface MediaUiDiagnostic {
  nodeId: string
  nodeType: string
  mediaKinds: readonly ('image' | 'audio')[]
  selectedImagePresent: boolean
  selectedAudioPresent: boolean
  outputImageCount: number
  outputAudioCount: number
  resolvedImageUrlCount: number
  legacyImageCount: number
  loadedLegacyImageCount: number
  vueNodeCount: number
  vueImageCount: number
  vueAudioCount: number
  audioUiRegistered: boolean
  audioElementConnected: boolean
  audioSourcePresent: boolean
  audioHiddenAsEmpty: boolean
  hideOutputImages: boolean
}

export interface MediaUiDiagnosticSource {
  nodes: readonly LGraphNode[]
  getNodeOutputs: (node: LGraphNode) => NodeExecutionOutput | undefined
  getNodeImageUrls: (node: LGraphNode) => readonly string[] | undefined
  root: ParentNode
}

function selectedMediaPresent(node: LGraphNode, widgetName: string): boolean {
  const value = node.widgets?.find(
    (widget) => widget.name === widgetName
  )?.value
  return (
    value !== undefined && value !== null && value !== '' && value !== 'none'
  )
}

function nodeRootsById(
  root: ParentNode
): ReadonlyMap<string, readonly HTMLElement[]> {
  const roots = new Map<string, HTMLElement[]>()
  for (const element of root.querySelectorAll<HTMLElement>('[data-node-id]')) {
    const nodeId = element.dataset.nodeId
    if (nodeId === undefined) continue
    const matchingRoots = roots.get(nodeId)
    if (matchingRoots) matchingRoots.push(element)
    else roots.set(nodeId, [element])
  }
  return roots
}

function mediaKinds(evidence: {
  previewMediaType: LGraphNode['previewMediaType']
  imageUrlCount: number
  legacyImageCount: number
  outputImageCount: number
  outputAudioCount: number
  selectedImagePresent: boolean
  selectedAudioPresent: boolean
  audioUiRegistered: boolean
  vueImageCount: number
  vueAudioCount: number
}): ('image' | 'audio')[] {
  const kinds: ('image' | 'audio')[] = []
  const hasImage = [
    evidence.previewMediaType === 'image',
    evidence.selectedImagePresent,
    evidence.outputImageCount > 0,
    evidence.imageUrlCount > 0,
    evidence.legacyImageCount > 0,
    evidence.vueImageCount > 0
  ].some(Boolean)
  const hasAudio = [
    evidence.previewMediaType === 'audio',
    evidence.selectedAudioPresent,
    evidence.outputAudioCount > 0,
    evidence.audioUiRegistered,
    evidence.vueAudioCount > 0
  ].some(Boolean)
  if (hasImage) kinds.push('image')
  if (hasAudio) kinds.push('audio')
  return kinds
}

function descendantCount(
  roots: readonly HTMLElement[],
  selector: string
): number {
  return roots.reduce(
    (count, element) => count + element.querySelectorAll(selector).length,
    0
  )
}

function outputCounts(output: NodeExecutionOutput | undefined): {
  image: number
  audio: number
} {
  return {
    image: output?.images?.length ?? 0,
    audio: output?.audio?.length ?? 0
  }
}

function audioUiWidget(node: LGraphNode) {
  return node.widgets?.find((widget) => widget.name === 'audioUI')
}

function audioElementFor(
  widget: ReturnType<typeof audioUiWidget>
): HTMLAudioElement | null {
  if (!widget) return null
  return isDOMWidget<HTMLAudioElement, string>(widget) ? widget.element : null
}

function audioElementState(element: HTMLAudioElement | null): {
  connected: boolean
  sourcePresent: boolean
  hiddenAsEmpty: boolean
} {
  if (!element) {
    return { connected: false, sourcePresent: false, hiddenAsEmpty: false }
  }
  return {
    connected: element.isConnected,
    sourcePresent: Boolean(element.currentSrc || element.getAttribute('src')),
    hiddenAsEmpty: element.classList.contains('empty-audio-widget')
  }
}

function diagnosticForNode(
  node: LGraphNode,
  source: Omit<MediaUiDiagnosticSource, 'nodes' | 'root'> & {
    nodeRootsById: ReadonlyMap<string, readonly HTMLElement[]>
  }
): MediaUiDiagnostic | null {
  const output = source.getNodeOutputs(node)
  const imageUrls = source.getNodeImageUrls(node) ?? []
  const legacyImages = node.imgs ?? []
  const audioUi = audioUiWidget(node)
  const audioState = audioElementState(audioElementFor(audioUi))
  const counts = outputCounts(output)
  const selectedImagePresent = selectedMediaPresent(node, 'image')
  const selectedAudioPresent = selectedMediaPresent(node, 'audio')
  const roots = source.nodeRootsById.get(String(node.id)) ?? []
  const vueImageCount = descendantCount(roots, 'img')
  const vueAudioCount = descendantCount(roots, 'audio')
  const kinds = mediaKinds({
    previewMediaType: node.previewMediaType,
    imageUrlCount: imageUrls.length,
    legacyImageCount: legacyImages.length,
    outputImageCount: counts.image,
    outputAudioCount: counts.audio,
    selectedImagePresent,
    selectedAudioPresent,
    audioUiRegistered: audioUi !== undefined,
    vueImageCount,
    vueAudioCount
  })
  if (!kinds.length) return null

  return {
    nodeId: String(node.id),
    nodeType: node.comfyClass ?? node.type,
    mediaKinds: kinds,
    selectedImagePresent,
    selectedAudioPresent,
    outputImageCount: counts.image,
    outputAudioCount: counts.audio,
    resolvedImageUrlCount: imageUrls.length,
    legacyImageCount: legacyImages.length,
    loadedLegacyImageCount: legacyImages.filter(
      (image) => image.complete && image.naturalWidth > 0
    ).length,
    vueNodeCount: roots.length,
    vueImageCount,
    vueAudioCount,
    audioUiRegistered: audioUi !== undefined,
    audioElementConnected: audioState.connected,
    audioSourcePresent: audioState.sourcePresent,
    audioHiddenAsEmpty: audioState.hiddenAsEmpty,
    hideOutputImages: node.hideOutputImages ?? false
  }
}

function isDiagnostic(
  diagnostic: MediaUiDiagnostic | null
): diagnostic is MediaUiDiagnostic {
  return diagnostic !== null
}

export function collectMediaUiDiagnostics({
  nodes,
  getNodeOutputs,
  getNodeImageUrls,
  root
}: MediaUiDiagnosticSource): MediaUiDiagnostic[] {
  const source = {
    getNodeOutputs,
    getNodeImageUrls,
    nodeRootsById: nodeRootsById(root)
  }
  return nodes
    .map((node) => diagnosticForNode(node, source))
    .filter(isDiagnostic)
}
