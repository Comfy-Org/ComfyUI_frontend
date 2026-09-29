import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import type { AspectRatio } from './catalog'
import type { CinematicPrices } from './estimate'
import { contractAspects, referenceCapacity } from './frames'
import { canRunModel } from './gate'

type ModelLookup = (
  slug: string
) =>
  | Pick<
      WorkshopModelDetail,
      'slug' | 'name' | 'provider' | 'execution' | 'incompleteReason' | 'status'
    >
  | undefined

export interface CinematicModel {
  readonly slug: string
  readonly name: string
  readonly provider: string
  readonly logo: string
  readonly degraded?: boolean
  /** The operation that keeps reference images, when the model has one. */
  readonly referenceSlug?: string
  /** How many reference images that operation takes. */
  readonly referenceMax?: number
  /** The frames the model makes exactly; every frame when absent. */
  readonly aspects?: readonly AspectRatio[]
  /** The frames its reference operation makes, when that is another model. */
  readonly referenceAspects?: readonly AspectRatio[]
  /** Credits per take; absent when the model has no verified price. */
  readonly prices?: CinematicPrices
}

const CINEMATIC_MODEL_LOGOS: Readonly<Record<string, string>> = {
  'byteplus--seedream-5-pro--generate-images': '/icons/ai-models/bytedance.svg',
  'vertexai--gemini-3-pro-image--generate-images':
    '/icons/ai-models/gemini.svg',
  'bfl--flux-2-pro--generate-images': '/icons/ai-models/bfl.svg',
  'krea--krea-2-large--generate-images': '/icons/ai-models/krea.svg',
  'qwen--qwen-image-3.0-pro-text-to-image--generate-images':
    '/icons/ai-models/qwen.svg',
  'bfl--flux-2-max--generate-images': '/icons/ai-models/bfl.svg',
  'vertexai--gemini-nano-banana-2--generate-images':
    '/icons/ai-models/gemini.svg',
  'qwen--qwen-image-3.0-text-to-image--generate-images':
    '/icons/ai-models/qwen.svg',
  'openai--gpt-image-2--generate-images': '/icons/ai-models/openai.svg',
  'openai--gpt-image-2.5-flare--generate-images': '/icons/ai-models/openai.svg',
  'openai--gpt-image-2.5-sunburst--generate-images':
    '/icons/ai-models/openai.svg',
  'xai--grok-imagine-image-2.0--generate-images': '/icons/ai-models/grok.svg',
  'recraft--v4.1-text-to-image--generate-images': '/icons/ai-models/recraft.svg'
}

/** Models whose references go to a separate edit operation. The rest keep
 * references themselves when their own contract takes them. */
const REFERENCE_OPERATIONS: Readonly<Record<string, string>> = {
  'byteplus--seedream-5-pro--generate-images':
    'byteplus--seedream-5-pro--edit-images',
  'vertexai--gemini-3-pro-image--generate-images':
    'vertexai--gemini-3-pro-image--edit-images',
  'vertexai--gemini-nano-banana-2--generate-images':
    'vertexai--gemini-nano-banana-2--edit-images'
}

function referenceSupport(
  slug: string,
  model: NonNullable<ReturnType<ModelLookup>>,
  lookup: ModelLookup
): Pick<CinematicModel, 'referenceSlug' | 'referenceMax' | 'referenceAspects'> {
  const operation = REFERENCE_OPERATIONS[slug]
  const referenceModel = operation ? lookup(operation) : model
  if (!referenceModel?.execution || !canRunModel(referenceModel)) return {}
  const referenceMax = referenceCapacity(referenceModel.execution)
  if (!referenceMax) return {}
  return {
    referenceSlug: referenceModel.slug,
    referenceMax,
    ...(referenceModel !== model
      ? { referenceAspects: contractAspects(referenceModel.execution) }
      : {})
  }
}

export function runnableCinematicModels(
  lookup: ModelLookup
): readonly CinematicModel[] {
  return Object.entries(CINEMATIC_MODEL_LOGOS).flatMap(([slug, logo]) => {
    const model = lookup(slug)
    return model && canRunModel(model)
      ? [
          {
            slug: model.slug,
            name: model.name.replace(/ Text-to-Image$/, ''),
            provider: model.provider ?? '',
            logo,
            ...(model.status === 'degraded' ? { degraded: true } : {}),
            ...(model.execution
              ? { aspects: contractAspects(model.execution) }
              : {}),
            ...referenceSupport(slug, model, lookup)
          }
        ]
      : []
  })
}

/** Whether the model can run a shot carrying this many references. */
export function takesReferences(
  model: CinematicModel | undefined,
  count: number
): boolean {
  return (
    count === 0 ||
    (!!model?.referenceSlug && count <= (model.referenceMax ?? 0))
  )
}

/** The frames a shot can ask for: a shot with references runs on the
 * reference operation, so it takes that operation's frames. */
export function shotAspects(
  model: CinematicModel | undefined,
  withReferences: boolean
): readonly AspectRatio[] | undefined {
  return withReferences && model?.referenceAspects
    ? model.referenceAspects
    : model?.aspects
}

export function cinematicStudioHref(
  slug: string,
  studioRoute: string
): string | undefined {
  return slug in CINEMATIC_MODEL_LOGOS
    ? `${studioRoute}?model=${encodeURIComponent(slug)}`
    : undefined
}
