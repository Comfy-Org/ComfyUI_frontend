import { z } from 'zod'

/** The local proxy's port; the layer and the proxy both read it from here. */
export const MODEL_PROXY_PORT = 5248

const MAX_REQUEST_TOKENS = 16_000

/**
 * What the layer posts to the proxy's `/chat`: a chat-completions body without
 * a model. The proxy drops every field that is not listed here, adds the model
 * and the key, and always asks for a streamed answer.
 */
export const chatBodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['system', 'user']), content: z.string() }))
    .min(1),
  response_format: z
    .object({
      type: z.literal('json_schema'),
      json_schema: z.object({
        name: z.string(),
        strict: z.literal(true),
        schema: z.record(z.string(), z.unknown())
      })
    })
    .optional(),
  max_tokens: z.number().int().positive().max(MAX_REQUEST_TOKENS),
  reasoning: z.union([
    z.object({ effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']) }),
    z.object({ exclude: z.literal(true) })
  ])
})

export type ChatBody = z.infer<typeof chatBodySchema>
