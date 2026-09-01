import type { TranslationKey } from '../i18n/translations'
import type { Modality } from './workshop'

export type FieldSchema =
  | {
      readonly kind: 'text'
      readonly name: string
      readonly label: TranslationKey
      readonly placeholder: TranslationKey
      readonly required: boolean
      readonly multiline: boolean
    }
  | {
      readonly kind: 'select'
      readonly name: string
      readonly label: TranslationKey
      readonly options: readonly string[]
      readonly defaultValue: string
    }
  | {
      readonly kind: 'number'
      readonly name: string
      readonly label: TranslationKey
      readonly min: number
      readonly max: number
      readonly step: number
      readonly defaultValue: number
    }
  | {
      readonly kind: 'file'
      readonly name: string
      readonly label: TranslationKey
      readonly accept: readonly string[]
      readonly maxBytes: number
      readonly required: boolean
    }

interface FileValue {
  readonly name: string
  readonly size: number
  readonly type: string
}

export type FieldValue = string | number | FileValue | undefined
export type FormValues = Readonly<Record<string, FieldValue>>
export type FieldErrorCode = 'required' | 'tooLarge' | 'badType' | 'rejected'
export type FieldErrors = Readonly<Record<string, FieldErrorCode>>

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const prompt: FieldSchema = {
  kind: 'text',
  name: 'prompt',
  label: 'workshop.field.prompt',
  placeholder: 'workshop.field.promptPlaceholder',
  required: true,
  multiline: true
}

const seed: FieldSchema = {
  kind: 'number',
  name: 'seed',
  label: 'workshop.field.seed',
  min: 0,
  max: 999999,
  step: 1,
  defaultValue: 42
}

const imageUpload = (required: boolean): FieldSchema => ({
  kind: 'file',
  name: 'image',
  label: 'workshop.field.image',
  accept: ['image/png', 'image/jpeg', 'image/webp'],
  maxBytes: MAX_UPLOAD_BYTES,
  required
})

const aspectRatio: FieldSchema = {
  kind: 'select',
  name: 'aspectRatio',
  label: 'workshop.field.aspectRatio',
  options: ['16:9', '9:16', '1:1', '4:3'],
  defaultValue: '16:9'
}

const schemas: Record<Modality | 'other', readonly FieldSchema[]> = {
  image: [
    prompt,
    imageUpload(false),
    aspectRatio,
    {
      kind: 'select',
      name: 'resolution',
      label: 'workshop.field.resolution',
      options: ['1K', '2K', '4K'],
      defaultValue: '1K'
    },
    seed
  ],
  video: [
    prompt,
    imageUpload(false),
    aspectRatio,
    {
      kind: 'number',
      name: 'duration',
      label: 'workshop.field.duration',
      min: 2,
      max: 10,
      step: 1,
      defaultValue: 5
    },
    seed
  ],
  audio: [
    prompt,
    {
      kind: 'select',
      name: 'voice',
      label: 'workshop.field.voice',
      options: ['Narrator', 'Warm', 'Bright', 'Deep'],
      defaultValue: 'Narrator'
    },
    {
      kind: 'number',
      name: 'duration',
      label: 'workshop.field.duration',
      min: 5,
      max: 60,
      step: 5,
      defaultValue: 15
    }
  ],
  '3d': [
    prompt,
    imageUpload(false),
    {
      kind: 'select',
      name: 'format',
      label: 'workshop.field.format',
      options: ['GLB', 'OBJ', 'FBX'],
      defaultValue: 'GLB'
    },
    seed
  ],
  text: [
    prompt,
    {
      kind: 'number',
      name: 'maxTokens',
      label: 'workshop.field.maxTokens',
      min: 64,
      max: 4096,
      step: 64,
      defaultValue: 512
    }
  ],
  other: [prompt, seed]
}

export function schemaFor(
  modality: Modality | undefined
): readonly FieldSchema[] {
  return schemas[modality ?? 'other']
}

export function defaultValues(schema: readonly FieldSchema[]): FormValues {
  return Object.fromEntries(
    schema.map((field) => [
      field.name,
      field.kind === 'select' || field.kind === 'number'
        ? field.defaultValue
        : undefined
    ])
  )
}

export function validateForm(
  schema: readonly FieldSchema[],
  values: FormValues
): FieldErrors {
  const errors: Record<string, FieldErrorCode> = {}
  for (const field of schema) {
    const value = values[field.name]
    if (field.kind === 'text') {
      if (field.required && (typeof value !== 'string' || !value.trim())) {
        errors[field.name] = 'required'
      }
    } else if (field.kind === 'file') {
      if (value === undefined) {
        if (field.required) errors[field.name] = 'required'
      } else if (typeof value === 'object') {
        if (!field.accept.includes(value.type)) errors[field.name] = 'badType'
        else if (value.size > field.maxBytes) errors[field.name] = 'tooLarge'
      }
    }
  }
  return errors
}

export interface PlaygroundExample {
  readonly id: string
  readonly title: TranslationKey
  readonly values: FormValues
  readonly outputUrl: string
}

const SAMPLE_IMAGE =
  'https://media.comfy.org/website/cloud/audience-creator.webp'
const SAMPLE_IMAGE_ALT =
  'https://media.comfy.org/website/cloud/audience-team.webp'
const SAMPLE_VIDEO =
  'https://media.comfy.org/website/models/video_ComfdyUI_00001_.mp4'

const examples: Record<Modality | 'other', readonly PlaygroundExample[]> = {
  image: [
    {
      id: 'product',
      title: 'workshop.examples.product',
      values: {
        prompt:
          'Studio product shot of a matte ceramic mug on a walnut table, soft window light, shallow depth of field',
        aspectRatio: '4:3',
        resolution: '2K',
        seed: 7
      },
      outputUrl: SAMPLE_IMAGE
    },
    {
      id: 'portrait',
      title: 'workshop.examples.portrait',
      values: {
        prompt:
          'Editorial portrait, film grain, golden hour, 85mm lens, natural skin texture',
        aspectRatio: '1:1',
        resolution: '1K',
        seed: 1201
      },
      outputUrl: SAMPLE_IMAGE_ALT
    }
  ],
  video: [
    {
      id: 'extend',
      title: 'workshop.examples.videoExtend',
      values: {
        prompt:
          'Slow dolly-in on a rain-soaked neon street, reflections shimmering, cinematic',
        aspectRatio: '16:9',
        duration: 5,
        seed: 3
      },
      outputUrl: SAMPLE_VIDEO
    },
    {
      id: 'camera',
      title: 'workshop.examples.cameraMotion',
      values: {
        prompt:
          'Orbit shot around a glass sculpture on a pedestal, museum lighting',
        aspectRatio: '9:16',
        duration: 8,
        seed: 88
      },
      outputUrl: SAMPLE_VIDEO
    }
  ],
  audio: [
    {
      id: 'narration',
      title: 'workshop.examples.narration',
      values: {
        prompt: 'Welcome to the Comfy Workshop. Pick a model and hit Run.',
        voice: 'Warm',
        duration: 10
      },
      outputUrl: ''
    }
  ],
  '3d': [
    {
      id: 'asset',
      title: 'workshop.examples.asset',
      values: {
        prompt: 'Low-poly stylized treasure chest, game-ready, clean topology',
        format: 'GLB',
        seed: 5
      },
      outputUrl: SAMPLE_IMAGE_ALT
    }
  ],
  text: [
    {
      id: 'brief',
      title: 'workshop.examples.brief',
      values: {
        prompt:
          'Write three punchy taglines for a product photography studio that uses AI.',
        maxTokens: 256
      },
      outputUrl: ''
    }
  ],
  other: []
}

export function examplesFor(
  modality: Modality | undefined
): readonly PlaygroundExample[] {
  return examples[modality ?? 'other']
}
