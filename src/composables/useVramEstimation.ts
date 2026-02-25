import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { mapAllNodes } from '@/utils/graphTraversalUtil'

/**
 * A model detected in a workflow graph, identified by the directory
 * category it belongs to and the filename selected in its widget.
 */
export interface DetectedModel {
  /** Model directory category (e.g. 'checkpoints', 'loras'). */
  category: string
  /** Selected model filename from the node's widget, if available. */
  filename: string | undefined
}

/**
 * Approximate VRAM consumption in bytes per model directory category.
 * Values represent typical fp16 model sizes loaded into GPU memory.
 */
export const MODEL_VRAM_ESTIMATES: Record<string, number> = {
  checkpoints: 4_500_000_000,
  diffusion_models: 4_500_000_000,
  loras: 200_000_000,
  controlnet: 1_500_000_000,
  vae: 350_000_000,
  clip_vision: 600_000_000,
  text_encoders: 1_200_000_000,
  upscale_models: 200_000_000,
  style_models: 500_000_000,
  gligen: 500_000_000
}

/** Default VRAM estimate for unrecognised model categories. */
const DEFAULT_MODEL_VRAM = 500_000_000

/** Flat overhead for intermediate tensors and activations. */
export const RUNTIME_OVERHEAD = 500_000_000

/**
 * Categories whose models act as the "base" diffusion backbone.
 * Only the single largest base model is counted because ComfyUI
 * does not keep multiple base models resident simultaneously.
 */
const BASE_MODEL_CATEGORIES = new Set(['checkpoints', 'diffusion_models'])

/**
 * Extracts the widget value for the model input key from a graph node.
 *
 * @param node - The graph node to inspect
 * @param category - The model category, used to look up the expected input key
 * @returns The string widget value, or undefined if not found
 */
function getModelWidgetValue(
  node: LGraphNode,
  category: string
): string | undefined {
  const store = useModelToNodeStore()
  const providers = store.getAllNodeProviders(category)
  for (const provider of providers) {
    if (provider.nodeDef?.name !== node.type) continue
    if (!provider.key) return undefined

    const widget = node.widgets?.find((w) => w.name === provider.key)
    if (widget?.value && typeof widget.value === 'string') {
      return widget.value
    }
  }
  return undefined
}

/**
 * Detects all model-loading nodes in a graph hierarchy and returns
 * a deduplicated list of models with their category and filename.
 *
 * @param graph - The root graph (or subgraph) to traverse
 * @returns Array of unique detected models
 */
export function detectModelNodes(graph: LGraph | Subgraph): DetectedModel[] {
  const store = useModelToNodeStore()

  const raw = mapAllNodes(graph, (node) => {
    if (!node.type) return undefined
    const category = store.getCategoryForNodeType(node.type)
    if (!category) return undefined

    const filename = getModelWidgetValue(node, category)
    return { category, filename } satisfies DetectedModel
  })

  const seen = new Set<string>()
  return raw.filter((model) => {
    const key = `${model.category}::${model.filename ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Estimates peak VRAM consumption (in bytes) for a workflow graph.
 *
 * The heuristic:
 * 1. Detect all model-loading nodes in the graph.
 * 2. For base model categories (checkpoints, diffusion_models), take only
 *    the largest single model — ComfyUI offloads others.
 * 3. Sum all other model categories (LoRAs, ControlNets, VAEs, etc.)
 *    as they can be co-resident.
 * 4. Add a flat runtime overhead for activations and intermediates.
 *
 * @param graph - The root graph to analyse
 * @returns Estimated VRAM in bytes, or 0 if no models detected
 */
export function estimateWorkflowVram(
  graph: LGraph | Subgraph | null | undefined
): number {
  if (!graph) return 0

  const models = detectModelNodes(graph)
  if (models.length === 0) return 0

  let baseCost = 0
  let additionalCost = 0

  for (const model of models) {
    const estimate = MODEL_VRAM_ESTIMATES[model.category] ?? DEFAULT_MODEL_VRAM

    if (BASE_MODEL_CATEGORIES.has(model.category)) {
      baseCost = Math.max(baseCost, estimate)
    } else {
      additionalCost += estimate
    }
  }

  return baseCost + additionalCost + RUNTIME_OVERHEAD
}
