import type {
  ComfyWorkflowJSON,
  NodeId
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { flattenWorkflowNodes } from '@/platform/workflow/validation/schemas/workflowSchema'
import type {
  MissingModelCandidate,
  MissingModelViewModel,
  EmbeddedModelWithSource
} from './types'
import { getAssetFilename } from '@/platform/assets/utils/assetMetadataUtils'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
// eslint-disable-next-line import-x/no-restricted-paths
import { getSelectedModelsMetadata } from '@/workbench/utils/modelMetadataUtil'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type {
  IAssetWidget,
  IBaseWidget,
  IComboWidget
} from '@/lib/litegraph/src/types/widgets'
import {
  collectAllNodes,
  getExecutionIdByNode
} from '@/utils/graphTraversalUtil'

function isComboWidget(widget: IBaseWidget): widget is IComboWidget {
  return widget.type === 'combo'
}

function isAssetWidget(widget: IBaseWidget): widget is IAssetWidget {
  return widget.type === 'asset'
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

function resolveComboOptions(widget: IComboWidget): string[] {
  const values = widget.options.values
  if (!values) return []
  if (typeof values === 'function') return values(widget)
  if (Array.isArray(values)) return values
  return Object.keys(values)
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
    if (!node.widgets?.length) continue
    // Skip subgraph container nodes: their promoted widgets are synthetic
    // views of interior widgets, which are already scanned via recursion.
    if (node.isSubgraphNode?.()) continue

    const executionId = getExecutionIdByNode(rootGraph, node)
    if (!executionId) continue

    for (const widget of node.widgets) {
      let candidate: MissingModelCandidate | null = null

      if (isAssetWidget(widget)) {
        candidate = scanAssetWidget(node, widget, executionId, getDirectory)
      } else if (isComboWidget(widget)) {
        candidate = scanComboWidget(
          node,
          widget,
          executionId,
          isAssetSupported,
          getDirectory
        )
      }

      if (candidate) candidates.push(candidate)
    }
  }

  return candidates
}

function scanAssetWidget(
  node: { type: string },
  widget: IAssetWidget,
  executionId: string,
  getDirectory: ((nodeType: string) => string | undefined) | undefined
): MissingModelCandidate | null {
  const value = widget.value
  if (!value.trim()) return null
  if (!isModelFileName(value)) return null

  return {
    nodeId: executionId as NodeId,
    nodeType: node.type,
    widgetName: widget.name,
    isAssetSupported: true,
    name: value,
    directory: getDirectory?.(node.type),
    isMissing: undefined
  }
}

function scanComboWidget(
  node: { type: string },
  widget: IComboWidget,
  executionId: string,
  isAssetSupported: (nodeType: string, widgetName: string) => boolean,
  getDirectory: ((nodeType: string) => string | undefined) | undefined
): MissingModelCandidate | null {
  const value = widget.value
  if (typeof value !== 'string' || !value.trim()) return null
  if (!isModelFileName(value)) return null

  const nodeIsAssetSupported = isAssetSupported(node.type, widget.name)
  const options = resolveComboOptions(widget)
  const inOptions = options.includes(value)

  return {
    nodeId: executionId as NodeId,
    nodeType: node.type,
    widgetName: widget.name,
    isAssetSupported: nodeIsAssetSupported,
    name: value,
    directory: getDirectory?.(node.type),
    isMissing: nodeIsAssetSupported ? undefined : !inOptions
  }
}

export async function enrichWithEmbeddedMetadata(
  candidates: readonly MissingModelCandidate[],
  graphData: ComfyWorkflowJSON,
  checkModelInstalled: (name: string, directory: string) => Promise<boolean>,
  isAssetSupported?: (nodeType: string, widgetName: string) => boolean
): Promise<MissingModelCandidate[]> {
  const allNodes = flattenWorkflowNodes(graphData)
  const embeddedModels = collectEmbeddedModelsWithSource(allNodes, graphData)

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

  const deduped: EmbeddedModelWithSource[] = []
  const enrichedKeys = new Set<string>()
  for (const model of embeddedModels) {
    const dedupeKey = `${model.name}::${model.directory}`
    if (enrichedKeys.has(dedupeKey)) continue
    enrichedKeys.add(dedupeKey)
    deduped.push(model)
  }

  const unmatched: EmbeddedModelWithSource[] = []
  for (const model of deduped) {
    const dirKey = `${model.name}::${model.directory}`
    const exact = candidatesByKey.get(dirKey)
    const fallback = candidatesByKey.get(model.name)
    const existing = exact?.length ? exact : fallback
    if (existing) {
      for (const c of existing) {
        if (c.directory && c.directory !== model.directory) continue
        c.directory ??= model.directory
        c.url ??= model.url
        c.hash ??= model.hash
        c.hashType ??= model.hash_type
      }
    } else {
      unmatched.push(model)
    }
  }

  const settled = await Promise.allSettled(
    unmatched.map(async (model) => {
      const installed = await checkModelInstalled(model.name, model.directory)
      if (installed) return null

      const nodeIsAssetSupported = isAssetSupported
        ? isAssetSupported(model.sourceNodeType, model.sourceWidgetName)
        : false

      return {
        nodeId: model.sourceNodeId,
        nodeType: model.sourceNodeType,
        widgetName: model.sourceWidgetName,
        isAssetSupported: nodeIsAssetSupported,
        name: model.name,
        directory: model.directory,
        url: model.url,
        hash: model.hash,
        hashType: model.hash_type,
        isMissing: nodeIsAssetSupported ? undefined : true
      } satisfies MissingModelCandidate
    })
  )

  for (const r of settled) {
    if (r.status === 'rejected') {
      console.warn(
        '[Missing Model Pipeline] checkModelInstalled failed:',
        r.reason
      )
      continue
    }
    if (r.value) enriched.push(r.value)
  }

  return enriched
}

function collectEmbeddedModelsWithSource(
  allNodes: ReturnType<typeof flattenWorkflowNodes>,
  graphData: ComfyWorkflowJSON
): EmbeddedModelWithSource[] {
  const result: EmbeddedModelWithSource[] = []

  for (const node of allNodes) {
    const selected = getSelectedModelsMetadata(
      node as Parameters<typeof getSelectedModelsMetadata>[0]
    )
    if (!selected?.length) continue

    for (const model of selected) {
      result.push({
        ...model,
        sourceNodeId: node.id,
        sourceNodeType: node.type,
        sourceWidgetName: findWidgetNameForModel(node, model.name)
      })
    }
  }

  // Workflow-level model entries have no originating node; sourceNodeId
  // remains undefined and empty-string node type/widget are handled by
  // groupCandidatesByName (no nodeId → no referencing node entry).
  if (graphData.models?.length) {
    for (const model of graphData.models) {
      result.push({
        ...model,
        sourceNodeType: '',
        sourceWidgetName: ''
      })
    }
  }

  return result
}

function findWidgetNameForModel(
  node: ReturnType<typeof flattenWorkflowNodes>[number],
  modelName: string
): string {
  if (Array.isArray(node.widgets_values) || !node.widgets_values) return ''
  const wv = node.widgets_values as Record<string, unknown>
  for (const [key, val] of Object.entries(wv)) {
    if (val === modelName) return key
  }
  return ''
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

  const pendingNodeTypes = new Set<string>()
  for (const c of candidates) {
    if (c.isAssetSupported && c.isMissing === undefined) {
      pendingNodeTypes.add(c.nodeType)
    }
  }

  if (pendingNodeTypes.size === 0) return

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
    if (assets.some((a) => a.asset_hash === candidateHash)) return true
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
