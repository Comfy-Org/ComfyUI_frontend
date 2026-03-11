import type {
  ComfyNode,
  ComfyWorkflowJSON,
  NodeId
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { flattenWorkflowNodes } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { MissingModelCandidate, EmbeddedModelWithSource } from './types'
import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { getAssetFilename } from '@/platform/assets/utils/assetMetadataUtils'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getSelectedModelsMetadata } from '@/workbench/utils/modelMetadataUtil'

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

interface ComboInputInfo {
  inputName: string
  options: (string | number)[]
}

function getComboInputsFromNodeDef(
  nodeDef: ComfyNodeDefImpl
): ComboInputInfo[] {
  const result: ComboInputInfo[] = []
  for (const [inputName, inputSpec] of Object.entries(nodeDef.inputs)) {
    if (isComboInputSpec(inputSpec)) {
      result.push({ inputName, options: inputSpec.options ?? [] })
    }
  }
  return result
}

/**
 * Scan all COMBO widgets for model-like values.
 *
 * For non-asset-supported nodes, `isMissing` is resolved immediately.
 * For asset-supported nodes, `isMissing` is left `undefined` for later async verification.
 */
export function scanAllModelCandidates(
  graphData: ComfyWorkflowJSON,
  getNodeDef: (nodeType: string) => ComfyNodeDefImpl | undefined,
  isAssetSupported: (nodeType: string, widgetName: string) => boolean,
  getDirectory?: (nodeType: string) => string | undefined
): { candidates: MissingModelCandidate[]; allNodes: ComfyNode[] } {
  const allNodes = flattenWorkflowNodes(graphData)
  const candidates: MissingModelCandidate[] = []

  for (const node of allNodes) {
    const nodeDef = getNodeDef(node.type)
    if (!nodeDef) continue

    const comboInputs = getComboInputsFromNodeDef(nodeDef)
    if (!comboInputs.length || !node.widgets_values) continue

    if (Array.isArray(node.widgets_values)) {
      scanArrayWidgets(
        node,
        comboInputs,
        isAssetSupported,
        candidates,
        getDirectory
      )
    } else {
      scanObjectWidgets(
        node,
        comboInputs,
        isAssetSupported,
        candidates,
        getDirectory
      )
    }
  }

  return { candidates, allNodes }
}

function scanArrayWidgets(
  node: ComfyNode,
  comboInputs: ComboInputInfo[],
  isAssetSupported: (nodeType: string, widgetName: string) => boolean,
  candidates: MissingModelCandidate[],
  getDirectory?: (nodeType: string) => string | undefined
): void {
  const widgetValues = node.widgets_values as unknown[]
  const allOptions = new Set<string>()
  for (const { options } of comboInputs) {
    for (const opt of options) {
      if (typeof opt === 'string') allOptions.add(opt)
    }
  }
  const fallbackName = comboInputs[0]?.inputName ?? 'unknown'

  for (const val of widgetValues) {
    if (typeof val !== 'string' || !val.trim()) continue
    if (!isModelFileName(val)) continue

    const assetFlag = isAssetSupported(node.type, fallbackName)
    const inOptions = allOptions.has(val)

    candidates.push({
      nodeId: node.id,
      nodeType: node.type,
      widgetName: fallbackName,
      isAssetSupported: assetFlag,
      name: val,
      directory: getDirectory?.(node.type),
      isMissing: assetFlag ? undefined : !inOptions
    })
  }
}

function scanObjectWidgets(
  node: ComfyNode,
  comboInputs: ComboInputInfo[],
  isAssetSupported: (nodeType: string, widgetName: string) => boolean,
  candidates: MissingModelCandidate[],
  getDirectory?: (nodeType: string) => string | undefined
): void {
  const widgetValues = node.widgets_values as Record<string, unknown>
  for (const { inputName, options } of comboInputs) {
    const value = widgetValues[inputName]
    if (typeof value !== 'string' || !value.trim()) continue
    if (!isModelFileName(value)) continue

    const assetFlag = isAssetSupported(node.type, inputName)
    const inOptions = options.includes(value)

    candidates.push({
      nodeId: node.id,
      nodeType: node.type,
      widgetName: inputName,
      isAssetSupported: assetFlag,
      name: value,
      directory: getDirectory?.(node.type),
      isMissing: assetFlag ? undefined : !inOptions
    })
  }
}

/**
 * Enrich candidates with metadata embedded in the workflow JSON.
 * Fills `directory`, `url`, `hash`, `hashType` on existing entries.
 * Creates new entries for embedded models not found by the COMBO scan.
 */
export async function enrichWithEmbeddedMetadata(
  candidates: MissingModelCandidate[],
  allNodes: ComfyNode[],
  graphData: ComfyWorkflowJSON,
  checkModelInstalled: (name: string, directory: string) => Promise<boolean>,
  isAssetSupported?: (nodeType: string, widgetName: string) => boolean
): Promise<void> {
  const embeddedModels = collectEmbeddedModelsWithSource(allNodes, graphData)

  const candidatesByName = new Map<string, MissingModelCandidate[]>()
  for (const c of candidates) {
    const list = candidatesByName.get(c.name)
    if (list) list.push(c)
    else candidatesByName.set(c.name, [c])
  }

  const enrichedNames = new Set<string>()

  for (const model of embeddedModels) {
    if (enrichedNames.has(model.name)) continue
    enrichedNames.add(model.name)

    await enrichOrAddCandidate(
      model,
      candidatesByName.get(model.name),
      candidates,
      checkModelInstalled,
      isAssetSupported
    )
  }
}

async function enrichOrAddCandidate(
  model: EmbeddedModelWithSource,
  existing: MissingModelCandidate[] | undefined,
  candidates: MissingModelCandidate[],
  checkModelInstalled: (name: string, directory: string) => Promise<boolean>,
  isAssetSupported?: (nodeType: string, widgetName: string) => boolean
): Promise<void> {
  if (existing) {
    for (const c of existing) {
      c.directory ??= model.directory
      c.url ??= model.url
      c.hash ??= model.hash
      c.hashType ??= model.hash_type
    }
    return
  }

  // Model from embedded metadata not found by COMBO scan
  const installed = await checkModelInstalled(model.name, model.directory)
  if (installed) return

  const assetFlag = isAssetSupported
    ? isAssetSupported(model.sourceNodeType, model.sourceWidgetName)
    : false

  candidates.push({
    nodeId: model.sourceNodeId,
    nodeType: model.sourceNodeType,
    widgetName: model.sourceWidgetName,
    isAssetSupported: assetFlag,
    name: model.name,
    directory: model.directory,
    url: model.url,
    hash: model.hash,
    hashType: model.hash_type,
    isMissing: assetFlag ? undefined : true
  })
}

function collectEmbeddedModelsWithSource(
  allNodes: ComfyNode[],
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
        sourceNodeId: '' as NodeId,
        sourceNodeType: '',
        sourceWidgetName: ''
      })
    }
  }

  return result
}

function findWidgetNameForModel(node: ComfyNode, modelName: string): string {
  if (Array.isArray(node.widgets_values) || !node.widgets_values) return ''
  const wv = node.widgets_values as Record<string, unknown>
  for (const [key, val] of Object.entries(wv)) {
    if (val === modelName) return key
  }
  return ''
}

/**
 * Resolve `isMissing` for asset-supported candidates by checking the asset store.
 */
export async function verifyAssetSupportedCandidates(
  candidates: MissingModelCandidate[]
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
      assetsStore.updateModelsForNodeType(nodeType).catch(() => {})
      let attempts = 0
      while (
        (assetsStore.isModelLoading(nodeType) ||
          assetsStore.hasMore(nodeType)) &&
        attempts < 300
      ) {
        await new Promise((res) => setTimeout(res, 100))
        attempts++
      }
    })
  )

  for (const c of candidates) {
    if (!c.isAssetSupported || c.isMissing !== undefined) continue

    const assets = assetsStore.getAssets(c.nodeType) ?? []
    c.isMissing = !isAssetInstalled(c, assets)
  }
}

/** Hash match first, then fuzzy filename match. */
function isAssetInstalled(
  candidate: MissingModelCandidate,
  assets: AssetItem[]
): boolean {
  if (candidate.hash && candidate.hashType) {
    const candidateHash = `${candidate.hashType}:${candidate.hash}`
    if (assets.some((a) => a.asset_hash === candidateHash)) return true
  }

  const filenames = assets.map((a) => getAssetFilename(a))
  return filenames.some(
    (f) =>
      f === candidate.name ||
      f.endsWith('/' + candidate.name) ||
      candidate.name.endsWith('/' + f) ||
      f.endsWith('\\' + candidate.name) ||
      candidate.name.endsWith('\\' + f)
  )
}
