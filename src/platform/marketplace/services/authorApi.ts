import { useMockKVStore } from '@/utils/mockKVStore'

import type { MarketplaceTemplate } from '../types/marketplace'

const store = useMockKVStore('marketplace')
const collection = store.collection<MarketplaceTemplate>('templates')

// GET /api/marketplace/author/templates
export async function getAuthorTemplates(
  authorId: string
): Promise<{ templates: MarketplaceTemplate[] }> {
  const templates = collection.find(
    (template) => template.author.id === authorId
  )
  return { templates }
}
