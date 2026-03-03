import { useMockKVStore } from '@/utils/mockKVStore'

import type { MarketplaceTemplate } from '../types/marketplace'

const store = useMockKVStore('marketplace')
const collection = store.collection<MarketplaceTemplate>('templates')

// GET /api/marketplace/categories
export async function getCategories(): Promise<{ categories: string[] }> {
  // Static list matching the spec's predefined categories.
  // Real implementation: GET from server.
  return {
    categories: [
      'Image Generation',
      'Video',
      'Audio',
      'Upscaling',
      '3D',
      'LLM',
      'ControlNet',
      'LoRA Training',
      'Inpainting',
      'Img2Img'
    ]
  }
}

// GET /api/marketplace/tags/suggest?query=...&nodeTypes=...
export async function suggestTags(
  query: string,
  _nodeTypes?: string[]
): Promise<{ tags: string[] }> {
  const allTags = collection
    .list()
    .flatMap((entry) => entry.template.tags ?? [])
  const unique = [...new Set(allTags)]

  if (!query) return { tags: unique.slice(0, 10) }

  const lower = query.toLowerCase()
  return {
    tags: unique.filter((tag) => tag.toLowerCase().includes(lower))
  }
}
