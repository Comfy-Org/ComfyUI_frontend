import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AuthorStats,
  CategoriesResponse,
  CreateTemplateResponse,
  MarketplaceTemplate,
  MediaUploadResponse,
  SubmitTemplateResponse,
  TagSuggestResponse
} from '@/platform/marketplace/apiTypes'

const mockFetchApi = vi.hoisted(() => vi.fn())

vi.mock('@/scripts/api', () => ({
  api: { fetchApi: mockFetchApi }
}))

function mockJsonResponse<T>(payload: T, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(payload)
  } as unknown as Response
}

// Import after mocks are set up
const { marketplaceService } =
  await import('@/platform/marketplace/services/marketplaceService')

describe('marketplaceService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('createTemplate', () => {
    it('sends POST to /marketplace/templates and returns id + status', async () => {
      const response: CreateTemplateResponse = {
        id: 'tpl_1',
        status: 'draft'
      }
      mockFetchApi.mockResolvedValue(mockJsonResponse(response, true, 201))

      const result = await marketplaceService.createTemplate({
        title: 'My Workflow',
        description: 'A description',
        shortDescription: 'Short'
      })

      expect(mockFetchApi).toHaveBeenCalledWith('/marketplace/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'My Workflow',
          description: 'A description',
          shortDescription: 'Short'
        })
      })
      expect(result).toEqual(response)
    })

    it('throws on non-ok response', async () => {
      mockFetchApi.mockResolvedValue(
        mockJsonResponse({ error: 'Bad request' }, false, 400)
      )

      await expect(
        marketplaceService.createTemplate({
          title: '',
          description: '',
          shortDescription: ''
        })
      ).rejects.toThrow()
    })
  })

  describe('updateTemplate', () => {
    it('sends PUT to /marketplace/templates/:id', async () => {
      const template = { id: 'tpl_1', title: 'Updated' } as MarketplaceTemplate
      mockFetchApi.mockResolvedValue(mockJsonResponse(template))

      const result = await marketplaceService.updateTemplate('tpl_1', {
        title: 'Updated'
      })

      expect(mockFetchApi).toHaveBeenCalledWith(
        '/marketplace/templates/tpl_1',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Updated' })
        }
      )
      expect(result.title).toBe('Updated')
    })
  })

  describe('submitTemplate', () => {
    it('sends POST to /marketplace/templates/:id/submit', async () => {
      const response: SubmitTemplateResponse = { status: 'pending_review' }
      mockFetchApi.mockResolvedValue(mockJsonResponse(response))

      const result = await marketplaceService.submitTemplate('tpl_1')

      expect(mockFetchApi).toHaveBeenCalledWith(
        '/marketplace/templates/tpl_1/submit',
        { method: 'POST' }
      )
      expect(result.status).toBe('pending_review')
    })
  })

  describe('publishTemplate', () => {
    it('sends POST to /marketplace/templates/:id/publish', async () => {
      const response = { status: 'published' }
      mockFetchApi.mockResolvedValue(mockJsonResponse(response))

      const result = await marketplaceService.publishTemplate('tpl_1')

      expect(mockFetchApi).toHaveBeenCalledWith(
        '/marketplace/templates/tpl_1/publish',
        { method: 'POST' }
      )
      expect(result.status).toBe('published')
    })
  })

  describe('unpublishTemplate', () => {
    it('sends POST to /marketplace/templates/:id/unpublish', async () => {
      const response = { status: 'unpublished' }
      mockFetchApi.mockResolvedValue(mockJsonResponse(response))

      const result = await marketplaceService.unpublishTemplate('tpl_1')

      expect(mockFetchApi).toHaveBeenCalledWith(
        '/marketplace/templates/tpl_1/unpublish',
        { method: 'POST' }
      )
      expect(result.status).toBe('unpublished')
    })
  })

  describe('uploadTemplateMedia', () => {
    it('sends POST with FormData to /marketplace/templates/:id/media', async () => {
      const response: MediaUploadResponse = {
        url: 'https://cdn.example.com/thumb.png',
        type: 'image/png'
      }
      mockFetchApi.mockResolvedValue(mockJsonResponse(response, true, 201))

      const file = new File(['image-data'], 'thumb.png', { type: 'image/png' })
      const result = await marketplaceService.uploadTemplateMedia('tpl_1', file)

      expect(mockFetchApi).toHaveBeenCalledWith(
        '/marketplace/templates/tpl_1/media',
        {
          method: 'POST',
          body: expect.any(FormData)
        }
      )
      expect(result.url).toBe('https://cdn.example.com/thumb.png')
      expect(result.type).toBe('image/png')
    })
  })

  describe('getAuthorTemplates', () => {
    it('sends GET to /marketplace/author/templates', async () => {
      const response = { templates: [] as MarketplaceTemplate[] }
      mockFetchApi.mockResolvedValue(mockJsonResponse(response))

      const result = await marketplaceService.getAuthorTemplates()

      expect(mockFetchApi).toHaveBeenCalledWith(
        '/marketplace/author/templates',
        { method: 'GET' }
      )
      expect(result.templates).toEqual([])
    })
  })

  describe('getAuthorStats', () => {
    it('sends GET with period query param', async () => {
      const response: AuthorStats = {
        templatesCount: 5,
        totalDownloads: 100,
        totalFavorites: 20,
        averageRating: 4.2,
        periodDownloads: 15,
        periodFavorites: 3,
        trend: 2.5
      }
      mockFetchApi.mockResolvedValue(mockJsonResponse(response))

      const result = await marketplaceService.getAuthorStats('week')

      expect(mockFetchApi).toHaveBeenCalledWith(
        '/marketplace/author/stats?period=week',
        { method: 'GET' }
      )
      expect(result.templatesCount).toBe(5)
    })
  })

  describe('getCategories', () => {
    it('sends GET to /marketplace/categories', async () => {
      const response: CategoriesResponse = {
        categories: [{ id: 'img', name: 'Image Generation' }]
      }
      mockFetchApi.mockResolvedValue(mockJsonResponse(response))

      const result = await marketplaceService.getCategories()

      expect(mockFetchApi).toHaveBeenCalledWith('/marketplace/categories', {
        method: 'GET'
      })
      expect(result.categories).toHaveLength(1)
    })
  })

  describe('suggestTags', () => {
    it('sends GET with query param', async () => {
      const response: TagSuggestResponse = { tags: ['portrait', 'photo'] }
      mockFetchApi.mockResolvedValue(mockJsonResponse(response))

      const result = await marketplaceService.suggestTags('port')

      expect(mockFetchApi).toHaveBeenCalledWith(
        '/marketplace/tags/suggest?query=port',
        { method: 'GET' }
      )
      expect(result.tags).toEqual(['portrait', 'photo'])
    })

    it('includes nodeTypes when provided', async () => {
      const response: TagSuggestResponse = { tags: ['sdxl'] }
      mockFetchApi.mockResolvedValue(mockJsonResponse(response))

      await marketplaceService.suggestTags('sd', ['CheckpointLoaderSimple'])

      expect(mockFetchApi).toHaveBeenCalledWith(
        '/marketplace/tags/suggest?query=sd&nodeTypes=CheckpointLoaderSimple',
        { method: 'GET' }
      )
    })
  })
})
