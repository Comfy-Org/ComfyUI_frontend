import type { SwapCanvas, SwapSize } from './clip'
import swapGraph from './swap.api.json'

type Graph = Record<
  string,
  { class_type: string; inputs: Record<string, unknown> }
>

const MAX_SEED = 2 ** 32 - 1

/** The PrepareVideo resolution each quality asks for; the app proxy prices by it. */
export const RESOLUTION: Record<SwapSize, number> = { '480p': 480, '768p': 768 }

export interface SwapRequest {
  /** The uploaded clip's asset name, as the upload returned it. */
  readonly video: string
  /** The uploaded character image's asset name. */
  readonly character: string
  /** The uploaded first-frame anchor's asset name, when one was made. */
  readonly anchor?: string
  /** The visitor's description of the character and what to keep. */
  readonly target: string
  /** Seconds into the clip where the swap starts. */
  readonly start: number
  /** Seconds of the clip to swap, and of the result; see `swapSeconds`. */
  readonly seconds: number
  readonly size: SwapSize
  /** What H3 generates on; see `swapCanvas`. */
  readonly canvas: SwapCanvas
  /** What is saved, in the source's own shape; see `resultSize`. */
  readonly result: SwapCanvas
  readonly seed: number
}

/** The workflow's own instruction, with H3's reference tags, then the visitor's words. */
export function swapPrompt(description: string, withAnchor: boolean): string {
  return [
    'Replace the selected person in <Video 1> with the character in <Picture 1>.',
    'Preserve the source performance, scene and audio timing.',
    withAnchor ? 'Start from the first frame in <Picture 2>.' : '',
    description.trim()
  ]
    .filter(Boolean)
    .join(' ')
}

/** A blank seed draws a fresh one per run; a typed one is kept as given. */
export function resolveSeed(
  seed: number | undefined,
  random: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0]
): number {
  return seed === undefined ? random() : Math.min(MAX_SEED, Math.max(0, seed))
}

export function swapWorkflow(request: SwapRequest): Graph {
  const graph: Graph = structuredClone(swapGraph)
  graph['30'].inputs.file = request.video
  graph['9'].inputs.image = request.character
  useAnchor(graph, request.anchor)
  Object.assign(graph.trim.inputs, {
    start_time: request.start,
    duration: request.seconds
  })
  Object.assign(graph['31'].inputs, {
    resolution: RESOLUTION[request.size],
    duration_seconds: request.seconds
  })
  Object.assign(graph['801'].inputs, {
    prompt: swapPrompt(request.target, request.anchor !== undefined),
    seed: request.seed
  })
  return graph
}

function useAnchor(graph: Graph, anchor: string | undefined) {
  if (anchor !== undefined) {
    graph.anchor_image.inputs.image = anchor
    return
  }
  delete graph.anchor_image
  delete graph.anchor_fit
  delete graph['803'].inputs.anchor
  graph['803'].inputs.use_anchor = false
}
