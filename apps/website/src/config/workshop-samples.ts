import type { WorkshopField } from './workshop-detail'
import type { WorkshopFormValues } from './workshop-detail'

/**
 * A prompt already in the box, so the first thing a visitor does is press Run
 * rather than think of something to type.
 *
 * Chosen per output type because the same words do not work everywhere: a
 * text-to-speech model reads its prompt aloud, a music model wants a
 * description of a sound, and a 3D model wants a single object rather than a
 * scene.
 */
const SAMPLE_PROMPTS: Record<string, string> = {
  image: 'a red bicycle leaning against a white wall, soft morning light',
  video: 'a red bicycle leaning against a white wall, camera slowly pushing in',
  audio: 'Comfy Workshop lets you run any model straight from your browser.',
  music: 'a warm lo-fi piano loop with soft vinyl crackle',
  '3d': 'a small ceramic teapot with a curved handle',
  svg: 'a minimal line-art bicycle icon, single colour'
}

/**
 * Which field is the prompt.
 *
 * Matched by name. The partner registry does carry an explicit `promptField`
 * per model, which is the right source; our catalog does not carry it through
 * yet, and adding it means a schema change plus regenerating every entry —
 * not worth doing while the catalog's source is still being decided. Swapping
 * this for the carried field is a one-line change when it is.
 */
function isPromptField(field: WorkshopField): boolean {
  if (field.kind !== 'text' || field.valueType !== 'string') return false
  const name = field.name.toLowerCase()
  if (name.startsWith('negative')) return false
  return name === 'prompt' || name === 'text' || name.endsWith('_prompt')
}

/**
 * Seeds a sample prompt into defaults, without overriding anything the model
 * already specifies a default for.
 */
export function withSamplePrompt(
  values: WorkshopFormValues,
  fields: readonly WorkshopField[],
  modality: string
): WorkshopFormValues {
  const sample = SAMPLE_PROMPTS[modality]
  if (sample === undefined) return values

  const prompt = fields.find(isPromptField)
  if (prompt === undefined) return values
  // A model that ships its own default knows better than this file does.
  if (values[prompt.name] !== undefined && values[prompt.name] !== '') {
    return values
  }

  return { ...values, [prompt.name]: sample }
}
