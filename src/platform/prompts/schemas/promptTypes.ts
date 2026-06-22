import { z } from 'zod'

/** Asset tag identifying an asset as a reusable prompt. */
export const PROMPT_TAG = 'prompt'

const zPromptSegment = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), value: z.string() }),
  z.object({ type: z.literal('asset'), id: z.string(), name: z.string() }),
  z.object({ type: z.literal('var'), name: z.string() })
])

export const promptTemplateSchema = z.array(zPromptSegment)

/**
 * A single piece of a prompt template: literal text, a live reference to a
 * stored prompt asset, or a reference to a connected graph variable.
 */
export type PromptSegment = z.infer<typeof zPromptSegment>

/** An ordered list of segments forming an editable prompt. */
export type PromptTemplate = z.infer<typeof promptTemplateSchema>

/** A stored prompt, backed by an asset tagged {@link PROMPT_TAG}. */
export interface Prompt {
  id: string
  name: string
  template: PromptTemplate
  description?: string
}
