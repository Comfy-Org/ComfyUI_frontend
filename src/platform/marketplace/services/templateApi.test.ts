import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MarketplaceTemplate } from '../types/marketplace'

import {
  createMemoryCollection,
  createMockMarketplaceTemplate
} from './__tests__/testUtils'

const mockCollection = createMemoryCollection<MarketplaceTemplate>()

vi.mock('@/utils/mockKVStore', () => ({
  useMockKVStore: () => ({
    collection: () => mockCollection
  })
}))

const {
  createTemplate,
  createDraftTemplate,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  submitTemplate
} = await import('./templateApi')

describe('templateApi', () => {
  beforeEach(() => {
    mockCollection.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('createTemplate', () => {
    it('returns id and draft status', async () => {
      const result = await createTemplate(createMockMarketplaceTemplate())
      expect(result.id).toBeTruthy()
      expect(result.status).toBe('draft')
    })

    it('persists the template with timestamps and default stats', async () => {
      const { id } = await createTemplate(createMockMarketplaceTemplate())
      const stored = await getTemplate(id)
      expect(stored).not.toBeNull()
      expect(stored!.createdAt).toBeTruthy()
      expect(stored!.updatedAt).toBeTruthy()
      expect(stored!.stats.downloads).toBe(0)
    })
  })

  describe('createDraftTemplate', () => {
    it('creates a draft with empty partial data', async () => {
      const result = await createDraftTemplate({})
      expect(result.id).toBeTruthy()
      expect(result.status).toBe('draft')
    })

    it('fills defaults for missing required fields', async () => {
      const { id } = await createDraftTemplate({})
      const stored = await getTemplate(id)
      expect(stored!.shortDescription).toBe('')
      expect(stored!.difficulty).toBe('beginner')
      expect(stored!.version).toBe('1.0.0')
    })

    it('preserves provided fields', async () => {
      const { id } = await createDraftTemplate({
        shortDescription: 'My draft',
        difficulty: 'advanced'
      })
      const stored = await getTemplate(id)
      expect(stored!.shortDescription).toBe('My draft')
      expect(stored!.difficulty).toBe('advanced')
    })
  })

  describe('getTemplate', () => {
    it('returns null for nonexistent id', async () => {
      expect(await getTemplate('nope')).toBeNull()
    })
  })

  describe('updateTemplate', () => {
    it('updates fields and refreshes updatedAt', async () => {
      const { id } = await createTemplate(createMockMarketplaceTemplate())
      const before = await getTemplate(id)
      vi.advanceTimersByTime(1000)
      const result = await updateTemplate({
        ...before!,
        id,
        shortDescription: 'Updated'
      })
      expect(result!.shortDescription).toBe('Updated')
      expect(result!.updatedAt).not.toBe(before!.updatedAt)
    })
  })

  describe('deleteTemplate', () => {
    it('deletes an existing template', async () => {
      const { id } = await createTemplate(createMockMarketplaceTemplate())
      expect(await deleteTemplate(id)).toEqual({ success: true })
      expect(await getTemplate(id)).toBeNull()
    })

    it('returns false for nonexistent id', async () => {
      expect(await deleteTemplate('nope')).toEqual({ success: false })
    })
  })

  describe('submitTemplate', () => {
    it('transitions draft to pending_review', async () => {
      const { id } = await createTemplate(createMockMarketplaceTemplate())
      const result = await submitTemplate(id)
      expect(result.status).toBe('pending_review')
      const stored = await getTemplate(id)
      expect(stored!.status).toBe('pending_review')
    })

    it('allows resubmission of rejected templates', async () => {
      const { id } = await createTemplate(createMockMarketplaceTemplate())
      mockCollection.update(id, { status: 'rejected' })
      const result = await submitTemplate(id)
      expect(result.status).toBe('pending_review')
    })

    it('throws for nonexistent template', async () => {
      await expect(submitTemplate('nope')).rejects.toThrow('Template not found')
    })

    it('throws for already pending template', async () => {
      const { id } = await createTemplate(createMockMarketplaceTemplate())
      await submitTemplate(id)
      await expect(submitTemplate(id)).rejects.toThrow(
        'Cannot submit template with status "pending_review"'
      )
    })
  })
})
