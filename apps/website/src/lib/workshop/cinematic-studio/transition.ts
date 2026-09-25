import type { CinematicModel } from './models'
import type { SavedCreation } from './creations'
import { validateRecipeSource } from './recipes'

export type TransitionModel = Pick<
  CinematicModel,
  'slug' | 'name' | 'mode' | 'video'
>
export interface TransitionFrame {
  file: File
  sourceId?: string
}
export interface CinematicTransitionApply {
  modelSlug: string
  firstFrame: File
  lastFrame: File
  firstSourceId?: string
  lastSourceId?: string
  scene?: string
}

export function transitionModels(
  models: readonly TransitionModel[]
): readonly TransitionModel[] {
  return models.filter(
    (model) =>
      model.mode === 'video' &&
      model.video?.firstFrame !== 'unsupported' &&
      model.video?.lastFrame === true
  )
}

export async function savedTransitionFrame(
  creation: SavedCreation,
  revealed = false
): Promise<TransitionFrame> {
  if (creation.kind !== 'image' || (creation.nsfw && !revealed))
    throw new Error('Frame unavailable')
  const file = new File([creation.blob], creation.fileName, {
    type: creation.blob.type
  })
  await validateRecipeSource(file)
  return { file, sourceId: creation.id }
}

export async function uploadedTransitionFrame(
  file: File
): Promise<TransitionFrame> {
  return { file: await validateRecipeSource(file) }
}

export function transitionPayload(
  modelSlug: string,
  models: readonly TransitionModel[],
  first: TransitionFrame,
  last: TransitionFrame,
  scene = ''
): CinematicTransitionApply {
  if (!transitionModels(models).some((model) => model.slug === modelSlug))
    throw new Error('Model does not support boundary frames')
  const prompt = scene.trim()
  if (prompt.length > 8000) throw new Error('Scene too long')
  return {
    modelSlug,
    firstFrame: first.file,
    lastFrame: last.file,
    ...(first.sourceId ? { firstSourceId: first.sourceId } : {}),
    ...(last.sourceId ? { lastSourceId: last.sourceId } : {}),
    ...(prompt ? { scene: prompt } : {})
  }
}
