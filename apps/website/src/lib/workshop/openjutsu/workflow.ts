import type { SwapCanvas } from './clip'
import { FPS } from './clip'
import swapGraph from './swap.api.json'

type Graph = Record<
  string,
  { class_type: string; inputs: Record<string, unknown> }
>

const MAX_SEED = 2 ** 32 - 1

export interface SwapRequest {
  /** The uploaded clip's asset name, as the upload returned it. */
  readonly video: string
  /** The uploaded character image's asset name. */
  readonly character: string
  /** Who in the clip is replaced, in the visitor's words. */
  readonly target: string
  /** Seconds into the clip where the swap starts. */
  readonly start: number
  /** A length on H3's 17k + 5 grid; see `gridFrames`. */
  readonly frames: number
  readonly canvas: SwapCanvas
  readonly seed: number
}

/**
 * The wording the LoRA's model card recommends: its short training caption,
 * then the preservation lines that helped its author's own comparisons. The
 * card warns that pushing expressions harder can suppress the swap, so nothing
 * more is added. `<Video 1>` and `<Picture 1>` are how H3 names its references.
 */
export function swapPrompt(target: string): string {
  const who = target.trim().replace(/[.\s]+$/, '')
  return [
    `Replace only ${who} in <Video 1> with the character in <Picture 1>.`,
    "Keep the replacement character's identity, outfit, and art style from <Picture 1>.",
    "Preserve the source video's camera, framing, background, lighting, objects, and all other people.",
    "Match the target person's position, scale, pose, and movement throughout the clip.",
    'Do not show the reference image or its background.'
  ].join(' ')
}

/** A blank seed draws a fresh one per run; a typed one is kept as given. */
export function resolveSeed(
  seed: number | undefined,
  random: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0]
): number {
  return seed === undefined ? random() : Math.min(MAX_SEED, Math.max(0, seed))
}

/** The seconds of output a request makes, which is also what it trims to. */
export const swapSeconds = (frames: number) => frames / FPS

export function swapWorkflow(request: SwapRequest): Graph {
  const graph: Graph = structuredClone(swapGraph)
  graph.video.inputs.file = request.video
  graph.character.inputs.image = request.character
  graph.trim.inputs.start_time = request.start
  graph.frames.inputs.value = request.frames
  graph['129'].inputs.noise_seed = request.seed
  Object.assign(graph['136'].inputs, {
    prompt: swapPrompt(request.target),
    width: request.canvas.width,
    height: request.canvas.height
  })
  return graph
}
