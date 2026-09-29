import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import type { AspectRatio } from './catalog'
import type { CinematicPrices } from './estimate'
import { contractAspects, referenceCapacity } from './frames'
import { acceptsLinks } from './take-image'
import { canRunModel } from './gate'
import type { CinematicVideoCapabilities } from './video'
import { videoCapabilities } from './video'

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
  /** Whether those references may be web links the model fetches itself. */
  readonly referenceLinks?: boolean
  /** The frames the model makes exactly; every frame when absent. */
  readonly aspects?: readonly AspectRatio[]
  /** The frames its reference operation makes, when that is another model. */
  readonly referenceAspects?: readonly AspectRatio[]
  /** Credits per take; absent when the model has no verified price. */
  readonly prices?: CinematicPrices
  /** A video model; image models leave it out. */
  readonly mode?: 'video'
  /** What the model's own operation lets a video shot choose. */
  readonly video?: CinematicVideoCapabilities
  /** The operation that starts from an image, when the model has one. */
  readonly firstFrameSlug?: string
  /** What that operation lets a video shot choose. */
  readonly firstFrameVideo?: CinematicVideoCapabilities
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
): Pick<
  CinematicModel,
  'referenceSlug' | 'referenceMax' | 'referenceLinks' | 'referenceAspects'
> {
  const operation = REFERENCE_OPERATIONS[slug]
  const referenceModel = operation ? lookup(operation) : model
  if (!referenceModel?.execution || !canRunModel(referenceModel)) return {}
  const referenceMax = referenceCapacity(referenceModel.execution)
  if (!referenceMax) return {}
  return {
    referenceSlug: referenceModel.slug,
    referenceMax,
    referenceLinks: acceptsLinks(referenceModel.execution, 'reference_images'),
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

interface VideoEntry {
  readonly name: string
  readonly logo: string
  /** The image-to-video operation, when it is not the model itself. */
  readonly firstFrame?: string
}

/** The studio's video models, in the order the picker lists them. */
const CINEMATIC_VIDEO_MODELS: Readonly<Record<string, VideoEntry>> = {
  'byteplus--seedance-2-5-text-to-video--generate-videos': {
    name: 'Seedance 2.5',
    logo: '/icons/ai-models/bytedance.svg',
    firstFrame: 'byteplus--seedance-2-5-first-last-frame--animate-images'
  },
  'byteplus--seedance-2-5-edit-video--edit-videos': {
    name: 'Seedance 2.5 Edit',
    logo: '/icons/ai-models/bytedance.svg'
  },
  'byteplus--seedance-2-text-to-video--generate-videos': {
    name: 'Seedance 2.0',
    logo: '/icons/ai-models/bytedance.svg',
    firstFrame: 'byteplus--seedance-2-image-to-video--animate-images'
  },
  'byteplus--seedance-2-fast-text-to-video--generate-videos': {
    name: 'Seedance 2.0 Fast',
    logo: '/icons/ai-models/bytedance.svg',
    firstFrame: 'byteplus--seedance-2-fast-first-last-frame--animate-images'
  },
  'byteplus--seedance-2-mini-text-to-video--generate-videos': {
    name: 'Seedance 2.0 Mini',
    logo: '/icons/ai-models/bytedance.svg'
  },
  'wan--text-to-video-3.0--generate-videos': {
    name: 'Wan 3.0',
    logo: '/icons/ai-models/wan.svg',
    firstFrame: 'wan--image-to-video-3.0--animate-images'
  },
  'bfl--flux-3-text-to-video--generate-videos': {
    name: 'FLUX.3 Video',
    logo: '/icons/ai-models/bfl.svg',
    firstFrame: 'bfl--flux-3-image-to-video--animate-images'
  },
  'gemini--omni-1.1-flash--generate-videos': {
    name: 'Gemini Omni Flash 1.1',
    logo: '/icons/ai-models/gemini.svg',
    firstFrame: 'gemini--omni-1.1-flash--animate-images'
  },
  'xai--grok-imagine-video-1.5--generate-videos': {
    name: 'Grok Imagine 1.5',
    logo: '/icons/ai-models/grok.svg',
    firstFrame: 'xai--grok-imagine-video-1.5--animate-images'
  },
  'kling--v3--generate-videos': {
    name: 'Kling 3.0',
    logo: '/icons/ai-models/kling.svg',
    firstFrame: 'kling--v3--animate-images'
  }
}

function firstFrameSupport(
  entry: VideoEntry,
  model: NonNullable<ReturnType<ModelLookup>>,
  video: CinematicVideoCapabilities,
  lookup: ModelLookup
): Pick<CinematicModel, 'firstFrameSlug' | 'firstFrameVideo'> {
  const operation = entry.firstFrame ? lookup(entry.firstFrame) : undefined
  if (operation?.execution && canRunModel(operation)) {
    const capabilities = videoCapabilities(operation.execution)
    return capabilities.firstFrame
      ? { firstFrameSlug: operation.slug, firstFrameVideo: capabilities }
      : {}
  }
  return video.firstFrame
    ? { firstFrameSlug: model.slug, firstFrameVideo: video }
    : {}
}

/** Video models run their own operation; a starting image moves the shot to
 * the image-to-video operation, the way references move an image shot. */
export function runnableCinematicVideoModels(
  lookup: ModelLookup
): readonly CinematicModel[] {
  return Object.entries(CINEMATIC_VIDEO_MODELS).flatMap(([slug, entry]) => {
    const model = lookup(slug)
    if (!model?.execution || !canRunModel(model)) return []
    const video = videoCapabilities(model.execution)
    return [
      {
        slug: model.slug,
        name: entry.name,
        provider: model.provider ?? '',
        logo: entry.logo,
        ...(model.status === 'degraded' ? { degraded: true } : {}),
        mode: 'video' as const,
        video,
        ...firstFrameSupport(entry, model, video, lookup)
      }
    ]
  })
}

export function cinematicStudioHref(
  slug: string,
  studioRoute: string
): string | undefined {
  return slug in CINEMATIC_MODEL_LOGOS || slug in CINEMATIC_VIDEO_MODELS
    ? `${studioRoute}?model=${encodeURIComponent(slug)}`
    : undefined
}
