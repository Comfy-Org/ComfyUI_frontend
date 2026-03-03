import { useMockKVStore } from '@/utils/mockKVStore'

import type {
  AuthorDashboardStats,
  MarketplaceTemplate,
  StatsPeriod
} from '../types/marketplace'

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

// GET /api/marketplace/author/stats?period=week
export async function getAuthorStats(
  authorId: string,
  _period: StatsPeriod = 'week'
): Promise<AuthorDashboardStats> {
  const templates = collection.find(
    (template) => template.author.id === authorId
  )
  return {
    totalDownloads: templates.reduce(
      (sum, template) => sum + template.stats.downloads,
      0
    ),
    totalFavorites: templates.reduce(
      (sum, template) => sum + template.stats.favorites,
      0
    ),
    averageRating:
      templates.length > 0
        ? templates.reduce((sum, template) => sum + template.stats.rating, 0) /
          templates.length
        : 0,
    templateCount: templates.length,
    periodData: []
  }
}
