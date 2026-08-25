export const MODEL_CATEGORIES = [
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

const sectionCategories: Readonly<Record<string, ModelCategory>> = {
  Image: 'image',
  Video: 'video',
  Audio: 'audio',
  '3D Model': '3d',
  LLM: 'llm'
}

export function deriveModelCategories(
  section: string,
  tags: readonly string[]
): ModelCategory[] {
  const categories = new Set<ModelCategory>()
  const sectionCategory = sectionCategories[section]
  if (sectionCategory) categories.add(sectionCategory)

  for (const tag of tags) {
    const normalizedTag = tag.toLowerCase()

    if (normalizedTag.includes('image')) categories.add('image')
    if (normalizedTag.includes('video')) categories.add('video')
    if (
      normalizedTag.includes('audio') ||
      normalizedTag.includes('music') ||
      normalizedTag.includes('speech') ||
      normalizedTag.includes('voice')
    ) {
      categories.add('audio')
    }
    if (normalizedTag.includes('3d')) categories.add('3d')
    if (
      normalizedTag.includes('edit') ||
      normalizedTag.includes('inpainting') ||
      normalizedTag.includes('outpainting') ||
      normalizedTag.includes('remove background')
    ) {
      categories.add('edit')
    }
    if (normalizedTag.includes('upscale')) categories.add('upscale')
    if (normalizedTag.includes('text generation')) categories.add('llm')
    if (normalizedTag.includes('train')) categories.add('train')
  }

  return MODEL_CATEGORIES.filter((category) => categories.has(category))
}
