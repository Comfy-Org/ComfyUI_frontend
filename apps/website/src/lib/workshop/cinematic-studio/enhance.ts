import { workshopContract } from '../../../config/workshop-contract-catalog'
import type { WorkshopContract } from '../../../config/workshop-contract'

/**
 * Enhance prompt, for real: one GPT 5.6 Luna call through the Router rewrites
 * the scene before the takes run. Only the scene is rewritten; the studio
 * still adds the shot, camera, look, reference and colour sentences itself,
 * so a rewrite can never drop a reference or a colour.
 */
export const ENHANCE_MODEL = 'openai/gpt-5.6-luna'

// A still is one frozen instant; a clip needs something to happen. The two
// ask for different things so the rewrite suits the model it feeds.
const SHARED_RULES = [
  'Keep every person, object, place and action the user wrote, and keep their meaning.',
  'Do not name a camera, lens, focal length, film stock, lighting setup, colour grade, shot size or art style: the studio adds those separately.',
  'Do not mention reference images.',
  'Write in the same language as the user. Return only the rewritten scene as plain prose: no title, list, quotes or commentary.'
]

const INSTRUCTIONS = {
  image: [
    'You rewrite a short scene description into a prompt for an image model making one cinematic film still.',
    'Describe a single frozen moment: who is in frame, what they are doing at that instant, where, and the concrete visible details (materials, weather, texture, expression) that make it vivid.',
    'Use at most 80 words.',
    ...SHARED_RULES
  ],
  video: [
    'You rewrite a short scene description into a prompt for a video model making one continuous cinematic shot of a few seconds.',
    'Describe what happens over time, in order: how the subject moves, what changes in the scene, and how the moment ends. Keep it to one continuous action with no cuts.',
    'Use at most 80 words.',
    ...SHARED_RULES
  ]
} as const

export function enhanceContract(): WorkshopContract | undefined {
  return workshopContract(ENHANCE_MODEL)
}

/** The Responses API body for one rewrite. */
export function enhanceRequest(
  scene: string,
  video: boolean
): Record<string, unknown> {
  return {
    instructions: INSTRUCTIONS[video ? 'video' : 'image'].join(' '),
    input: scene.trim(),
    // on a reasoning id the ceiling also covers the hidden reasoning tokens
    max_output_tokens: 1024,
    reasoning: { effort: 'low' }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The rewritten scene from an OpenAI Responses document, or undefined if it
 * carries none. The text sits at `output[].content[].text` on the message
 * items; reasoning and tool items are skipped.
 */
export function enhancedScene(document: string): string | undefined {
  let data: unknown
  try {
    data = JSON.parse(document)
  } catch {
    return undefined
  }
  if (!isRecord(data)) return undefined
  const texts: string[] = []
  if (typeof data.output_text === 'string') texts.push(data.output_text)
  else if (Array.isArray(data.output))
    for (const item of data.output) {
      if (!isRecord(item) || item.type !== 'message') continue
      if (!Array.isArray(item.content)) continue
      for (const part of item.content)
        if (
          isRecord(part) &&
          part.type === 'output_text' &&
          typeof part.text === 'string'
        )
          texts.push(part.text)
    }
  const scene = texts.join(' ').replace(/\s+/g, ' ').trim()
  return scene || undefined
}
