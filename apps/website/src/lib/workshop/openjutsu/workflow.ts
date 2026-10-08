import type { SwapCanvas } from './clip'
import { gridFrames, sourceFrames } from './clip'
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
  /** Seconds of the clip to swap, and of the result; see `swapSeconds`. */
  readonly seconds: number
  /** What H3 generates on; see `swapCanvas`. */
  readonly canvas: SwapCanvas
  /** What is saved, in the source's own shape; see `resultSize`. */
  readonly result: SwapCanvas
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

export function swapWorkflow(request: SwapRequest): Graph {
  const graph: Graph = structuredClone(swapGraph)
  graph.video.inputs.file = request.video
  graph.character.inputs.image = request.character
  graph.trim.inputs.start_time = request.start
  // H3 is shown the part's own frames, generates the next grid length up, and
  // the result is cut back to the part, so it lines up with the source sound.
  graph.trim.inputs.duration = request.seconds
  graph.sample.inputs.num_frames = sourceFrames(request.seconds)
  graph.frames.inputs.value = gridFrames(request.seconds)
  graph.cut.inputs.duration = request.seconds
  graph['129'].inputs.noise_seed = request.seed
  Object.assign(graph['136'].inputs, {
    prompt: swapPrompt(request.target),
    width: request.canvas.width,
    height: request.canvas.height
  })
  Object.assign(graph.fit.inputs, request.result)
  return graph
}
