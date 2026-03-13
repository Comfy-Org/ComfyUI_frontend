import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CategoriesResponse,
  CreateTemplateResponse,
  MediaUploadResponse,
  SubmitTemplateResponse,
  TagSuggestResponse
} from '@/platform/marketplace/apiTypes'

const mockService = vi.hoisted(() => ({
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  submitTemplate: vi.fn(),
  uploadTemplateMedia: vi.fn(),
  getAuthorTemplates: vi.fn(),
  getCategories: vi.fn(),
  suggestTags: vi.fn()
}))

vi.mock('@/platform/marketplace/services/marketplaceService', () => ({
  marketplaceService: mockService
}))

const { useMarketplacePublishing } =
  await import('@/platform/marketplace/composables/useMarketplacePublishing')

describe('useMarketplacePublishing', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('starts at step 1 with no draft', () => {
    const { currentStep, draftId, isPublishing } = useMarketplacePublishing()
    expect(currentStep.value).toBe(1)
    expect(draftId.value).toBeNull()
    expect(isPublishing.value).toBe(false)
  })

  describe('createDraft', () => {
    it('creates a draft and advances to step 2', async () => {
      const response: CreateTemplateResponse = { id: 'tpl_1', status: 'draft' }
      mockService.createTemplate.mockResolvedValue(response)

      const { createDraft, currentStep, draftId } = useMarketplacePublishing()

      await createDraft({
        title: 'Test',
        description: 'Desc',
        shortDescription: 'Short'
      })

      expect(draftId.value).toBe('tpl_1')
      expect(currentStep.value).toBe(2)
    })

    it('sets error on failure', async () => {
      mockService.createTemplate.mockRejectedValue(new Error('Network error'))

      const { createDraft, error } = useMarketplacePublishing()

      await createDraft({
        title: 'Test',
        description: 'Desc',
        shortDescription: 'Short'
      })

      expect(error.value).toBe('Network error')
    })
  })

  describe('saveDraft', () => {
    it('calls updateTemplate with current draft id', async () => {
      mockService.createTemplate.mockResolvedValue({
        id: 'tpl_1',
        status: 'draft'
      })
      mockService.updateTemplate.mockResolvedValue({
        id: 'tpl_1',
        title: 'Updated'
      })

      const { createDraft, saveDraft } = useMarketplacePublishing()
      await createDraft({
        title: 'T',
        description: 'd',
        shortDescription: 's'
      })
      await saveDraft({ title: 'Updated' })

      expect(mockService.updateTemplate).toHaveBeenCalledWith('tpl_1', {
        title: 'Updated'
      })
    })

    it('does nothing if no draft exists', async () => {
      const { saveDraft } = useMarketplacePublishing()
      await saveDraft({ title: 'x' })
      expect(mockService.updateTemplate).not.toHaveBeenCalled()
    })
  })

  describe('uploadMedia', () => {
    it('uploads file and returns media response', async () => {
      mockService.createTemplate.mockResolvedValue({
        id: 'tpl_1',
        status: 'draft'
      })
      const mediaResponse: MediaUploadResponse = {
        url: 'https://cdn.example.com/thumb.png',
        type: 'image/png'
      }
      mockService.uploadTemplateMedia.mockResolvedValue(mediaResponse)

      const { createDraft, uploadMedia } = useMarketplacePublishing()
      await createDraft({
        title: 'T',
        description: 'd',
        shortDescription: 's'
      })

      const file = new File(['data'], 'thumb.png', { type: 'image/png' })
      const result = await uploadMedia(file)

      expect(result).toEqual(mediaResponse)
      expect(mockService.uploadTemplateMedia).toHaveBeenCalledWith(
        'tpl_1',
        file
      )
    })
  })

  describe('submit', () => {
    it('submits the draft and sets status to pending_review', async () => {
      mockService.createTemplate.mockResolvedValue({
        id: 'tpl_1',
        status: 'draft'
      })
      const submitResponse: SubmitTemplateResponse = {
        status: 'pending_review'
      }
      mockService.submitTemplate.mockResolvedValue(submitResponse)

      const { createDraft, submit, isPublishing } = useMarketplacePublishing()
      await createDraft({
        title: 'T',
        description: 'd',
        shortDescription: 's'
      })

      const result = await submit()

      expect(result).toEqual(submitResponse)
      expect(isPublishing.value).toBe(false)
    })

    it('sets error on submission failure', async () => {
      mockService.createTemplate.mockResolvedValue({
        id: 'tpl_1',
        status: 'draft'
      })
      mockService.submitTemplate.mockRejectedValue(
        new Error('Submission failed')
      )

      const { createDraft, submit, error } = useMarketplacePublishing()
      await createDraft({
        title: 'T',
        description: 'd',
        shortDescription: 's'
      })
      await submit()

      expect(error.value).toBe('Submission failed')
    })
  })

  describe('step navigation', () => {
    it('goToStep changes current step', () => {
      const { goToStep, currentStep } = useMarketplacePublishing()
      goToStep(3)
      expect(currentStep.value).toBe(3)
    })

    it('nextStep increments current step', () => {
      const { nextStep, currentStep } = useMarketplacePublishing()
      nextStep()
      expect(currentStep.value).toBe(2)
      nextStep()
      expect(currentStep.value).toBe(3)
    })

    it('prevStep decrements current step but not below 1', () => {
      const { goToStep, prevStep, currentStep } = useMarketplacePublishing()
      goToStep(3)
      prevStep()
      expect(currentStep.value).toBe(2)
      prevStep()
      expect(currentStep.value).toBe(1)
      prevStep()
      expect(currentStep.value).toBe(1)
    })
  })

  describe('reset', () => {
    it('resets all state', async () => {
      mockService.createTemplate.mockResolvedValue({
        id: 'tpl_1',
        status: 'draft'
      })

      const { createDraft, reset, draftId, currentStep, error } =
        useMarketplacePublishing()
      await createDraft({
        title: 'T',
        description: 'd',
        shortDescription: 's'
      })

      reset()

      expect(draftId.value).toBeNull()
      expect(currentStep.value).toBe(1)
      expect(error.value).toBeNull()
    })
  })

  describe('loadCategories', () => {
    it('loads and stores categories', async () => {
      const response: CategoriesResponse = {
        categories: [{ id: 'img', name: 'Image Generation' }]
      }
      mockService.getCategories.mockResolvedValue(response)

      const { loadCategories, categories } = useMarketplacePublishing()
      await loadCategories()

      expect(categories.value).toEqual(response.categories)
    })
  })

  describe('loadTagSuggestions', () => {
    it('loads tag suggestions for a query', async () => {
      const response: TagSuggestResponse = { tags: ['portrait', 'photo'] }
      mockService.suggestTags.mockResolvedValue(response)

      const { loadTagSuggestions, tagSuggestions } = useMarketplacePublishing()
      await loadTagSuggestions('port')

      expect(tagSuggestions.value).toEqual(['portrait', 'photo'])
    })
  })
})
