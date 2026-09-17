import type { TranslationKey } from '../i18n/translations'
import type { UseCase } from './models-catalogue'
import { capabilityLabelsFor } from './models-catalogue'

/**
 * What someone came to get done, inside the medium they came for. The medium
 * is derived and always complete, so it filters; the outcome is curated and
 * names a job, so it gathers a row. A workflow joins by the tags it carries
 * and a model by the capability those tags stand for, which is why the two can
 * share a row and why a model that does everything joins none of them.
 */
export interface WorkshopOutcome {
  readonly key: string
  readonly useCase: UseCase
  readonly labelKey: TranslationKey
  readonly tags: readonly string[]
}

const WORKSHOP_OUTCOMES: readonly WorkshopOutcome[] = [
  {
    key: 'upscale-restore',
    useCase: 'edit-images',
    labelKey: 'workshop.outcome.upscaleRestore',
    tags: ['Image Upscale']
  },
  {
    key: 'clean-up',
    useCase: 'edit-images',
    labelKey: 'workshop.outcome.cleanUp',
    tags: ['Remove Background', 'Inpainting', 'Outpainting']
  },
  {
    key: 'relight-restyle',
    useCase: 'edit-images',
    labelKey: 'workshop.outcome.relightRestyle',
    tags: ['Relight', 'Style Transfer', 'Style Reference']
  },
  {
    key: 'product-shots',
    useCase: 'edit-images',
    labelKey: 'workshop.outcome.productShots',
    tags: ['Virtual Try-On', 'Brand Design']
  },
  {
    key: 'animate-characters',
    useCase: 'animate-images',
    labelKey: 'workshop.outcome.animateCharacters',
    tags: ['Character Replacement', 'Motion Control']
  },
  {
    key: 'make-them-talk',
    useCase: 'animate-images',
    labelKey: 'workshop.outcome.makeThemTalk',
    tags: ['Lip Sync', 'Audio to Video']
  },
  {
    key: 'first-last-frame',
    useCase: 'animate-images',
    labelKey: 'workshop.outcome.firstLastFrame',
    tags: ['FLF2V']
  },
  {
    key: 'upscale-video',
    useCase: 'edit-videos',
    labelKey: 'workshop.outcome.upscaleVideo',
    tags: ['Video Upscale', 'Frame Interpolation']
  },
  {
    key: 'recut-video',
    useCase: 'edit-videos',
    labelKey: 'workshop.outcome.recutVideo',
    tags: ['Video Edit', 'Video to Video', 'Video Extend']
  },
  {
    key: 'from-a-reference',
    useCase: 'generate-videos',
    labelKey: 'workshop.outcome.fromAReference',
    tags: ['Reference to Video', 'Character Reference']
  },
  {
    key: 'guided-generation',
    useCase: 'generate-images',
    labelKey: 'workshop.outcome.guidedGeneration',
    tags: ['ControlNet', 'LoRA']
  },
  {
    key: 'logos-and-vectors',
    useCase: 'generate-images',
    labelKey: 'workshop.outcome.logosAndVectors',
    tags: ['Vector']
  },
  {
    key: 'model-from-a-photo',
    useCase: '3d',
    labelKey: 'workshop.outcome.modelFromAPhoto',
    tags: ['Image to 3D', 'Text to Model']
  },
  {
    key: 'voices',
    useCase: 'audio',
    labelKey: 'workshop.outcome.voices',
    tags: ['Voice Cloning', 'Text to Speech']
  },
  {
    key: 'music-and-sound',
    useCase: 'audio',
    labelKey: 'workshop.outcome.musicAndSound',
    tags: ['Text to Music', 'Audio Editing']
  }
]

// The capability a model lists is the display form of the tag a workflow
// carries, so one list of tags scopes both sides of a row.
export function capabilitiesOf(outcome: WorkshopOutcome): string[] {
  return capabilityLabelsFor(outcome.tags)
}

export function outcomesIn(useCase: UseCase | 'all'): WorkshopOutcome[] {
  return WORKSHOP_OUTCOMES.filter(
    (outcome) => useCase === 'all' || outcome.useCase === useCase
  )
}
