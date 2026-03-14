import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AuthorStats,
  AuthorTemplatesResponse,
  MarketplaceTemplate
} from '@/platform/marketplace/apiTypes'

const mockService = vi.hoisted(() => ({
  getAuthorTemplates: vi.fn(),
  getAuthorStats: vi.fn()
}))

vi.mock('@/platform/marketplace/services/marketplaceService', () => ({
  marketplaceService: mockService
}))

const { useAuthorDashboard } =
  await import('@/platform/marketplace/composables/useAuthorDashboard')

function makeSeedTemplate(
  overrides: Partial<MarketplaceTemplate>
): MarketplaceTemplate {
  return {
    id: 'tpl_1',
    title: 'Test',
    description: 'desc',
    shortDescription: 'short',
    author: {
      id: 'a1',
      name: 'Author',
      isVerified: false,
      profileUrl: ''
    },
    categories: [],
    tags: [],
    difficulty: 'beginner',
    requiredModels: [],
    requiredNodes: [],
    vramRequirement: 0,
    thumbnail: '',
    gallery: [],
    workflowPreview: '',
    license: 'mit',
    version: '1.0.0',
    status: 'draft',
    updatedAt: new Date().toISOString(),
    stats: {
      downloads: 0,
      favorites: 0,
      rating: 0,
      reviewCount: 0,
      weeklyTrend: 0
    },
    ...overrides
  }
}

describe('useAuthorDashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('starts with empty templates and null stats', () => {
    const { templates, stats, isLoading } = useAuthorDashboard()
    expect(templates.value).toEqual([])
    expect(stats.value).toBeNull()
    expect(isLoading.value).toBe(false)
  })

  describe('loadTemplates', () => {
    it('loads author templates', async () => {
      const response: AuthorTemplatesResponse = {
        templates: [
          makeSeedTemplate({ id: 'tpl_1', status: 'draft' }),
          makeSeedTemplate({ id: 'tpl_2', status: 'approved' })
        ]
      }
      mockService.getAuthorTemplates.mockResolvedValue(response)

      const { loadTemplates, templates } = useAuthorDashboard()
      await loadTemplates()

      expect(templates.value).toHaveLength(2)
    })

    it('sets isLoading during fetch', async () => {
      let resolvePromise!: (v: AuthorTemplatesResponse) => void
      mockService.getAuthorTemplates.mockReturnValue(
        new Promise<AuthorTemplatesResponse>((r) => {
          resolvePromise = r
        })
      )

      const { loadTemplates, isLoading } = useAuthorDashboard()
      const promise = loadTemplates()
      expect(isLoading.value).toBe(true)

      resolvePromise({ templates: [] })
      await promise
      expect(isLoading.value).toBe(false)
    })
  })

  describe('templatesByStatus', () => {
    it('groups templates by status', async () => {
      const response: AuthorTemplatesResponse = {
        templates: [
          makeSeedTemplate({ id: 'tpl_1', status: 'draft' }),
          makeSeedTemplate({ id: 'tpl_2', status: 'draft' }),
          makeSeedTemplate({ id: 'tpl_3', status: 'approved' }),
          makeSeedTemplate({ id: 'tpl_4', status: 'pending_review' })
        ]
      }
      mockService.getAuthorTemplates.mockResolvedValue(response)

      const { loadTemplates, templatesByStatus } = useAuthorDashboard()
      await loadTemplates()

      expect(templatesByStatus.value.draft).toHaveLength(2)
      expect(templatesByStatus.value.approved).toHaveLength(1)
      expect(templatesByStatus.value.pending_review).toHaveLength(1)
      expect(templatesByStatus.value.rejected).toHaveLength(0)
      expect(templatesByStatus.value.unpublished).toHaveLength(0)
    })
  })

  describe('loadStats', () => {
    it('loads stats for a given period', async () => {
      const statsResponse: AuthorStats = {
        templatesCount: 5,
        totalDownloads: 100,
        totalFavorites: 20,
        averageRating: 4.2,
        periodDownloads: 15,
        periodFavorites: 3,
        trend: 2.5
      }
      mockService.getAuthorStats.mockResolvedValue(statsResponse)

      const { loadStats, stats, selectedPeriod } = useAuthorDashboard()
      await loadStats('week')

      expect(stats.value).toEqual(statsResponse)
      expect(selectedPeriod.value).toBe('week')
    })
  })

  describe('error handling', () => {
    it('captures load errors', async () => {
      mockService.getAuthorTemplates.mockRejectedValue(
        new Error('Network failure')
      )

      const { loadTemplates, error } = useAuthorDashboard()
      await loadTemplates()

      expect(error.value).toBe('Network failure')
    })
  })
})
