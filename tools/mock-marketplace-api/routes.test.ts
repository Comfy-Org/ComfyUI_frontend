import { beforeEach, describe, expect, it } from 'vitest'

import type {
  AuthorStats,
  CreateTemplateResponse,
  MarketplaceTemplate,
  MediaUploadResponse,
  SubmitTemplateResponse
} from '../../src/platform/marketplace/apiTypes'

import { handleRequest } from './routes.ts'
import { resetDb } from './state.ts'

function jsonRequest(path: string, method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new Request(`http://localhost${path}`, init)
}

function getRequest(path: string): Request {
  return new Request(`http://localhost${path}`, { method: 'GET' })
}

describe('mock marketplace routes', () => {
  beforeEach(() => {
    resetDb()
  })

  describe('POST /api/marketplace/templates', () => {
    it('creates a draft template', async () => {
      const res = await handleRequest(
        jsonRequest('/api/marketplace/templates', 'POST', {
          title: 'Test Template',
          description: 'A description',
          shortDescription: 'Short'
        })
      )
      expect(res.status).toBe(201)

      const body: CreateTemplateResponse = await res.json()
      expect(body.id).toBeTruthy()
      expect(body.status).toBe('draft')
    })

    it('returns 400 for missing required fields', async () => {
      const res = await handleRequest(
        jsonRequest('/api/marketplace/templates', 'POST', {
          title: 'Only Title'
        })
      )
      expect(res.status).toBe(400)
    })
  })

  describe('PUT /api/marketplace/templates/:id', () => {
    it('updates an existing template', async () => {
      const createRes = await handleRequest(
        jsonRequest('/api/marketplace/templates', 'POST', {
          title: 'Original',
          description: 'd',
          shortDescription: 's'
        })
      )
      const { id } = (await createRes.json()) as CreateTemplateResponse

      const updateRes = await handleRequest(
        jsonRequest(`/api/marketplace/templates/${id}`, 'PUT', {
          title: 'Updated'
        })
      )
      expect(updateRes.status).toBe(200)

      const body: MarketplaceTemplate = await updateRes.json()
      expect(body.title).toBe('Updated')
    })

    it('returns 404 for unknown template', async () => {
      const res = await handleRequest(
        jsonRequest('/api/marketplace/templates/unknown', 'PUT', {
          title: 'x'
        })
      )
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/marketplace/templates/:id/submit', () => {
    it('transitions draft to pending_review', async () => {
      const createRes = await handleRequest(
        jsonRequest('/api/marketplace/templates', 'POST', {
          title: 'T',
          description: 'd',
          shortDescription: 's'
        })
      )
      const { id } = (await createRes.json()) as CreateTemplateResponse

      const submitRes = await handleRequest(
        jsonRequest(`/api/marketplace/templates/${id}/submit`, 'POST')
      )
      expect(submitRes.status).toBe(200)

      const body: SubmitTemplateResponse = await submitRes.json()
      expect(body.status).toBe('pending_review')
    })

    it('returns 400 for invalid transition', async () => {
      const createRes = await handleRequest(
        jsonRequest('/api/marketplace/templates', 'POST', {
          title: 'T',
          description: 'd',
          shortDescription: 's'
        })
      )
      const { id } = (await createRes.json()) as CreateTemplateResponse

      await handleRequest(
        jsonRequest(`/api/marketplace/templates/${id}/submit`, 'POST')
      )

      // Already pending_review; submitting again is invalid
      const res = await handleRequest(
        jsonRequest(`/api/marketplace/templates/${id}/submit`, 'POST')
      )
      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/marketplace/templates/:id/approve', () => {
    it('transitions pending_review to approved', async () => {
      const createRes = await handleRequest(
        jsonRequest('/api/marketplace/templates', 'POST', {
          title: 'T',
          description: 'd',
          shortDescription: 's'
        })
      )
      const { id } = (await createRes.json()) as CreateTemplateResponse

      await handleRequest(
        jsonRequest(`/api/marketplace/templates/${id}/submit`, 'POST')
      )
      const approveRes = await handleRequest(
        jsonRequest(`/api/marketplace/templates/${id}/approve`, 'POST')
      )
      expect(approveRes.status).toBe(200)

      const body = await approveRes.json()
      expect(body.status).toBe('approved')
    })
  })

  describe('POST /api/marketplace/templates/:id/reject', () => {
    it('transitions pending_review to rejected', async () => {
      const createRes = await handleRequest(
        jsonRequest('/api/marketplace/templates', 'POST', {
          title: 'T',
          description: 'd',
          shortDescription: 's'
        })
      )
      const { id } = (await createRes.json()) as CreateTemplateResponse

      await handleRequest(
        jsonRequest(`/api/marketplace/templates/${id}/submit`, 'POST')
      )
      const rejectRes = await handleRequest(
        jsonRequest(`/api/marketplace/templates/${id}/reject`, 'POST')
      )
      expect(rejectRes.status).toBe(200)

      const body = await rejectRes.json()
      expect(body.status).toBe('rejected')
    })
  })

  describe('POST /api/marketplace/templates/:id/unpublish', () => {
    it('transitions approved to unpublished', async () => {
      const createRes = await handleRequest(
        jsonRequest('/api/marketplace/templates', 'POST', {
          title: 'T',
          description: 'd',
          shortDescription: 's'
        })
      )
      const { id } = (await createRes.json()) as CreateTemplateResponse

      await handleRequest(
        jsonRequest(`/api/marketplace/templates/${id}/submit`, 'POST')
      )
      await handleRequest(
        jsonRequest(`/api/marketplace/templates/${id}/approve`, 'POST')
      )
      const unpubRes = await handleRequest(
        jsonRequest(`/api/marketplace/templates/${id}/unpublish`, 'POST')
      )
      expect(unpubRes.status).toBe(200)

      const body = await unpubRes.json()
      expect(body.status).toBe('unpublished')
    })
  })

  describe('POST /api/marketplace/templates/:id/media', () => {
    it('accepts a file upload and returns url + type', async () => {
      const createRes = await handleRequest(
        jsonRequest('/api/marketplace/templates', 'POST', {
          title: 'T',
          description: 'd',
          shortDescription: 's'
        })
      )
      const { id } = (await createRes.json()) as CreateTemplateResponse

      const formData = new FormData()
      formData.append(
        'file',
        new Blob(['fake-image'], { type: 'image/png' }),
        'thumb.png'
      )

      const mediaRes = await handleRequest(
        new Request(`http://localhost/api/marketplace/templates/${id}/media`, {
          method: 'POST',
          body: formData
        })
      )
      expect(mediaRes.status).toBe(201)

      const body: MediaUploadResponse = await mediaRes.json()
      expect(body.url).toBeTruthy()
      expect(body.type).toBe('image/png')
    })

    it('returns 404 for unknown template', async () => {
      const formData = new FormData()
      formData.append('file', new Blob(['x']), 'x.png')

      const res = await handleRequest(
        new Request('http://localhost/api/marketplace/templates/ghost/media', {
          method: 'POST',
          body: formData
        })
      )
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/marketplace/author/templates', () => {
    it('returns seeded templates', async () => {
      const res = await handleRequest(
        getRequest('/api/marketplace/author/templates')
      )
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.templates).toBeInstanceOf(Array)
      expect(body.templates.length).toBeGreaterThan(0)
    })
  })

  describe('GET /api/marketplace/author/stats', () => {
    it('returns stats for a given period', async () => {
      const res = await handleRequest(
        getRequest('/api/marketplace/author/stats?period=week')
      )
      expect(res.status).toBe(200)

      const body: AuthorStats = await res.json()
      expect(body.templatesCount).toBeDefined()
      expect(body.totalDownloads).toBeDefined()
    })
  })

  describe('GET /api/marketplace/categories', () => {
    it('returns category list', async () => {
      const res = await handleRequest(getRequest('/api/marketplace/categories'))
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.categories).toBeInstanceOf(Array)
      expect(body.categories.length).toBeGreaterThan(0)
    })
  })

  describe('GET /api/marketplace/tags/suggest', () => {
    it('returns tags matching query', async () => {
      const res = await handleRequest(
        getRequest('/api/marketplace/tags/suggest?query=image')
      )
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.tags).toBeInstanceOf(Array)
    })

    it('returns empty array when no matches', async () => {
      const res = await handleRequest(
        getRequest('/api/marketplace/tags/suggest?query=xyznonexistent')
      )
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.tags).toEqual([])
    })
  })

  describe('unknown routes', () => {
    it('returns 404', async () => {
      const res = await handleRequest(getRequest('/api/marketplace/unknown'))
      expect(res.status).toBe(404)
    })
  })
})
