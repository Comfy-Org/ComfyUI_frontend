import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { handleRequest } from './routes'
import { resetDb } from './state'

/**
 * Integration tests that exercise the full request → route → state → response
 * cycle, simulating what the Vite proxy will forward to the mock server.
 *
 * These use the handleRequest function directly (same function Bun.serve calls),
 * so they validate the exact behavior the proxy target will expose.
 */
describe('mock marketplace integration', () => {
  beforeAll(() => {
    resetDb()
  })

  afterAll(() => {
    resetDb()
  })

  it('full publish lifecycle: create → update → upload media → submit', async () => {
    // 1. Create draft
    const createRes = await handleRequest(
      new Request('http://localhost/api/marketplace/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Integration Test Workflow',
          description: 'A test workflow for integration testing',
          shortDescription: 'Integration test'
        })
      })
    )
    expect(createRes.status).toBe(201)
    const { id } = await createRes.json()
    expect(id).toBeTruthy()

    // 2. Update with more details
    const updateRes = await handleRequest(
      new Request(`http://localhost/api/marketplace/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: ['image-generation'],
          tags: ['portrait', 'sdxl'],
          difficulty: 'intermediate',
          license: 'mit'
        })
      })
    )
    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json()
    expect(updated.categories).toEqual(['image-generation'])
    expect(updated.difficulty).toBe('intermediate')

    // 3. Upload thumbnail
    const formData = new FormData()
    formData.append(
      'file',
      new Blob(['fake-image-data'], { type: 'image/png' }),
      'thumbnail.png'
    )
    const mediaRes = await handleRequest(
      new Request(`http://localhost/api/marketplace/templates/${id}/media`, {
        method: 'POST',
        body: formData
      })
    )
    expect(mediaRes.status).toBe(201)
    const media = await mediaRes.json()
    expect(media.url).toContain(id)
    expect(media.type).toBe('image/png')

    // 4. Submit for review
    const submitRes = await handleRequest(
      new Request(`http://localhost/api/marketplace/templates/${id}/submit`, {
        method: 'POST'
      })
    )
    expect(submitRes.status).toBe(200)
    const submitBody = await submitRes.json()
    expect(submitBody.status).toBe('pending_review')

    // 5. Verify it shows in author templates
    const listRes = await handleRequest(
      new Request('http://localhost/api/marketplace/author/templates')
    )
    const { templates } = await listRes.json()
    const found = templates.find((t: { id: string }) => t.id === id)
    expect(found).toBeDefined()
    expect(found.status).toBe('pending_review')
  })

  it('categories and tag suggestions are available', async () => {
    const catRes = await handleRequest(
      new Request('http://localhost/api/marketplace/categories')
    )
    expect(catRes.status).toBe(200)
    const { categories } = await catRes.json()
    expect(categories.length).toBeGreaterThan(0)

    const tagRes = await handleRequest(
      new Request('http://localhost/api/marketplace/tags/suggest?query=stable')
    )
    expect(tagRes.status).toBe(200)
    const { tags } = await tagRes.json()
    expect(tags).toContain('stable-diffusion')
  })

  it('reset endpoint clears created data', async () => {
    const resetRes = await handleRequest(
      new Request('http://localhost/api/marketplace/_reset', {
        method: 'POST'
      })
    )
    expect(resetRes.status).toBe(200)

    const listRes = await handleRequest(
      new Request('http://localhost/api/marketplace/author/templates')
    )
    const { templates } = await listRes.json()
    expect(templates).toHaveLength(6) // back to seed count
  })
})
