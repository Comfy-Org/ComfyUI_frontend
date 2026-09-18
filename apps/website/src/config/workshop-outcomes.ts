import type { TranslationKey } from '../i18n/translations'

/**
 * What someone came to get done. The medium is derived and always complete, so
 * it filters and heads a shelf; the outcome is curated and names a job, so it
 * gathers a row inside one. It does not declare a medium of its own: the tags
 * decide which shelves it turns up on, which is how one "Upscale & restore"
 * serves both the images and the videos.
 *
 * Only workflows join. A model is a capability rather than a job, and the
 * measurement bears that out: no model in the catalogue lists a single one.
 */
export interface WorkshopOutcome {
  readonly key: string
  readonly labelKey: TranslationKey
  readonly tags: readonly string[]
}

export const WORKSHOP_OUTCOMES: readonly WorkshopOutcome[] = [
  {
    key: 'animate-characters',
    labelKey: 'workshop.outcome.animateCharacters',
    tags: [
      'Character Replacement',
      'Motion Control',
      'Lip Sync',
      'Audio to Video'
    ]
  },
  {
    key: 'product-shots',
    labelKey: 'workshop.outcome.productShots',
    tags: ['Virtual Try-On', 'Brand Design']
  },
  {
    key: 'upscale-restore',
    labelKey: 'workshop.outcome.upscaleRestore',
    tags: ['Image Upscale', 'Video Upscale', 'Frame Interpolation']
  },
  {
    key: 'clean-up',
    labelKey: 'workshop.outcome.cleanUp',
    tags: ['Remove Background', 'Inpainting', 'Outpainting']
  },
  {
    key: 'relight-restyle',
    labelKey: 'workshop.outcome.relightRestyle',
    tags: ['Relight', 'Style Transfer', 'Style Reference']
  },
  {
    key: 'first-last-frame',
    labelKey: 'workshop.outcome.firstLastFrame',
    tags: ['FLF2V']
  },
  {
    key: 'recut-video',
    labelKey: 'workshop.outcome.recutVideo',
    tags: ['Video Edit', 'Video to Video', 'Video Extend']
  },
  {
    key: 'from-a-reference',
    labelKey: 'workshop.outcome.fromAReference',
    tags: ['Reference to Video', 'Character Reference']
  },
  {
    key: 'guided-generation',
    labelKey: 'workshop.outcome.guidedGeneration',
    tags: ['ControlNet', 'LoRA']
  },
  {
    key: 'logos-and-vectors',
    labelKey: 'workshop.outcome.logosAndVectors',
    tags: ['Vector']
  },
  {
    key: 'model-from-a-photo',
    labelKey: 'workshop.outcome.modelFromAPhoto',
    tags: ['Image to 3D', 'Text to Model']
  },
  {
    key: 'voices',
    labelKey: 'workshop.outcome.voices',
    tags: ['Voice Cloning', 'Text to Speech']
  },
  {
    key: 'music-and-sound',
    labelKey: 'workshop.outcome.musicAndSound',
    tags: ['Text to Music', 'Audio Editing']
  }
]
