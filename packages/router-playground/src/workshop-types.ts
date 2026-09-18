import type { z } from 'zod/v4'

import type {
  generatedExampleSchema,
  generatedFieldSchema,
  workshopExampleValuesSchema
} from './workshop-generated-schema'

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

/** What the engine reads of a media input the model accepts. The site's
 * parsed role carries more; a structural type lets it pass unchanged. */
export interface WorkshopMediaRole {
  readonly role: string
  readonly required: boolean
  readonly cardinality: 'single' | 'many'
  readonly maxItems?: number
}

/** The parsed shapes, read-only: the engine never edits a model's content. */
type Immutable<T> = T extends (infer U)[]
  ? readonly Immutable<U>[]
  : T extends object
    ? { readonly [K in keyof T]: Immutable<T[K]> }
    : T

export type GeneratedField = Immutable<z.infer<typeof generatedFieldSchema>>

/** Example and default values; a form may leave any of them unset. */
export type WorkshopExampleValues = Immutable<
  Partial<z.infer<typeof workshopExampleValuesSchema>>
>

export interface GeneratedExample extends Immutable<
  Omit<z.infer<typeof generatedExampleSchema>, 'values'>
> {
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
