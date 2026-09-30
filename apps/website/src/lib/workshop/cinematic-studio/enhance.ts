// Only the scene is rewritten: the studio still adds the direction, reference
// and colour sentences itself, so a rewrite cannot drop them.
export const ENHANCE_MODEL = 'openai/gpt-5.6-luna'

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

export function enhanceRequest(
  scene: string,
  video: boolean
): Record<string, unknown> {
  return {
    instructions: INSTRUCTIONS[video ? 'video' : 'image'].join(' '),
    input: scene.trim(),
    max_output_tokens: 1024,
    reasoning: { effort: 'low' }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsed(document: string): unknown {
  try {
    return JSON.parse(document)
  } catch {
    return undefined
  }
}

function messageTexts(item: unknown): string[] {
  if (!isRecord(item) || item.type !== 'message') return []
  if (!Array.isArray(item.content)) return []
  return item.content.flatMap((part) =>
    isRecord(part) &&
    part.type === 'output_text' &&
    typeof part.text === 'string'
      ? [part.text]
      : []
  )
}

function replyTexts(data: Record<string, unknown>): string[] {
  if (typeof data.output_text === 'string') return [data.output_text]
  return Array.isArray(data.output) ? data.output.flatMap(messageTexts) : []
}

/** Undefined unless the response completed: a reply cut off at
 * max_output_tokens (which reasoning shares) is left for the fallback. */
export function enhancedScene(document: string): string | undefined {
  const data = parsed(document)
  if (!isRecord(data) || data.status !== 'completed') return undefined
  const scene = replyTexts(data).join(' ').replace(/\s+/g, ' ').trim()
  return scene || undefined
}
