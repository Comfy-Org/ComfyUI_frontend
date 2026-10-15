export const SAME_PROMPT_TYPES = [
  'portraits',
  'product',
  'illustration',
  'typography',
  'fusion'
] as const
export type SamePromptType = (typeof SAME_PROMPT_TYPES)[number]

export interface SamePromptSample {
  readonly type: SamePromptType
  /** The prompt every model was given, word for word. */
  readonly prompt: string
  /** Where the images were made. */
  readonly source: 'magnific'
  /** Each model's output, keyed by its catalogue slug. */
  readonly images: Readonly<Record<string, string>>
}

const MODELS = {
  'seedream-5-pro': 'byteplus--seedream-5-pro--generate-images',
  'gpt-image-2': 'openai--gpt-image-2--generate-images',
  'nano-banana-2': 'vertexai--gemini-nano-banana-2--generate-images',
  'flux-2-pro': 'bfl--flux-2-pro--generate-images'
} as const

function imagesFor(type: SamePromptType): Record<string, string> {
  return Object.fromEntries(
    Object.entries(MODELS).map(([file, slug]) => [
      slug,
      `/images/hub/compare/${file}-${type}.webp`
    ])
  )
}

const PROMPTS: readonly Pick<SamePromptSample, 'type' | 'prompt'>[] = [
  {
    type: 'portraits',
    prompt:
      'Close-up portrait of an elderly fisherman with a weathered face, soft window light'
  },
  {
    type: 'product',
    prompt: 'A glass perfume bottle on wet black stone, studio product shot'
  },
  {
    type: 'illustration',
    prompt: "A cozy treehouse library, children's book illustration"
  },
  {
    type: 'typography',
    prompt: 'A vintage travel poster that reads "COMFY HUB" in bold letters'
  },
  { type: 'fusion', prompt: 'An astronaut made of lava' }
]

/**
 * The same prompt run on each model, 3:2, generated in Magnific, which runs
 * these same models. The compare view shows a type only when it has samples.
 */
export const SAME_PROMPT_SAMPLES: readonly SamePromptSample[] = PROMPTS.map(
  (sample) => ({
    ...sample,
    source: 'magnific',
    images: imagesFor(sample.type)
  })
)
