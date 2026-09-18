import type { WorkshopInputDefinition } from './workshop-input-definition'

export const MODALITIES = ['image', 'video', 'audio', '3d', 'text'] as const
export type Modality = (typeof MODALITIES)[number]

/** Mirrors the JSON type the content catalogue's schema infers. */
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

/** A model's raw input schema, as the content catalogue records it. */
export type WorkshopParameters = Readonly<Record<string, JsonValue>>

/** A media input the model accepts, as the content catalogue records it. */
export interface WorkshopMediaRole {
  readonly role: string
  readonly required: boolean
  readonly cardinality: 'single' | 'many'
  readonly minItems: number
  readonly maxItems?: number
  readonly extras?: readonly Readonly<Record<string, JsonValue>>[]
}

export type GeneratedFieldControl =
  | {
      readonly kind: 'text'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly multiline: boolean
      readonly required: boolean
      readonly default?: string
      readonly valueType?: 'string' | 'json'
      readonly jsonSchema?: Readonly<Record<string, unknown>>
      readonly suggestions?: readonly (string | number | boolean)[]
      readonly minLength?: number
      readonly maxLength?: number
    }
  | {
      readonly kind: 'number'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly min?: number
      readonly max?: number
      readonly step: number | 'any'
      readonly default?: number
      readonly required?: boolean
    }
  | {
      readonly kind: 'select'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly options: readonly (string | number | boolean)[]
      readonly default?: string | number | boolean
      readonly required?: boolean
    }
  | {
      readonly kind: 'toggle'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly default?: boolean
      readonly required?: boolean
    }
  | {
      readonly kind: 'file'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly accept: 'image' | 'video' | 'audio' | 'file'
      readonly mimeTypes?: readonly string[]
      readonly required: boolean
      readonly multiple?: boolean
      readonly maxItems?: number
    }

export type GeneratedField = GeneratedFieldControl & {
  readonly inputSchema?: Readonly<Record<string, unknown>>
  readonly presentation?: WorkshopInputDefinition
}

export type WorkshopExampleValues = Readonly<
  Partial<Record<string, string | number | boolean | readonly string[]>>
>

export interface GeneratedExample {
  readonly name: string
  readonly title: string
  readonly description: string
  readonly tags: readonly string[]
  readonly thumbnailUrl: string
  readonly mediaKind?: 'image' | 'video' | 'audio'
  readonly sampleOnly?: boolean
  readonly node?: { readonly id: string; readonly displayName: string }
  readonly fields?: readonly GeneratedField[]
  readonly values: WorkshopExampleValues
}

export type RunFailure =
  | 'validation'
  | 'provider'
  | 'upload'
  | 'network'
  | 'response'
  | 'client'
  | 'concurrency'
  | 'conflict'
  | 'rateLimit'
  | 'policy'
  | 'noCredits'
  | 'unavailable'
  | 'timeout'

export interface RunOutput {
  readonly kind: Modality | 'other'
  readonly purpose?: 'response-metadata'
  readonly url: string
  readonly byteLength?: number
  readonly text?: string
  readonly truncated?: boolean
  readonly urls?: readonly string[]
  readonly fileName: string
  // Kept on the output itself so earlier runs stay gated once the run state moves on.
  readonly nsfw?: boolean
}
