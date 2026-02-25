/**
 * Detects workflow requirements for template publishing: checkpoint models,
 * LoRA models, custom nodes, and estimated VRAM usage.
 *
 * Traverses the current workflow graph and cross-references each node's
 * type against the node definition store to classify dependencies.
 */
import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { ModelRequirement } from '@/types/templateMarketplace'
import { NodeSourceType } from '@/types/nodeSource'
import { mapAllNodes } from '@/utils/graphTraversalUtil'

/** Aggregated requirements detected from a workflow graph. */
export interface WorkflowRequirements {
  checkpoints: ModelRequirement[]
  loras: ModelRequirement[]
  customNodes: string[]
  customNodePackages: string[]
  estimatedVram: number
}

/** Node type patterns that load checkpoint models. */
const CHECKPOINT_LOADER_TYPES = new Set([
  'CheckpointLoaderSimple',
  'CheckpointLoader',
  'ImageOnlyCheckpointLoader',
  'unCLIPCheckpointLoader'
])

/** Node type patterns that load LoRA models. */
const LORA_LOADER_TYPES = new Set(['LoraLoader', 'LoraLoaderModelOnly'])

/** Approximate VRAM usage per model type, in bytes. */
const VRAM_ESTIMATES: Record<string, number> = {
  checkpoint: 4 * 1024 * 1024 * 1024, // 4 GB
  lora: 200 * 1024 * 1024 // 200 MB
}

/** Base VRAM overhead for running ComfyUI itself. */
const BASE_VRAM_OVERHEAD = 512 * 1024 * 1024 // 512 MB

/**
 * Extracts the model name from a node's widgets array.
 *
 * Widget values are stored in order matching the node definition's input
 * spec. The model name widget is typically the first one for loader nodes.
 *
 * @param node - The graph node to extract the model name from.
 * @param widgetIndex - The index of the widget holding the model name.
 * @returns The model name string, or `undefined` if not found.
 */
function getWidgetValue(node: LGraphNode, widgetIndex = 0): string | undefined {
  const widget = node.widgets?.[widgetIndex]
  if (!widget) return undefined
  const value = widget.value
  return typeof value === 'string' ? value : undefined
}

/**
 * Detects checkpoint model requirements from the workflow graph.
 *
 * Identifies nodes whose type matches known checkpoint loader patterns
 * and extracts the selected model name from each node's widgets.
 *
 * @param graph - The root workflow graph to traverse.
 * @returns Deduplicated array of checkpoint model requirements.
 */
export function detectCheckpointModels(
  graph: LGraph | Subgraph | null
): ModelRequirement[] {
  if (!graph) return []

  const seen = new Set<string>()
  const results: ModelRequirement[] = []

  mapAllNodes(graph, (node) => {
    if (!CHECKPOINT_LOADER_TYPES.has(node.type)) return undefined
    const modelName = getWidgetValue(node)
    if (!modelName || seen.has(modelName)) return undefined
    seen.add(modelName)
    results.push({
      name: modelName,
      type: 'checkpoint',
      size: 0
    })
    return undefined
  })

  return results
}

/**
 * Detects LoRA model requirements from the workflow graph.
 *
 * Identifies nodes whose type matches known LoRA loader patterns
 * and extracts the selected model name from each node's widgets.
 *
 * @param graph - The root workflow graph to traverse.
 * @returns Deduplicated array of LoRA model requirements.
 */
export function detectLoraModels(
  graph: LGraph | Subgraph | null
): ModelRequirement[] {
  if (!graph) return []

  const seen = new Set<string>()
  const results: ModelRequirement[] = []

  mapAllNodes(graph, (node) => {
    if (!LORA_LOADER_TYPES.has(node.type)) return undefined
    const modelName = getWidgetValue(node)
    if (!modelName || seen.has(modelName)) return undefined
    seen.add(modelName)
    results.push({
      name: modelName,
      type: 'lora',
      size: 0
    })
    return undefined
  })

  return results
}

/**
 * Detects custom node type names from the workflow graph.
 *
 * Filters to nodes whose definition source type is
 * {@link NodeSourceType.CustomNodes}.
 *
 * @param graph - The root workflow graph to traverse.
 * @param nodeDefsByName - Map of node type names to their definitions.
 * @returns Sorted, deduplicated array of custom node type names.
 */
export function detectCustomNodes(
  graph: LGraph | Subgraph | null,
  nodeDefsByName: Record<string, ComfyNodeDefImpl>
): string[] {
  if (!graph) return []

  const nodeTypes = mapAllNodes(graph, (node) => node.type)
  const unique = new Set(nodeTypes)

  return [...unique]
    .filter((type) => {
      const def = nodeDefsByName[type]
      return def?.nodeSource.type === NodeSourceType.CustomNodes
    })
    .sort()
}

/**
 * Extracts the custom node package ID from a `python_module` string.
 *
 * Custom node modules follow the pattern
 * `custom_nodes.PackageName@version.submodule`, so the package ID is the
 * second dot-segment with the `@version` suffix stripped.
 *
 * @returns The package folder name, or `undefined` when the module does not
 *          match the expected pattern.
 */
function extractPackageId(pythonModule: string): string | undefined {
  const segments = pythonModule.split('.')
  if (segments[0] !== 'custom_nodes' || !segments[1]) return undefined
  return segments[1].split('@')[0]
}

/**
 * Detects custom node package IDs from the workflow graph.
 *
 * @param graph - The root workflow graph to traverse.
 * @param nodeDefsByName - Map of node type names to their definitions.
 * @returns Sorted, deduplicated array of package IDs.
 */
export function detectCustomNodePackages(
  graph: LGraph | Subgraph | null,
  nodeDefsByName: Record<string, ComfyNodeDefImpl>
): string[] {
  if (!graph) return []

  const nodeTypes = mapAllNodes(graph, (node) => node.type)
  const packages = new Set<string>()

  for (const type of nodeTypes) {
    const def = nodeDefsByName[type]
    if (!def || def.nodeSource.type !== NodeSourceType.CustomNodes) continue
    const pkgId = extractPackageId(def.python_module)
    if (pkgId) packages.add(pkgId)
  }

  return [...packages].sort()
}

/**
 * Estimates the minimum VRAM in bytes required to run a workflow based on
 * the detected model requirements.
 *
 * Uses fixed heuristic sizes per model type plus a base overhead for the
 * ComfyUI runtime itself.
 *
 * @param models - Array of model requirements detected from the workflow.
 * @returns Estimated VRAM usage in bytes.
 */
export function estimateVramRequirement(models: ModelRequirement[]): number {
  if (models.length === 0) return 0

  let total = BASE_VRAM_OVERHEAD

  for (const model of models) {
    total += VRAM_ESTIMATES[model.type] ?? 0
  }

  return total
}

/**
 * Detects all workflow requirements in a single pass.
 *
 * @param graph - The root workflow graph.
 * @param nodeDefsByName - Map of node type names to their definitions.
 * @returns Aggregated requirements including models, custom nodes, and VRAM.
 */
export function detectAllRequirements(
  graph: LGraph | Subgraph | null,
  nodeDefsByName: Record<string, ComfyNodeDefImpl>
): WorkflowRequirements {
  const checkpoints = detectCheckpointModels(graph)
  const loras = detectLoraModels(graph)
  const customNodes = detectCustomNodes(graph, nodeDefsByName)
  const customNodePackages = detectCustomNodePackages(graph, nodeDefsByName)
  const allModels = [...checkpoints, ...loras]

  return {
    checkpoints,
    loras,
    customNodes,
    customNodePackages,
    estimatedVram: estimateVramRequirement(allModels)
  }
}
