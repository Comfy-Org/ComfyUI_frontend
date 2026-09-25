import type { AspectRatio } from './catalog'
import type { CinematicModel } from './models'
import { videoResolutionsForAspect } from './video'

export const MOTION_COMPARISON_MOVES = [
  'locked',
  'push-in',
  'pull-out',
  'orbit-left',
  'track-right',
  'crane-up'
] as const
export type MotionComparisonMove = (typeof MOTION_COMPARISON_MOVES)[number]
const instructions: Record<MotionComparisonMove, string> = {
  locked:
    'Keep the camera locked in place. Movement comes only from the subject and environment.',
  'push-in':
    'Move the camera slowly forward toward the subject with a smooth physical dolly-in.',
  'pull-out':
    'Move the camera slowly backward away from the subject with a smooth physical dolly-out.',
  'orbit-left':
    'Orbit the camera gently to the left around the subject, revealing coherent background parallax.',
  'track-right':
    'Track the camera smoothly to the right while retaining the subject in the composition.',
  'crane-up':
    'Raise the camera smoothly in a crane-up movement while keeping the subject readable.'
}
export interface MotionComparisonSource {
  file: File
  url: string
  name: string
  id?: string
}
export interface MotionComparisonPayload {
  readonly modelSlug: string
  readonly sourceFile: File
  readonly sourceId?: string
  readonly sourceName: string
  readonly aspect: AspectRatio
  readonly durationSeconds: number
  readonly resolution: string
  readonly generateAudio: boolean
  readonly seed?: number
  readonly clips: readonly {
    readonly movement: MotionComparisonMove
    readonly label: string
    readonly prompt: string
  }[]
}
export function motionComparisonModels(models: readonly CinematicModel[]) {
  return models.filter(
    (model) =>
      model.video?.firstFrame === 'required' ||
      model.video?.firstFrame === 'optional'
  )
}
export function buildMotionComparison(input: {
  model: CinematicModel
  source: MotionComparisonSource
  action: string
  movements: readonly MotionComparisonMove[]
  aspect: AspectRatio
  durationSeconds: number
  resolution: string
  generateAudio: boolean
  seed?: number
}): MotionComparisonPayload {
  const { model, source, movements } = input
  const video = model.video
  if (
    !video ||
    video.firstFrame === 'unsupported' ||
    !video.durations.includes(input.durationSeconds) ||
    !videoResolutionsForAspect(video, input.aspect).includes(
      input.resolution
    ) ||
    (video.aspects.length && !video.aspects.includes(input.aspect)) ||
    (input.generateAudio && !video.generateAudio)
  )
    throw new Error('Unsupported motion settings')
  if (
    !(source.file instanceof File) ||
    !source.file.size ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(source.file.type)
  )
    throw new Error('Choose an image source')
  if (
    !input.action.trim() ||
    input.action.length > 12000 ||
    movements.length < 1 ||
    movements.length > 3 ||
    new Set(movements).size !== movements.length ||
    movements.some((move) => !MOTION_COMPARISON_MOVES.includes(move))
  )
    throw new Error('Choose one to three camera movements and an action')
  if (
    input.seed !== undefined &&
    (!model.seed ||
      !Number.isFinite(input.seed) ||
      (model.seed.step !== 'any' && !Number.isInteger(input.seed)) ||
      (model.seed.minimum !== undefined && input.seed < model.seed.minimum) ||
      (model.seed.maximum !== undefined && input.seed > model.seed.maximum))
  )
    throw new Error('Unsupported seed')
  return Object.freeze({
    modelSlug: model.slug,
    sourceFile: source.file,
    sourceId: source.id,
    sourceName: source.name,
    aspect: input.aspect,
    durationSeconds: input.durationSeconds,
    resolution: input.resolution,
    generateAudio: input.generateAudio,
    ...(input.seed !== undefined ? { seed: input.seed } : {}),
    clips: Object.freeze(
      movements.map((movement) =>
        Object.freeze({
          movement,
          label: movement,
          prompt: `Begin with the supplied composition: same crop, subject scale and object positions. Do not widen or re-stage the opening frame. Preserve the recognizable subject, clothing, props and scene geometry.\n\n${input.action.trim()}\n\nCamera direction for this clip: ${instructions[movement]}`
        })
      )
    )
  })
}
