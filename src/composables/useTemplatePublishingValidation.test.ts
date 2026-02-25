import { describe, expect, it, vi } from 'vitest'

import type { MarketplaceTemplate } from '@/types/templateMarketplace'

import {
  isTemplateComplete,
  validateStep
} from './useTemplatePublishingValidation'

const { mockLoad, mockSave } = vi.hoisted(() => ({
  mockLoad: vi.fn(),
  mockSave: vi.fn()
}))

vi.mock(
  '@/platform/workflow/templates/composables/useTemplatePublishStorage',
  () => ({
    loadTemplateUnderway: mockLoad,
    saveTemplateUnderway: mockSave
  })
)

import { useTemplatePublishingStepper } from './useTemplatePublishingStepper'

/**
 * Builds a minimal template that passes all step validations.
 */
function makeCompleteTemplate(): Partial<MarketplaceTemplate> {
  return {
    title: 'My Template',
    difficulty: 'beginner',
    license: 'mit',
    description: 'A full description of the template.',
    thumbnail: 'blob:http://localhost/thumb',
    workflowPreview: 'blob:http://localhost/workflow',
    categories: ['image-generation']
  }
}

describe('useTemplatePublishingValidation', () => {
  describe('validateStep', () => {
    it('validates required fields per step', () => {
      const emptyTemplate: Partial<MarketplaceTemplate> = {}

      const step2 = validateStep(2, emptyTemplate)
      expect(step2.valid).toBe(false)
      expect(step2.errors).toContain('Title is required')
      expect(step2.errors).toContain('Difficulty is required')
      expect(step2.errors).toContain('License is required')

      const step3 = validateStep(3, emptyTemplate)
      expect(step3.valid).toBe(false)
      expect(step3.errors).toContain('Description is required')

      const step4 = validateStep(4, emptyTemplate)
      expect(step4.valid).toBe(false)
      expect(step4.errors).toContain('Thumbnail is required')
      expect(step4.errors).toContain('Workflow preview is required')

      const step5 = validateStep(5, emptyTemplate)
      expect(step5.valid).toBe(false)
      expect(step5.errors).toContain('Categories is required')
    })

    it('passes validation when all fields are filled', () => {
      const complete = makeCompleteTemplate()

      expect(validateStep(2, complete).valid).toBe(true)
      expect(validateStep(3, complete).valid).toBe(true)
      expect(validateStep(4, complete).valid).toBe(true)
      expect(validateStep(5, complete).valid).toBe(true)
    })

    it('treats empty arrays as missing for categories', () => {
      const template: Partial<MarketplaceTemplate> = { categories: [] }
      const result = validateStep(5, template)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Categories is required')
    })

    it('marks steps without required fields as valid', () => {
      expect(validateStep(1, {}).valid).toBe(true)
      expect(validateStep(6, {}).valid).toBe(true)
      expect(validateStep(7, {}).valid).toBe(true)
      expect(validateStep(8, {}).valid).toBe(true)
    })
  })

  describe('isTemplateComplete', () => {
    it('returns true for a fully populated template', () => {
      expect(isTemplateComplete(makeCompleteTemplate())).toBe(true)
    })

    it('returns false when any required field is missing', () => {
      const partial = makeCompleteTemplate()
      delete partial.description
      expect(isTemplateComplete(partial)).toBe(false)
    })
  })

  describe('publishing flow saves draft on step change', () => {
    it('persists template state when navigating between steps', () => {
      mockLoad.mockReturnValueOnce({ title: 'Draft' })
      const { template, nextStep, saveDraft } = useTemplatePublishingStepper()

      template.value = { title: 'Updated Draft', description: 'WIP' }
      nextStep()
      saveDraft()

      expect(mockSave).toHaveBeenCalledWith({
        title: 'Updated Draft',
        description: 'WIP'
      })
    })
  })

  describe('publishing flow submits complete template', () => {
    it('accepts a template that passes all validations', () => {
      const template = makeCompleteTemplate()

      const allStepsValid = [1, 2, 3, 4, 5, 6, 7, 8].every(
        (step) => validateStep(step, template).valid
      )

      expect(allStepsValid).toBe(true)
      expect(isTemplateComplete(template)).toBe(true)
    })

    it('rejects submission when required metadata is absent', () => {
      const template: Partial<MarketplaceTemplate> = {
        description: 'Some description'
      }

      expect(isTemplateComplete(template)).toBe(false)
      expect(validateStep(2, template).valid).toBe(false)
    })
  })

  describe('publishing flow handles upload failures', () => {
    it('keeps draft valid even when asset URLs are missing after failure', () => {
      mockLoad.mockReturnValueOnce(null)
      const { template, saveDraft } = useTemplatePublishingStepper()

      template.value = {
        title: 'My Template',
        difficulty: 'beginner',
        license: 'mit',
        description: 'A description',
        thumbnail: '',
        workflowPreview: ''
      }

      saveDraft()
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'My Template' })
      )

      const step4 = validateStep(4, template.value)
      expect(step4.valid).toBe(false)
      expect(step4.errors).toContain('Thumbnail is required')
      expect(step4.errors).toContain('Workflow preview is required')
    })
  })
})
