import { flushPromises, mount } from '@vue/test-utils'
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

const mockCreateGraphThumbnail = vi.hoisted(() => vi.fn())
vi.mock('@/renderer/core/thumbnail/graphThumbnailRenderer', () => ({
  createGraphThumbnail: () => mockCreateGraphThumbnail()
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
        requiredFieldTooltip:
          'You must provide your own copy for this field. Placeholder text cannot be used.',
        difficulty: 'Difficulty',
        difficultyTooltip:
          'Consider the number of inputs users must configure and how difficult it is for a relatively experienced user to get the workflow running.',
        difficultyLevels: {
          beginner: 'Beginner',
          intermediate: 'Intermediate',
          advanced: 'Advanced'
        },
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
        dropThumbnailHere: 'Drop image here',
        thumbnailUploadError: 'Please drop an image file',
        uploadProgress: 'Uploading thumbnail: {percent}%',
        uploadComplete: 'Thumbnail uploaded',
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

    it('has difficulty dropdown', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('[data-testid="input-difficulty"]').exists()).toBe(
        true
      )
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
        difficulty: 'beginner',
        tags: []
      })
      expect(wrapper.find('[data-testid="step-submit"]').exists()).toBe(true)
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
        difficulty: 'beginner',
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

    it('shows drop zone on step 1', () => {
      const wrapper = createWrapper()
      expect(
        wrapper.find('[data-testid="preview-thumbnail-placeholder"]').exists()
      ).toBe(true)
      expect(wrapper.text()).toContain('Drop image here')
    })

    it('creates draft and uploads thumbnail immediately when image dropped', async () => {
      vi.stubGlobal(
        'FileReader',
        class {
          onload: ((e: { target: { result: string } }) => void) | null = null
          onerror: ((e: ProgressEvent) => void) | null = null
          readAsDataURL() {
            this.onerror?.(new ProgressEvent('error'))
          }
        }
      )
      mockService.createTemplate.mockResolvedValue({
        id: 'tpl_1',
        status: 'draft'
      })
      mockService.uploadTemplateMedia.mockResolvedValue({
        url: 'https://cdn.example.com/thumb.png',
        type: 'image/png'
      })
      mockService.updateTemplate.mockResolvedValue({ id: 'tpl_1' })

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

      const placeholder = wrapper.find(
        '[data-testid="preview-thumbnail-placeholder"]'
      )
      const file = new File(['image data'], 'thumb.png', {
        type: 'image/png'
      })
      const fileList = { 0: file, length: 1, item: (i: number) => [file][i] }
      await placeholder.trigger('drop', {
        dataTransfer: { files: fileList }
      })
      await flushPromises()
      await flushPromises()

      expect(
        wrapper.find('[data-testid="preview-thumbnail-placeholder"]').exists()
      ).toBe(false)
      expect(mockService.createTemplate).toHaveBeenCalled()
      expect(mockService.uploadTemplateMedia).toHaveBeenCalledWith(
        'tpl_1',
        expect.any(File),
        expect.objectContaining({ onProgress: expect.any(Function) })
      )
      vi.unstubAllGlobals()
    })

    it('uploads thumbnail immediately when image dropped with existing draft', async () => {
      vi.stubGlobal(
        'FileReader',
        class {
          onload: ((e: { target: { result: string } }) => void) | null = null
          onerror: ((e: ProgressEvent) => void) | null = null
          readAsDataURL() {
            this.onerror?.(new ProgressEvent('error'))
          }
        }
      )
      mockService.updateTemplate.mockResolvedValue({ id: 'tpl_99' })
      mockService.uploadTemplateMedia.mockResolvedValue({
        url: 'https://cdn.example.com/thumb.png',
        type: 'image/png'
      })

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
        }
      }
      const wrapper = createWrapper({ initialTemplate: template })
      await vi.dynamicImportSettled()
      await wrapper.vm.$nextTick()

      const placeholder = wrapper.find(
        '[data-testid="preview-thumbnail-placeholder"]'
      )
      const file = new File(['image data'], 'thumb.png', {
        type: 'image/png'
      })
      const fileList = { 0: file, length: 1, item: (i: number) => [file][i] }
      await placeholder.trigger('drop', {
        dataTransfer: { files: fileList }
      })
      await flushPromises()
      await flushPromises()

      expect(mockService.uploadTemplateMedia).toHaveBeenCalledWith(
        'tpl_99',
        expect.any(File),
        expect.objectContaining({ onProgress: expect.any(Function) })
      )
      expect(
        wrapper.find('[data-testid="preview-thumbnail-placeholder"]').exists()
      ).toBe(false)
      vi.unstubAllGlobals()
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

    it('uploads workflow preview from minimap and saves workflowPreview before submit', async () => {
      mockCreateGraphThumbnail.mockReturnValue(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      )
      mockService.uploadTemplateMedia.mockResolvedValue({
        url: '/api/marketplace/media/tpl_1/previews%2Fworkflow-preview.png',
        type: 'image/png'
      })
      mockService.updateTemplate.mockResolvedValue({ id: 'tpl_1' })
      mockService.submitTemplate.mockResolvedValue({
        status: 'pending_review'
      })

      const wrapper = await advanceToSubmitStep()
      await wrapper.find('[data-testid="btn-submit"]').trigger('click')
      await flushPromises()

      expect(mockService.uploadTemplateMedia).toHaveBeenCalledWith(
        'tpl_1',
        expect.any(File),
        { type: 'preview' }
      )
      expect(mockService.updateTemplate).toHaveBeenCalledWith(
        'tpl_1',
        expect.objectContaining({
          workflowPreview:
            '/api/marketplace/media/tpl_1/previews%2Fworkflow-preview.png'
        })
      )
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
