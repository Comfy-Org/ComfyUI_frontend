import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTemplatePreviewAssets } from '@/composables/useTemplatePreviewAssets'
import type { MarketplaceTemplate } from '@/types/templateMarketplace'

import type { PublishingStepperContext } from '../types'
import { PublishingStepperKey } from '../types'
import StepTemplatePublishingPreview from './StepTemplatePublishingPreview.vue'

let blobCounter = 0
URL.createObjectURL = vi.fn(() => `blob:http://localhost/mock-${++blobCounter}`)
URL.revokeObjectURL = vi.fn()

vi.mock('@/utils/markdownRendererUtil', () => ({
  renderMarkdownToHtml: vi.fn((md: string) => `<p>${md}</p>`)
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      templatePublishing: {
        steps: {
          metadata: {
            titleLabel: 'Title',
            difficultyLabel: 'Difficulty',
            licenseLabel: 'License',
            categoryLabel: 'Categories',
            tagsLabel: 'Tags',
            requiredNodesLabel: 'Custom Nodes',
            difficulty: {
              beginner: 'Beginner',
              intermediate: 'Intermediate',
              advanced: 'Advanced'
            },
            license: {
              mit: 'MIT',
              ccBy: 'CC BY',
              ccBySa: 'CC BY-SA',
              ccByNc: 'CC BY-NC',
              apache: 'Apache',
              custom: 'Custom'
            },
            category: {
              imageGeneration: 'Image Generation',
              videoGeneration: 'Video Generation',
              audio: 'Audio',
              text: 'Text',
              threeD: '3D',
              upscaling: 'Upscaling',
              inpainting: 'Inpainting',
              controlNet: 'ControlNet',
              styleTransfer: 'Style Transfer',
              other: 'Other'
            }
          },
          preview: {
            sectionMetadata: 'Metadata',
            sectionDescription: 'Description',
            sectionPreviewAssets: 'Preview Assets',
            sectionCategoriesAndTags: 'Categories & Tags',
            thumbnailLabel: 'Thumbnail',
            comparisonLabel: 'Before & After',
            workflowPreviewLabel: 'Workflow Graph',
            videoPreviewLabel: 'Video Preview',
            galleryLabel: 'Gallery',
            notProvided: 'Not provided',
            noneDetected: 'None detected',
            correct: 'Correct',
            editStep: 'Edit'
          },
          previewGeneration: {
            beforeImageLabel: 'Before',
            afterImageLabel: 'After'
          }
        }
      }
    }
  }
})

function createContext(
  templateData: Partial<MarketplaceTemplate> = {}
): PublishingStepperContext {
  const template = ref<Partial<MarketplaceTemplate>>(templateData)
  const currentStep = ref(6)
  return {
    currentStep,
    totalSteps: 8,
    isFirstStep: computed(() => currentStep.value === 1),
    isLastStep: computed(() => currentStep.value === 8),
    canProceed: computed(() => false),
    template,
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    goToStep: vi.fn(),
    saveDraft: vi.fn(),
    setStepValid: vi.fn()
  }
}

function mountStep(ctx?: PublishingStepperContext) {
  const context = ctx ?? createContext()
  return {
    wrapper: mount(StepTemplatePublishingPreview, {
      global: {
        plugins: [i18n],
        provide: { [PublishingStepperKey as symbol]: context }
      }
    }),
    ctx: context
  }
}

describe('StepTemplatePublishingPreview', () => {
  beforeEach(() => {
    const assets = useTemplatePreviewAssets()
    assets.clearAll()
    vi.clearAllMocks()
    blobCounter = 0
  })

  it('renders all section headings', () => {
    const { wrapper } = mountStep()
    expect(wrapper.text()).toContain('Metadata')
    expect(wrapper.text()).toContain('Description')
    expect(wrapper.text()).toContain('Preview Assets')
    expect(wrapper.text()).toContain('Categories & Tags')
  })

  it('displays template title', () => {
    const ctx = createContext({ title: 'My Workflow' })
    const { wrapper } = mountStep(ctx)
    expect(wrapper.text()).toContain('My Workflow')
  })

  it('displays difficulty level', () => {
    const ctx = createContext({ difficulty: 'advanced' })
    const { wrapper } = mountStep(ctx)
    expect(wrapper.text()).toContain('Advanced')
  })

  it('displays license type', () => {
    const ctx = createContext({ license: 'mit' })
    const { wrapper } = mountStep(ctx)
    expect(wrapper.text()).toContain('MIT')
  })

  it('displays required custom nodes', () => {
    const ctx = createContext({
      requiredNodes: ['ComfyUI-Impact-Pack', 'ComfyUI-Manager']
    })
    const { wrapper } = mountStep(ctx)
    expect(wrapper.text()).toContain('ComfyUI-Impact-Pack')
    expect(wrapper.text()).toContain('ComfyUI-Manager')
  })

  it('shows "None detected" when no custom nodes', () => {
    const ctx = createContext({ requiredNodes: [] })
    const { wrapper } = mountStep(ctx)
    expect(wrapper.text()).toContain('None detected')
  })

  it('renders description as markdown HTML', () => {
    const ctx = createContext({ description: 'Hello **bold**' })
    const { wrapper } = mountStep(ctx)
    const prose = wrapper.find('[class*="prose"]')
    expect(prose.html()).toContain('<p>Hello **bold**</p>')
  })

  it('shows "Not provided" when description is empty', () => {
    const ctx = createContext({})
    const { wrapper } = mountStep(ctx)
    const text = wrapper.text()
    expect(text).toContain('Not provided')
  })

  it('displays categories as pills', () => {
    const ctx = createContext({
      categories: ['image-generation', 'controlnet']
    })
    const { wrapper } = mountStep(ctx)
    expect(wrapper.text()).toContain('Image Generation')
    expect(wrapper.text()).toContain('ControlNet')
  })

  it('displays tags as pills', () => {
    const ctx = createContext({ tags: ['flux', 'sdxl'] })
    const { wrapper } = mountStep(ctx)
    expect(wrapper.text()).toContain('flux')
    expect(wrapper.text()).toContain('sdxl')
  })

  it('displays thumbnail when asset is cached', () => {
    const assets = useTemplatePreviewAssets()
    assets.setThumbnail(new File([''], 'thumb.png'))

    const ctx = createContext({ thumbnail: 'blob:thumb' })
    const { wrapper } = mountStep(ctx)
    const imgs = wrapper.findAll('img')
    const thumbImg = imgs.find((img) =>
      img.attributes('alt')?.includes('thumb.png')
    )
    expect(thumbImg?.exists()).toBe(true)
  })

  it('displays gallery images when assets are cached', () => {
    const assets = useTemplatePreviewAssets()
    assets.addGalleryImage(new File([''], 'a.png'))
    assets.addGalleryImage(new File([''], 'b.png'))

    const ctx = createContext({
      gallery: [
        { type: 'image', url: 'blob:a', caption: 'a.png' },
        { type: 'image', url: 'blob:b', caption: 'b.png' }
      ]
    })
    const { wrapper } = mountStep(ctx)
    const imgs = wrapper.findAll('img')
    const galleryImgs = imgs.filter(
      (img) =>
        img.attributes('alt') === 'a.png' || img.attributes('alt') === 'b.png'
    )
    expect(galleryImgs).toHaveLength(2)
  })

  it('renders a "Correct" button', () => {
    const { wrapper } = mountStep()
    const correctBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Correct'))
    expect(correctBtn?.exists()).toBe(true)
  })

  it('calls nextStep when "Correct" button is clicked', async () => {
    const ctx = createContext()
    const { wrapper } = mountStep(ctx)
    const correctBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Correct'))
    await correctBtn!.trigger('click')
    expect(ctx.nextStep).toHaveBeenCalled()
  })

  it('navigates to metadata step when edit is clicked on metadata section', async () => {
    const ctx = createContext()
    const { wrapper } = mountStep(ctx)
    const editButtons = wrapper
      .findAll('button')
      .filter((b) => b.text().includes('Edit'))
    await editButtons[0].trigger('click')
    expect(ctx.goToStep).toHaveBeenCalledWith(2)
  })

  it('navigates to description step when edit is clicked on description section', async () => {
    const ctx = createContext()
    const { wrapper } = mountStep(ctx)
    const editButtons = wrapper
      .findAll('button')
      .filter((b) => b.text().includes('Edit'))
    await editButtons[1].trigger('click')
    expect(ctx.goToStep).toHaveBeenCalledWith(3)
  })

  it('navigates to preview generation step when edit is clicked on assets section', async () => {
    const ctx = createContext()
    const { wrapper } = mountStep(ctx)
    const editButtons = wrapper
      .findAll('button')
      .filter((b) => b.text().includes('Edit'))
    await editButtons[2].trigger('click')
    expect(ctx.goToStep).toHaveBeenCalledWith(4)
  })

  it('navigates to category step when edit is clicked on categories section', async () => {
    const ctx = createContext()
    const { wrapper } = mountStep(ctx)
    const editButtons = wrapper
      .findAll('button')
      .filter((b) => b.text().includes('Edit'))
    await editButtons[3].trigger('click')
    expect(ctx.goToStep).toHaveBeenCalledWith(5)
  })
})
