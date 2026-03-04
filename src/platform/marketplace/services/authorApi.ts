import { useMockKVStore } from '@/utils/mockKVStore'

import type {
  AuthorDashboardStats,
  MarketplaceTemplate,
  PeriodDataPoint,
  StatsPeriod
} from '../types/marketplace'

const store = useMockKVStore('marketplace')
const collection = store.collection<MarketplaceTemplate>('templates')

function generateMockPeriodData(period: StatsPeriod): PeriodDataPoint[] {
  const days = period === 'day' ? 1 : period === 'week' ? 7 : 30
  const now = new Date()
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now)
    date.setDate(date.getDate() - (days - 1 - i))
    return {
      date: date.toISOString().slice(0, 10),
      downloads: Math.floor(Math.random() * 50) + 5,
      favorites: Math.floor(Math.random() * 20) + 1
    }
  })
}

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
    periodData: generateMockPeriodData(_period)
  }
}
