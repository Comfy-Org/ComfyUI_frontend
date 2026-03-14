import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type {
  CategoriesResponse,
  CreateTemplateResponse,
  MarketplaceTemplate,
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
        tagsPlaceholder: 'Add tags...',
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
          'This is how your template will appear in the marketplace.',
        noThumbnailYet: 'No thumbnail yet',
        licenseTypes: {
          'cc-by': 'CC BY',
          'cc-by-sa': 'CC BY-SA',
          'cc-by-nc': 'CC BY-NC',
          mit: 'MIT',
          apache: 'Apache 2.0',
          custom: 'Custom'
        },
        done: 'Done'
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

    it('has license dropdown', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('[data-testid="input-license"]').exists()).toBe(true)
    })

    it('has tags input', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('[data-testid="input-tags"]').exists()).toBe(true)
    })

    it('disables Next when form has only default placeholder text', () => {
      const wrapper = createWrapper()
      expect(
        (wrapper.find('[data-testid="btn-next"]').element as HTMLButtonElement)
          .disabled
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
        shortDescription: 'Great',
        license: 'mit',
        tags: []
      })
    })

    it('includes tags in createDraft payload when tags are added', async () => {
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
        .setValue('A great workflow')
      await wrapper
        .find('input[data-testid="input-short-description"]')
        .setValue('Great')

      const tagInput = wrapper.findComponent({
        name: 'TagInputWithAutocomplete'
      })
      await tagInput.vm.$emit('update:modelValue', ['Image', 'Video'])
      await wrapper.find('[data-testid="btn-next"]').trigger('click')
      await vi.dynamicImportSettled()

      expect(mockService.createTemplate).toHaveBeenCalledWith({
        title: 'My Workflow',
        description: 'A great workflow',
        shortDescription: 'Great',
        license: 'mit',
        tags: ['Image', 'Video']
      })
    })
  })

  describe('step 1: details + preview split view', () => {
    it('shows preview card with template details that update with form', async () => {
      const wrapper = createWrapper()
      expect(wrapper.find('[data-testid="step-details"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="preview-card"]').exists()).toBe(true)

      await wrapper
        .find('input[data-testid="input-title"]')
        .setValue('My Workflow')
      await wrapper
        .find('textarea[data-testid="input-description"]')
        .setValue('Description')
      await wrapper
        .find('input[data-testid="input-short-description"]')
        .setValue('Short')

      expect(wrapper.text()).toContain('My Workflow')
      expect(wrapper.text()).toContain('Short')
      expect(wrapper.text()).toContain('Description')
    })

    it('shows tags as SquareChips on preview card when form has tags', async () => {
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

      const tagInput = wrapper.findComponent({
        name: 'TagInputWithAutocomplete'
      })
      await tagInput.vm.$emit('update:modelValue', ['Image', 'Video'])
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Image')
      expect(wrapper.text()).toContain('Video')
    })

    it('shows thumbnail placeholder when initialTemplate has no thumbnail', () => {
      const wrapper = createWrapper()
      expect(
        wrapper.find('[data-testid="preview-thumbnail-placeholder"]').exists()
      ).toBe(true)
      expect(wrapper.text()).toContain('No thumbnail yet')
    })

    it('shows thumbnail (not placeholder) when initialTemplate has thumbnail', async () => {
      const template: MarketplaceTemplate = {
        id: 'tpl_99',
        title: 'Existing',
        description: 'Desc',
        shortDescription: 'Short',
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
        thumbnail: 'https://example.com/thumb.png',
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
        }
      }
      const wrapper = createWrapper({ initialTemplate: template })
      await vi.dynamicImportSettled()
      await wrapper.vm.$nextTick()

      expect(
        wrapper.find('[data-testid="preview-thumbnail-placeholder"]').exists()
      ).toBe(false)
    })

    it('has back button on submit step to return to details', async () => {
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

      expect(wrapper.find('[data-testid="btn-back"]').exists()).toBe(true)
    })
  })

  describe('step 2: submit', () => {
    async function advanceToSubmitStep() {
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

    it('shows submit step', async () => {
      const wrapper = await advanceToSubmitStep()
      expect(wrapper.find('[data-testid="step-submit"]').exists()).toBe(true)
    })

    it('calls submitTemplate on submit button click', async () => {
      const submitResponse: SubmitTemplateResponse = {
        status: 'pending_review'
      }
      mockService.submitTemplate.mockResolvedValue(submitResponse)

      const wrapper = await advanceToSubmitStep()
      await wrapper.find('[data-testid="btn-submit"]').trigger('click')
      await vi.dynamicImportSettled()

      expect(mockService.submitTemplate).toHaveBeenCalledWith('tpl_1')
    })
  })

  describe('edit mode (initialTemplate)', () => {
    function makeSeedTemplate(
      overrides: Partial<MarketplaceTemplate>
    ): MarketplaceTemplate {
      return {
        id: 'tpl_99',
        title: 'Existing',
        description: 'Desc',
        shortDescription: 'Short',
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

    it('populates form.tags from initialTemplate', async () => {
      const template = makeSeedTemplate({
        tags: ['Image', 'Portrait']
      })
      const wrapper = createWrapper({ initialTemplate: template })
      await vi.dynamicImportSettled()
      await wrapper.vm.$nextTick()

      const tagInput = wrapper.findComponent({
        name: 'TagInputWithAutocomplete'
      })
      expect(tagInput.props('modelValue')).toEqual(['Image', 'Portrait'])
    })

    it('pre-fills form when initialTemplate prop is provided', async () => {
      const template = makeSeedTemplate({
        id: 'tpl_99',
        title: 'Existing',
        description: 'Desc',
        shortDescription: 'Short'
      })
      const wrapper = createWrapper({ initialTemplate: template })
      await vi.dynamicImportSettled()
      await wrapper.vm.$nextTick()

      expect(
        (
          wrapper.find('input[data-testid="input-title"]')
            .element as HTMLInputElement
        ).value
      ).toBe('Existing')
      expect(
        (
          wrapper.find('textarea[data-testid="input-description"]')
            .element as HTMLTextAreaElement
        ).value
      ).toBe('Desc')
      expect(
        (
          wrapper.find('input[data-testid="input-short-description"]')
            .element as HTMLInputElement
        ).value
      ).toBe('Short')
    })

    it('calls updateTemplate (not createTemplate) when Next clicked with initialTemplate', async () => {
      const template = makeSeedTemplate({
        id: 'tpl_99',
        title: 'Existing',
        description: 'Desc',
        shortDescription: 'Short'
      })
      mockService.updateTemplate.mockResolvedValue({ id: 'tpl_99' })

      const wrapper = createWrapper({ initialTemplate: template })
      await vi.dynamicImportSettled()
      await wrapper.vm.$nextTick()

      await wrapper.find('[data-testid="btn-next"]').trigger('click')
      await vi.dynamicImportSettled()

      expect(mockService.updateTemplate).toHaveBeenCalledWith(
        'tpl_99',
        expect.objectContaining({
          title: 'Existing',
          description: 'Desc',
          shortDescription: 'Short',
          tags: []
        })
      )
      expect(mockService.createTemplate).not.toHaveBeenCalled()
    })

    it('advances to submit step on Next when editing existing draft', async () => {
      const template = makeSeedTemplate({
        id: 'tpl_99',
        title: 'Existing',
        description: 'Desc',
        shortDescription: 'Short'
      })
      mockService.updateTemplate.mockResolvedValue({ id: 'tpl_99' })

      const wrapper = createWrapper({ initialTemplate: template })
      await vi.dynamicImportSettled()
      await wrapper.vm.$nextTick()

      await wrapper.find('[data-testid="btn-next"]').trigger('click')
      await vi.dynamicImportSettled()

      expect(wrapper.find('[data-testid="step-submit"]').exists()).toBe(true)
    })

    it('shows Done (not Submit) on submit step when editing pending_review template', async () => {
      const template = makeSeedTemplate({
        id: 'tpl_99',
        title: 'Existing',
        description: 'Desc',
        shortDescription: 'Short',
        status: 'pending_review'
      })
      mockService.updateTemplate.mockResolvedValue({ id: 'tpl_99' })

      const wrapper = createWrapper({ initialTemplate: template })
      await vi.dynamicImportSettled()
      await wrapper.vm.$nextTick()

      await wrapper.find('[data-testid="btn-next"]').trigger('click')
      await vi.dynamicImportSettled()

      expect(wrapper.find('[data-testid="btn-done"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="btn-submit"]').exists()).toBe(false)
    })
  })
})
