import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { FlattenableWorkflowGraph } from '@/platform/workflow/core/utils/workflowFlattening'
import { flattenWorkflowNodes } from '@/platform/workflow/core/utils/workflowFlattening'
import type { MissingModelCandidate, MissingModelViewModel } from './types'
import { getAssetFilename } from '@/platform/assets/utils/assetMetadataUtils'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
// eslint-disable-next-line import-x/no-restricted-paths
import { getSelectedModelsMetadata } from '@/workbench/utils/modelMetadataUtil'
import {
  inputForWidget,
  promotedInputWidgets
} from '@/core/graph/subgraph/promotedInputWidget'
import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  IAssetWidget,
  IBaseWidget,
  IComboWidget
} from '@/lib/litegraph/src/types/widgets'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import {
  collectAllNodes,
  getExecutionIdByNode,
  isExecutionPathActive
} from '@/utils/graphTraversalUtil'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { resolveComboValues } from '@/utils/litegraphUtil'
import { getParentExecutionIds } from '@/types/nodeIdentification'

export type MissingModelWorkflowData = FlattenableWorkflowGraph & {
  models?: ModelFile[]
}

function isComboWidget(widget: IBaseWidget): widget is IComboWidget {
  return widget.type === 'combo'
}

/**
 * Fills url/hash/directory onto a candidate from the node's embedded
 * `properties.models` metadata when the names match. The full pipeline
 * does this via enrichWithEmbeddedMetadata + graphData.models, but the
 * realtime single-node scan (paste, un-bypass) otherwise loses these
 * fields — making the Missing Model row's download/copy-url buttons
 * disappear after a bypass/un-bypass cycle.
 */
function enrichCandidateFromNodeProperties(
  candidate: MissingModelCandidate,
  embeddedModels: readonly ModelFile[] | undefined
): MissingModelCandidate {
  if (!embeddedModels?.length) return candidate
  // Require directory agreement when the candidate already has one —
  // a single node can reference two models with the same name under
  // different directories (e.g. a LoRA present in multiple folders);
  // name-only matching would stamp the wrong url/hash onto the
  // candidate. Mirrors the directory check in enrichWithEmbeddedMetadata.
  const match = embeddedModels.find(
    (m) =>
      m.name === candidate.name &&
      (!candidate.directory || candidate.directory === m.directory)
  )
  if (!match) return candidate
  return {
    ...candidate,
    directory: candidate.directory ?? match.directory,
    url: candidate.url ?? match.url,
    hash: candidate.hash ?? match.hash,
    hashType: candidate.hashType ?? match.hash_type
  }
}

function isAssetWidget(widget: IBaseWidget): widget is IAssetWidget {
  return widget.type === 'asset'
}

function isInactiveMode(mode: number | undefined): boolean {
  return mode === LGraphEventMode.NEVER || mode === LGraphEventMode.BYPASS
}

interface ModelWidgetScanTarget {
  executionId: NodeExecutionId
  nodeType: string
  candidateWidgetName: string
  definitionWidgetName: string
  sourceExecutionId?: NodeExecutionId
  valueWidget: IBaseWidget
  definitionWidget: IBaseWidget
  embeddedModels?: ModelFile[]
}

type NodeWithEmbeddedModels = {
  properties?: {
    models?: ModelFile[]
  }
}

// Full set of model file extensions used for scanning candidate widgets.
// Intentionally broader than ALLOWED_SUFFIXES in missingModelDownload.ts,
// which restricts which files are eligible for download.
export const MODEL_FILE_EXTENSIONS = new Set([
  '.safetensors',
  '.ckpt',
  '.pt',
  '.pth',
  '.bin',
  '.sft',
  '.onnx',
  '.gguf'
])

export function isModelFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return Array.from(MODEL_FILE_EXTENSIONS).some((ext) => lower.endsWith(ext))
}

/**
 * Scan COMBO and asset widgets on configured graph nodes for model-like values.
 * Must be called after `graph.configure()` so widget name/value mappings are accurate.
 *
 * Non-asset-supported nodes: `isMissing` resolved immediately via widget options.
 * Asset-supported nodes: `isMissing` left `undefined` for async verification.
 */
export function scanAllModelCandidates(
  rootGraph: LGraph,
  isAssetSupported: (nodeType: string, widgetName: string) => boolean,
  getDirectory?: (nodeType: string) => string | undefined
): MissingModelCandidate[] {
  if (!rootGraph) return []

  const allNodes = collectAllNodes(rootGraph)
  const candidates: MissingModelCandidate[] = []

  for (const node of allNodes) {
    if (isInactiveMode(node.mode)) continue

    candidates.push(
      ...scanNodeModelCandidates(
        rootGraph,
        node,
        isAssetSupported,
        getDirectory
      )
    )
  }

  return candidates
}

/** Scan a single node's widgets for missing model candidates (OSS immediate resolution). */
export function scanNodeModelCandidates(
  rootGraph: LGraph,
  node: LGraphNode,
  isAssetSupported: (nodeType: string, widgetName: string) => boolean,
  getDirectory?: (nodeType: string) => string | undefined
): MissingModelCandidate[] {
  const widgets = node.isSubgraphNode?.()
    ? promotedInputWidgets(node)
    : (node.widgets ?? [])
  if (!widgets.length) return []

  const executionId = getExecutionIdByNode(rootGraph, node)
  if (!executionId) return []

  const candidates: MissingModelCandidate[] = []

  for (const widget of widgets) {
    const target = getModelWidgetScanTarget(
      rootGraph,
      node,
      widget,
      executionId
    )
    if (!target) continue

    let candidate: MissingModelCandidate | null = null

    if (isAssetScanTarget(target)) {
      candidate = scanAssetWidget(target, getDirectory)
    } else if (isComboScanTarget(target)) {
      candidate = scanComboWidget(target, isAssetSupported, getDirectory)
    }

    if (candidate) {
      candidates.push(
        enrichCandidateFromNodeProperties(candidate, target.embeddedModels)
      )
    }
  }

  return candidates
}

function getModelWidgetScanTarget(
  rootGraph: LGraph,
  node: LGraphNode,
  widget: IBaseWidget,
  executionId: NodeExecutionId
): ModelWidgetScanTarget | null {
  const input = getInputForWidget(node, widget)
  if (input?.link != null) return null

  if (!node.isSubgraphNode?.()) {
    return {
      executionId,
      nodeType: node.type,
      candidateWidgetName: widget.name,
      definitionWidgetName: widget.name,
      valueWidget: widget,
      definitionWidget: widget,
      embeddedModels: getEmbeddedModels(node)
    }
  }

  if (!input) return null

  const source = resolvePromotedWidgetSource(rootGraph, node, widget)
  const sourceExecutionId = source?.sourceExecutionId
  if (!sourceExecutionId) return null
  if (!isExecutionPathActive(rootGraph, sourceExecutionId)) return null

  return {
    executionId,
    nodeType: source.sourceNode.type,
    candidateWidgetName: widget.name,
    definitionWidgetName: source.sourceWidgetName,
    sourceExecutionId,
    valueWidget: widget,
    definitionWidget: source.sourceWidget,
    embeddedModels: getEmbeddedModels(source.sourceNode)
  }
}

function getInputForWidget(node: LGraphNode, widget: IBaseWidget) {
  if (typeof node.getSlotFromWidget !== 'function') return undefined
  return inputForWidget(node, widget)
}

function getEmbeddedModels(node: LGraphNode): ModelFile[] | undefined {
  return (node as NodeWithEmbeddedModels).properties?.models
}

function isAssetScanTarget(
  target: ModelWidgetScanTarget
): target is ModelWidgetScanTarget & { definitionWidget: IAssetWidget } {
  return isAssetWidget(target.definitionWidget)
}

function isComboScanTarget(
  target: ModelWidgetScanTarget
): target is ModelWidgetScanTarget & { definitionWidget: IComboWidget } {
  return isComboWidget(target.definitionWidget)
}

function scanAssetWidget(
  target: ModelWidgetScanTarget & { definitionWidget: IAssetWidget },
  getDirectory: ((nodeType: string) => string | undefined) | undefined
): MissingModelCandidate | null {
  const value = target.valueWidget.value
  if (typeof value !== 'string' || !value.trim()) return null
  if (!isModelFileName(value)) return null

  return {
    nodeId: target.executionId,
    ...(target.sourceExecutionId && {
      sourceExecutionId: target.sourceExecutionId
    }),
    nodeType: target.nodeType,
    widgetName: target.candidateWidgetName,
    isAssetSupported: true,
    name: value,
    directory: getDirectory?.(target.nodeType),
    isMissing: undefined
  }
}

function scanComboWidget(
  target: ModelWidgetScanTarget & { definitionWidget: IComboWidget },
  isAssetSupported: (nodeType: string, widgetName: string) => boolean,
  getDirectory: ((nodeType: string) => string | undefined) | undefined
): MissingModelCandidate | null {
  const value = target.valueWidget.value
  if (typeof value !== 'string' || !value.trim()) return null
  if (!isModelFileName(value)) return null

  const nodeIsAssetSupported = isAssetSupported(
    target.nodeType,
    target.definitionWidgetName
  )
  const options = resolveComboValues(target.definitionWidget)
  const inOptions = options.includes(value)

  return {
    nodeId: target.executionId,
    ...(target.sourceExecutionId && {
      sourceExecutionId: target.sourceExecutionId
    }),
    nodeType: target.nodeType,
    widgetName: target.candidateWidgetName,
    isAssetSupported: nodeIsAssetSupported,
    name: value,
    directory: getDirectory?.(target.nodeType),
    isMissing: nodeIsAssetSupported ? undefined : !inOptions
  }
}

export function enrichWithEmbeddedMetadata(
  candidates: readonly MissingModelCandidate[],
  graphData: MissingModelWorkflowData
): MissingModelCandidate[] {
  const allNodes = flattenWorkflowNodes(graphData)
  const embeddedModels = collectEmbeddedModels(allNodes, graphData)

  const enriched = candidates.map((c) => ({ ...c }))
  const candidatesByKey = new Map<string, MissingModelCandidate[]>()
  for (const c of enriched) {
    const dirKey = `${c.name}::${c.directory ?? ''}`
    const dirList = candidatesByKey.get(dirKey)
    if (dirList) dirList.push(c)
    else candidatesByKey.set(dirKey, [c])

    const nameKey = c.name
    const nameList = candidatesByKey.get(nameKey)
    if (nameList) nameList.push(c)
    else candidatesByKey.set(nameKey, [c])
  }

  const deduped: ModelFile[] = []
  const enrichedKeys = new Set<string>()
  for (const model of embeddedModels) {
    const dedupeKey = `${model.name}::${model.directory}`
    if (enrichedKeys.has(dedupeKey)) continue
    enrichedKeys.add(dedupeKey)
    deduped.push(model)
  }

  for (const model of deduped) {
    const dirKey = `${model.name}::${model.directory}`
    const exact = candidatesByKey.get(dirKey)
    const fallback = candidatesByKey.get(model.name)
    const existing = exact?.length ? exact : fallback
    if (!existing) continue
    for (const c of existing) {
      if (c.directory && c.directory !== model.directory) continue
      c.directory ??= model.directory
      c.url ??= model.url
      c.hash ??= model.hash
      c.hashType ??= model.hash_type
    }
  }

  return enriched
}

function collectEmbeddedModels(
  allNodes: ReturnType<typeof flattenWorkflowNodes>,
  graphData: MissingModelWorkflowData
): ModelFile[] {
  const result: ModelFile[] = []
  const nodesById = new Map(allNodes.map((node) => [String(node.id), node]))

  for (const node of allNodes) {
    if (!isNodeAndAncestorsActive(node, nodesById)) continue

    const selected = getSelectedModelsMetadata(node)
    if (!selected?.length) continue

    result.push(...selected)
  }

  if (graphData.models?.length) result.push(...graphData.models)

  return result
}

function isNodeAndAncestorsActive(
  node: ReturnType<typeof flattenWorkflowNodes>[number],
  nodesById: ReadonlyMap<
    string,
    ReturnType<typeof flattenWorkflowNodes>[number]
  >
): boolean {
  if (isInactiveMode(node.mode)) return false

  for (const ancestorId of getParentExecutionIds(String(node.id))) {
    const ancestor = nodesById.get(ancestorId)
    if (isInactiveMode(ancestor?.mode)) return false
  }

  return true
}

interface AssetVerifier {
  updateModelsForNodeType: (nodeType: string) => Promise<void>
  getAssets: (nodeType: string) => AssetItem[] | undefined
}

export async function verifyAssetSupportedCandidates(
  candidates: MissingModelCandidate[],
  signal?: AbortSignal,
  assetsStore?: AssetVerifier
): Promise<void> {
  if (signal?.aborted) return

  const pendingCandidates = candidates.filter(
    (c) => c.isAssetSupported && c.isMissing === undefined
  )
  if (pendingCandidates.length === 0) return

  const pendingNodeTypes = new Set(
    pendingCandidates.map((candidate) => candidate.nodeType)
  )

  const store =
    assetsStore ?? (await import('@/stores/assetsStore')).useAssetsStore()

  const failedNodeTypes = new Set<string>()
  await Promise.allSettled(
    [...pendingNodeTypes].map(async (nodeType) => {
      if (signal?.aborted) return
      try {
        await store.updateModelsForNodeType(nodeType)
      } catch (err) {
        failedNodeTypes.add(nodeType)
        console.warn(
          `[Missing Model Pipeline] Failed to load assets for ${nodeType}:`,
          err
        )
      }
    })
  )

  if (signal?.aborted) return

  for (const c of candidates) {
    if (!c.isAssetSupported || c.isMissing !== undefined) continue
    if (failedNodeTypes.has(c.nodeType)) continue

    const assets = store.getAssets(c.nodeType) ?? []
    c.isMissing = !isAssetInstalled(c, assets)
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function isAssetInstalled(
  candidate: MissingModelCandidate,
  assets: AssetItem[]
): boolean {
  if (candidate.hash && candidate.hashType) {
    const candidateHash = `${candidate.hashType}:${candidate.hash}`
    if (assets.some((a) => a.hash === candidateHash)) return true
  }

  const normalizedName = normalizePath(candidate.name)
  return assets.some((a) => {
    const f = normalizePath(getAssetFilename(a))
    return f === normalizedName || f.endsWith('/' + normalizedName)
  })
}

export function groupCandidatesByName(
  candidates: MissingModelCandidate[]
): MissingModelViewModel[] {
  const map = new Map<string, MissingModelViewModel>()
  for (const c of candidates) {
    const existing = map.get(c.name)
    if (existing) {
      if (c.nodeId) {
        existing.referencingNodes.push({
          nodeId: c.nodeId,
          widgetName: c.widgetName
        })
      }
    } else {
      map.set(c.name, {
        name: c.name,
        representative: c,
        referencingNodes: c.nodeId
          ? [{ nodeId: c.nodeId, widgetName: c.widgetName }]
          : []
      })
    }
  }
  return Array.from(map.values())
}
