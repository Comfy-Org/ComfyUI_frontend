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
import { useToastStore } from '@/platform/updates/common/toastStore'
import { st } from '@/i18n'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
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
  for (const ext of MODEL_FILE_EXTENSIONS) {
    if (lower.endsWith(ext)) return true
  }
  return false
}

/**
 * Resolve the current options list from a combo widget.
 * Handles array, dictionary, and dynamic function forms.
 */
function resolveComboOptions(widget: IComboWidget): string[] {
  const values = widget.options.values
  if (!values) return []
  if (typeof values === 'function') return values(widget)
  if (Array.isArray(values)) return values
  return Object.keys(values)
}

/**
 * Scan all COMBO and asset widgets on configured graph nodes for model-like values.
 *
 * Must be called after `graph.configure()` so that widget name/value
 * mappings are accurate (avoids the array-index guessing of raw JSON).
 *
 * In Cloud environments, asset-supported combo widgets are created as
 * `type: 'asset'` during configure, so both widget types must be scanned.
 *
 * For non-asset-supported nodes, `isMissing` is resolved immediately
 * by checking the widget's dropdown options.
 * For asset-supported nodes (including asset widgets), `isMissing` is left
 * `undefined` for later async verification via the asset store.
 */
export function scanAllModelCandidates(
  rootGraph: LGraph,
  isAssetSupported: (nodeType: string, widgetName: string) => boolean,
  getDirectory?: (nodeType: string) => string | undefined
): MissingModelCandidate[] {
  const allNodes = collectAllNodes(rootGraph)
  const candidates: MissingModelCandidate[] = []

  for (const node of allNodes) {
    if (!node.widgets?.length) continue

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

/**
 * Enrich candidates with metadata embedded in the workflow JSON.
 * Fills `directory`, `url`, `hash`, `hashType` on existing entries.
 * Creates new entries for embedded models not found by the COMBO scan.
 */
export async function enrichWithEmbeddedMetadata(
  candidates: MissingModelCandidate[],
  graphData: ComfyWorkflowJSON,
  checkModelInstalled: (name: string, directory: string) => Promise<boolean>,
  isAssetSupported?: (nodeType: string, widgetName: string) => boolean
): Promise<void> {
  const allNodes = flattenWorkflowNodes(graphData)
  const embeddedModels = collectEmbeddedModelsWithSource(allNodes, graphData)

  const candidatesByName = new Map<string, MissingModelCandidate[]>()
  for (const c of candidates) {
    const list = candidatesByName.get(c.name)
    if (list) list.push(c)
    else candidatesByName.set(c.name, [c])
  }

  // Deduplicate embedded models by name + directory
  const deduped: EmbeddedModelWithSource[] = []
  const enrichedKeys = new Set<string>()
  for (const model of embeddedModels) {
    const dedupeKey = `${model.name}::${model.directory}`
    if (enrichedKeys.has(dedupeKey)) continue
    enrichedKeys.add(dedupeKey)
    deduped.push(model)
  }

  // Phase 1 (sync): enrich existing candidates with embedded metadata
  const unmatched: EmbeddedModelWithSource[] = []
  for (const model of deduped) {
    const existing = candidatesByName.get(model.name)
    if (existing) {
      for (const c of existing) {
        c.directory ??= model.directory
        c.url ??= model.url
        c.hash ??= model.hash
        c.hashType ??= model.hash_type
      }
    } else {
      unmatched.push(model)
    }
  }

  // Phase 2 (async, parallel): check installation for unmatched models
  const results = await Promise.all(
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

  for (const result of results) {
    if (result) candidates.push(result)
  }
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

const MAX_POLL_ATTEMPTS = 300
const POLL_INTERVAL_MS = 100

/**
 * Resolve `isMissing` for asset-supported candidates by checking the asset store.
 * Pass an `AbortSignal` to cancel the polling when the workflow changes.
 */
export async function verifyAssetSupportedCandidates(
  candidates: MissingModelCandidate[],
  signal?: AbortSignal
): Promise<void> {
  const pendingNodeTypes = new Set<string>()
  for (const c of candidates) {
    if (c.isAssetSupported && c.isMissing === undefined) {
      pendingNodeTypes.add(c.nodeType)
    }
  }

  if (pendingNodeTypes.size === 0) return

  const { useAssetsStore } = await import('@/stores/assetsStore')
  const assetsStore = useAssetsStore()

  // updateModelsForNodeType short-circuits when a pending request exists, so we
  // must poll isModelLoading + hasMore to wait for all progressive batches.
  await Promise.allSettled(
    [...pendingNodeTypes].map(async (nodeType) => {
      // Fire-and-forget: the poll below monitors completion
      assetsStore.updateModelsForNodeType(nodeType).catch((err) => {
        console.warn(
          `[Missing Model Pipeline] Failed to load assets for ${nodeType}:`,
          err
        )
      })

      let attempts = 0
      while (
        !signal?.aborted &&
        (assetsStore.isModelLoading(nodeType) ||
          assetsStore.hasMore(nodeType)) &&
        attempts < MAX_POLL_ATTEMPTS
      ) {
        await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS))
        attempts++
      }
      if (signal?.aborted) return
      if (attempts >= MAX_POLL_ATTEMPTS) {
        console.warn(
          `[Missing Model Pipeline] Timed out waiting for assets: ${nodeType}`
        )
        useToastStore().add({
          severity: 'warn',
          summary: st(
            'rightSidePanel.missingModels.assetLoadTimeout',
            'Model detection timed out'
          ),
          detail: nodeType,
          life: 5000
        })
      }
    })
  )

  if (signal?.aborted) return

  for (const c of candidates) {
    if (!c.isAssetSupported || c.isMissing !== undefined) continue

    const assets = assetsStore.getAssets(c.nodeType) ?? []
    c.isMissing = !isAssetInstalled(c, assets)
  }
}

/** Normalize path separators to forward slash for consistent matching. */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

/** Hash match first, then normalized filename match. */
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
    return (
      f === normalizedName ||
      f.endsWith('/' + normalizedName) ||
      normalizedName.endsWith('/' + f)
    )
  })
}

/** Groups missing model candidates by name, merging referencing nodes. */
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
