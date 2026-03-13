import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type {
  CategoriesResponse,
  CreateTemplateResponse,
  SubmitTemplateResponse
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

const { default: PublishTemplateWizard } =
  await import('@/platform/marketplace/components/PublishTemplateWizard.vue')

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      marketplace: {
        publishToMarketplace: 'Publish to Marketplace',
        steps: {
          details: 'Details',
          preview: 'Preview',
          submit: 'Submit'
        },
        title: 'Title',
        titlePlaceholder: 'Enter workflow title',
        description: 'Description',
        descriptionPlaceholder: 'Describe your workflow',
        shortDescription: 'Short Description',
        shortDescriptionPlaceholder: 'Brief summary',
        thumbnail: 'Thumbnail',
        categories: 'Categories',
        tags: 'Tags',
        difficulty: 'Difficulty',
        license: 'License',
        next: 'Next',
        back: 'Back',
        saveDraft: 'Save Draft',
        submitForReview: 'Submit for Review',
        submitting: 'Submitting...',
        submitted: 'Submitted for review!',
        uploadThumbnail: 'Upload Thumbnail',
        previewTitle: 'Preview',
        previewDescription:
          'This is how your template will appear in the marketplace.'
      },
      g: {
        upload: 'Upload',
        close: 'Close'
      }
    }
  }
})

function createWrapper(props = {}) {
  return mount(PublishTemplateWizard, {
    props: {
      onClose: vi.fn(),
      ...props
    },
    global: {
      plugins: [createPinia(), i18n],
      stubs: {
        teleport: true
      }
    }
  })
}

describe('PublishTemplateWizard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockService.getCategories.mockResolvedValue({
      categories: [
        { id: 'image-generation', name: 'Image Generation' },
        { id: 'video', name: 'Video' }
      ]
    } satisfies CategoriesResponse)
  })

  describe('step 1: details form', () => {
    it('renders the details step initially', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Details')
      expect(wrapper.find('[data-testid="step-details"]').exists()).toBe(true)
    })

    it('has title, description, and short description inputs', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('input[data-testid="input-title"]').exists()).toBe(
        true
      )
      expect(
        wrapper.find('textarea[data-testid="input-description"]').exists()
      ).toBe(true)
      expect(
        wrapper.find('input[data-testid="input-short-description"]').exists()
      ).toBe(true)
    })

    it('creates draft and advances to step 2 on Next', async () => {
      const createResponse: CreateTemplateResponse = {
        id: 'tpl_1',
        status: 'draft'
      }
      mockService.createTemplate.mockResolvedValue(createResponse)

      const wrapper = createWrapper()

      await wrapper
        .find('input[data-testid="input-title"]')
        .setValue('My Workflow')
      await wrapper
        .find('textarea[data-testid="input-description"]')
        .setValue('A great workflow')
      await wrapper
        .find('input[data-testid="input-short-description"]')
        .setValue('Great')

      await wrapper.find('[data-testid="btn-next"]').trigger('click')
      await vi.dynamicImportSettled()

      expect(mockService.createTemplate).toHaveBeenCalledWith({
        title: 'My Workflow',
        description: 'A great workflow',
        shortDescription: 'Great'
      })
    })
  })

  describe('step 2: preview', () => {
    async function advanceToStep2() {
      mockService.createTemplate.mockResolvedValue({
        id: 'tpl_1',
        status: 'draft'
      })

      const wrapper = createWrapper()
      await wrapper
        .find('input[data-testid="input-title"]')
        .setValue('My Workflow')
      await wrapper
        .find('textarea[data-testid="input-description"]')
        .setValue('Description')
      await wrapper
        .find('input[data-testid="input-short-description"]')
        .setValue('Short')

      await wrapper.find('[data-testid="btn-next"]').trigger('click')
      await vi.dynamicImportSettled()

      return wrapper
    }

    it('shows preview step with template details', async () => {
      const wrapper = await advanceToStep2()
      expect(wrapper.find('[data-testid="step-preview"]').exists()).toBe(true)
    })

    it('has a back button to return to step 1', async () => {
      const wrapper = await advanceToStep2()
      expect(wrapper.find('[data-testid="btn-back"]').exists()).toBe(true)
    })
  })

  describe('step 3: submit', () => {
    async function advanceToStep3() {
      mockService.createTemplate.mockResolvedValue({
        id: 'tpl_1',
        status: 'draft'
      })
      mockService.updateTemplate.mockResolvedValue({ id: 'tpl_1' })

      const wrapper = createWrapper()

      // Step 1
      await wrapper
        .find('input[data-testid="input-title"]')
        .setValue('My Workflow')
      await wrapper
        .find('textarea[data-testid="input-description"]')
        .setValue('Description')
      await wrapper
        .find('input[data-testid="input-short-description"]')
        .setValue('Short')
      await wrapper.find('[data-testid="btn-next"]').trigger('click')
      await vi.dynamicImportSettled()

      // Step 2 → Step 3
      await wrapper.find('[data-testid="btn-next"]').trigger('click')
      await vi.dynamicImportSettled()

      return wrapper
    }

    it('shows submit step', async () => {
      const wrapper = await advanceToStep3()
      expect(wrapper.find('[data-testid="step-submit"]').exists()).toBe(true)
    })

    it('calls submitTemplate on submit button click', async () => {
      const submitResponse: SubmitTemplateResponse = {
        status: 'pending_review'
      }
      mockService.submitTemplate.mockResolvedValue(submitResponse)

      const wrapper = await advanceToStep3()
      await wrapper.find('[data-testid="btn-submit"]').trigger('click')
      await vi.dynamicImportSettled()

      expect(mockService.submitTemplate).toHaveBeenCalledWith('tpl_1')
    })
  })
})
