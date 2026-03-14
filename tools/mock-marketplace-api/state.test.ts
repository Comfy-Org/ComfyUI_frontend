import { beforeEach, describe, expect, it } from 'vitest'

import type { CreateTemplateRequest } from '../../src/platform/marketplace/apiTypes'

import {
  addMedia,
  createTemplate,
  findTemplate,
  getDb,
  resetDb,
  transitionStatus,
  updateTemplate
} from './state.ts'

describe('mock marketplace state', () => {
  beforeEach(() => {
    resetDb()
  })

  describe('seed data', () => {
    it('has seeded templates', () => {
      const { templates } = getDb()
      expect(templates.length).toBeGreaterThan(0)
    })

    it('has seeded categories', () => {
      const { categories } = getDb()
      expect(categories.length).toBeGreaterThan(0)
    })

    it('has seeded tags for suggestion', () => {
      const { suggestedTags } = getDb()
      expect(suggestedTags.length).toBeGreaterThan(0)
    })
  })

  describe('resetDb', () => {
    it('restores seed data after mutations', () => {
      const db = getDb()
      const initialCount = db.templates.length
      createTemplate({
        title: 'Extra',
        description: 'desc',
        shortDescription: 'short'
      })
      expect(db.templates.length).toBe(initialCount + 1)

      resetDb()
      expect(getDb().templates.length).toBe(initialCount)
    })
  })

  describe('createTemplate', () => {
    it('returns a new template with draft status', () => {
      const req: CreateTemplateRequest = {
        title: 'My Workflow',
        description: 'A cool workflow',
        shortDescription: 'Cool'
      }
      const template = createTemplate(req)

      expect(template.id).toBeTruthy()
      expect(template.status).toBe('draft')
      expect(template.title).toBe('My Workflow')
    })

    it('adds the template to the db', () => {
      const before = getDb().templates.length
      createTemplate({
        title: 'T',
        description: 'd',
        shortDescription: 's'
      })
      expect(getDb().templates.length).toBe(before + 1)
    })

    it('generates unique IDs', () => {
      const a = createTemplate({
        title: 'A',
        description: 'd',
        shortDescription: 's'
      })
      const b = createTemplate({
        title: 'B',
        description: 'd',
        shortDescription: 's'
      })
      expect(a.id).not.toBe(b.id)
    })
  })

  describe('findTemplate', () => {
    it('returns template by id', () => {
      const created = createTemplate({
        title: 'Find Me',
        description: 'd',
        shortDescription: 's'
      })
      const found = findTemplate(created.id)
      expect(found).toBeDefined()
      expect(found!.title).toBe('Find Me')
    })

    it('returns undefined for unknown id', () => {
      expect(findTemplate('nonexistent')).toBeUndefined()
    })
  })

  describe('updateTemplate', () => {
    it('patches template fields', () => {
      const created = createTemplate({
        title: 'Original',
        description: 'd',
        shortDescription: 's'
      })
      const updated = updateTemplate(created.id, { title: 'Updated' })
      expect(updated).toBeDefined()
      expect(updated!.title).toBe('Updated')
      expect(updated!.description).toBe('d')
    })

    it('returns undefined for unknown id', () => {
      expect(updateTemplate('nope', { title: 'x' })).toBeUndefined()
    })
  })

  describe('transitionStatus', () => {
    it('transitions draft → pending_review', () => {
      const t = createTemplate({
        title: 'T',
        description: 'd',
        shortDescription: 's'
      })
      const result = transitionStatus(t.id, 'pending_review')
      expect(result.ok).toBe(true)
      expect(findTemplate(t.id)!.status).toBe('pending_review')
    })

    it('transitions pending_review → approved', () => {
      const t = createTemplate({
        title: 'T',
        description: 'd',
        shortDescription: 's'
      })
      transitionStatus(t.id, 'pending_review')
      const result = transitionStatus(t.id, 'approved')
      expect(result.ok).toBe(true)
      expect(findTemplate(t.id)!.status).toBe('approved')
    })

    it('transitions pending_review → rejected', () => {
      const t = createTemplate({
        title: 'T',
        description: 'd',
        shortDescription: 's'
      })
      transitionStatus(t.id, 'pending_review')
      const result = transitionStatus(t.id, 'rejected')
      expect(result.ok).toBe(true)
      expect(findTemplate(t.id)!.status).toBe('rejected')
    })

    it('transitions approved → published → unpublished', () => {
      const t = createTemplate({
        title: 'T',
        description: 'd',
        shortDescription: 's'
      })
      transitionStatus(t.id, 'pending_review')
      transitionStatus(t.id, 'approved')
      const publishResult = transitionStatus(t.id, 'published')
      expect(publishResult.ok).toBe(true)
      expect(findTemplate(t.id)!.status).toBe('published')
      expect(findTemplate(t.id)!.publishedAt).toBeDefined()

      const unpubResult = transitionStatus(t.id, 'unpublished')
      expect(unpubResult.ok).toBe(true)
      expect(findTemplate(t.id)!.status).toBe('unpublished')

      const repubResult = transitionStatus(t.id, 'published')
      expect(repubResult.ok).toBe(true)
      expect(findTemplate(t.id)!.status).toBe('published')
    })

    it('transitions rejected → pending_review via resubmit', () => {
      const t = createTemplate({
        title: 'T',
        description: 'd',
        shortDescription: 's'
      })
      transitionStatus(t.id, 'pending_review')
      transitionStatus(t.id, 'rejected')
      const result = transitionStatus(t.id, 'pending_review')
      expect(result.ok).toBe(true)
      expect(findTemplate(t.id)!.status).toBe('pending_review')
    })

    it('rejects invalid transition draft → approved', () => {
      const t = createTemplate({
        title: 'T',
        description: 'd',
        shortDescription: 's'
      })
      const result = transitionStatus(t.id, 'approved')
      expect(result.ok).toBe(false)
      expect(result.error).toBeTruthy()
      expect(findTemplate(t.id)!.status).toBe('draft')
    })

    it('returns error for unknown template', () => {
      const result = transitionStatus('ghost', 'pending_review')
      expect(result.ok).toBe(false)
    })
  })

  describe('addMedia', () => {
    it('stores media for a template', async () => {
      const t = createTemplate({
        title: 'T',
        description: 'd',
        shortDescription: 's'
      })
      const file = new File(['fake-image'], 'photo.png', { type: 'image/png' })
      const media = await addMedia(t.id, file)
      expect(media).toBeDefined()
      expect(media!.url).toContain('photo.png')
      expect(media!.type).toBe('image/png')
    })

    it('accumulates multiple media entries', async () => {
      const t = createTemplate({
        title: 'T',
        description: 'd',
        shortDescription: 's'
      })
      await addMedia(t.id, new File(['a'], 'a.png', { type: 'image/png' }))
      await addMedia(t.id, new File(['b'], 'b.mp4', { type: 'video/mp4' }))
      const db = getDb()
      expect(db.mediaByTemplateId[t.id]).toHaveLength(2)
    })

    it('returns undefined for unknown template', async () => {
      const file = new File(['x'], 'x.png', { type: 'image/png' })
      const result = await addMedia('ghost', file)
      expect(result).toBeUndefined()
    })
  })
})
