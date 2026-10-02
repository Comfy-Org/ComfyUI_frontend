const MODEL_CATEGORIES = [
  'image',
  'video',
  'audio',
  '3d',
  'edit',
  'upscale',
  'llm',
  'train'
] as const

export type ModelCategory = (typeof MODEL_CATEGORIES)[number]

export const MODEL_FILTER_CATEGORIES = MODEL_CATEGORIES.filter(
  (category) => category !== 'train'
)

const sectionCategories: Readonly<Partial<Record<string, ModelCategory>>> = {
  Image: 'image',
  'Image Tools': 'image',
  Vector: 'image',
  Video: 'video',
  'Video Tools': 'video',
  Audio: 'audio',
  '3D Model': '3d',
  LLM: 'llm'
}

const categoryPatterns: Readonly<Record<ModelCategory, readonly string[]>> = {
  image: ['image'],
  video: ['video'],
  audio: ['to audio', 'music', 'speech', 'voice'],
  '3d': ['3d'],
  edit: ['edit', 'inpainting', 'outpainting', 'remove background'],
  upscale: ['upscale'],
  llm: ['text generation'],
  train: ['train']
}

export function deriveModelCategories(
  section: string,
  tags: readonly string[]
): ModelCategory[] {
  const normalizedTags = tags.map((tag) => tag.toLowerCase())
  return MODEL_CATEGORIES.filter(
    (category) =>
      sectionCategories[section] === category ||
      normalizedTags.some((tag) =>
        categoryPatterns[category].some((pattern) => tag.includes(pattern))
      )
  )
}
