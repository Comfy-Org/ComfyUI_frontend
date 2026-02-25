import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTemplatePreviewAssets } from '@/composables/useTemplatePreviewAssets'
import type { MarketplaceTemplate } from '@/types/templateMarketplace'

import type { PublishingStepperContext } from '../types'
import { PublishingStepperKey } from '../types'
import StepTemplatePublishingPreviewGeneration from './StepTemplatePublishingPreviewGeneration.vue'

const { mockCreateScreenshot, mockRootGraph } = vi.hoisted(() => ({
  mockCreateScreenshot: vi.fn(),
  mockRootGraph: { _nodes: [{ pos: [0, 0], size: [200, 100] }] }
}))

vi.mock('@/renderer/core/thumbnail/templateScreenshotRenderer', () => ({
  createTemplateScreenshot: (...args: unknown[]) =>
    mockCreateScreenshot(...args)
}))

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: mockRootGraph }
}))

let blobCounter = 0
URL.createObjectURL = vi.fn(() => `blob:http://localhost/mock-${++blobCounter}`)
URL.revokeObjectURL = vi.fn()

class MockXMLHttpRequest {
  open = vi.fn()
  send = vi.fn()
  upload = { addEventListener: vi.fn() }
  addEventListener = vi.fn()
  status = 200
  responseText = '{}'
}
vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest)

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    watchDebounced: vi.fn((source: unknown, cb: unknown, opts: unknown) => {
      const typedActual = actual as {
        watchDebounced: (...args: unknown[]) => unknown
      }
      return typedActual.watchDebounced(source, cb, {
        ...(opts as object),
        debounce: 0
      })
    })
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      templatePublishing: {
        steps: {
          previewGeneration: {
            thumbnailLabel: 'Thumbnail',
            thumbnailHint: 'Primary image shown in marketplace listings',
            comparisonLabel: 'Before & After Comparison',
            comparisonHint: 'Show what the workflow transforms',
            beforeImageLabel: 'Before',
            afterImageLabel: 'After',
            workflowPreviewLabel: 'Workflow Graph',
            workflowPreviewHint: 'Screenshot of the workflow graph layout',
            videoPreviewLabel: 'Video Preview',
            videoPreviewHint: 'Optional short video demonstrating the workflow',
            galleryLabel: 'Example Gallery',
            galleryHint: 'Up to {max} example output images',
            uploadPrompt: 'Click to upload',
            removeFile: 'Remove',
            uploadingProgress: 'Uploading… {percent}%'
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
  const currentStep = ref(4)
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
    wrapper: mount(StepTemplatePublishingPreviewGeneration, {
      global: {
        plugins: [i18n],
        provide: { [PublishingStepperKey as symbol]: context }
      }
    }),
    ctx: context
  }
}

describe('StepTemplatePublishingPreviewGeneration', () => {
  beforeEach(() => {
    const assets = useTemplatePreviewAssets()
    assets.clearAll()
    vi.clearAllMocks()
    blobCounter = 0
  })

  it('renders all upload sections', () => {
    const { wrapper } = mountStep()

    expect(wrapper.text()).toContain('Thumbnail')
    expect(wrapper.text()).toContain('Before & After Comparison')
    expect(wrapper.text()).toContain('Workflow Graph')
    expect(wrapper.text()).toContain('Video Preview')
    expect(wrapper.text()).toContain('Example Gallery')
  })

  it('renders before and after upload zones side by side', () => {
    const { wrapper } = mountStep()

    expect(wrapper.text()).toContain('Before')
    expect(wrapper.text()).toContain('After')
  })

  it('updates template thumbnail on upload', () => {
    const ctx = createContext()
    const { wrapper } = mountStep(ctx)

    const uploadZones = wrapper.findAllComponents({
      name: 'TemplateAssetUploadZone'
    })
    uploadZones[0].vm.$emit('upload', new File([''], 'thumb.png'))

    expect(ctx.template.value.thumbnail).toMatch(/^blob:/)
  })

  it('clears template thumbnail on remove', () => {
    const assets = useTemplatePreviewAssets()
    assets.setThumbnail(new File([''], 'thumb.png'))

    const ctx = createContext({ thumbnail: 'blob:old' })
    const { wrapper } = mountStep(ctx)

    const uploadZones = wrapper.findAllComponents({
      name: 'TemplateAssetUploadZone'
    })
    uploadZones[0].vm.$emit('remove')

    expect(ctx.template.value.thumbnail).toBe('')
    expect(assets.thumbnail.value).toBeNull()
  })

  it('updates template beforeImage on upload', () => {
    const ctx = createContext()
    const { wrapper } = mountStep(ctx)

    const uploadZones = wrapper.findAllComponents({
      name: 'TemplateAssetUploadZone'
    })
    uploadZones[1].vm.$emit('upload', new File([''], 'before.png'))

    expect(ctx.template.value.beforeImage).toMatch(/^blob:/)
  })

  it('updates template afterImage on upload', () => {
    const ctx = createContext()
    const { wrapper } = mountStep(ctx)

    const uploadZones = wrapper.findAllComponents({
      name: 'TemplateAssetUploadZone'
    })
    uploadZones[2].vm.$emit('upload', new File([''], 'after.png'))

    expect(ctx.template.value.afterImage).toMatch(/^blob:/)
  })

  it('updates template workflowPreview on upload', () => {
    const ctx = createContext()
    const { wrapper } = mountStep(ctx)

    const uploadZones = wrapper.findAllComponents({
      name: 'TemplateAssetUploadZone'
    })
    uploadZones[3].vm.$emit('upload', new File([''], 'graph.png'))

    expect(ctx.template.value.workflowPreview).toMatch(/^blob:/)
  })

  it('updates template videoPreview on upload', () => {
    const ctx = createContext()
    const { wrapper } = mountStep(ctx)

    const uploadZones = wrapper.findAllComponents({
      name: 'TemplateAssetUploadZone'
    })
    uploadZones[4].vm.$emit(
      'upload',
      new File([''], 'demo.mp4', { type: 'video/mp4' })
    )

    expect(ctx.template.value.videoPreview).toMatch(/^blob:/)
  })

  it('shows the gallery add button when gallery is empty', () => {
    const { wrapper } = mountStep()

    const addButton = wrapper.find('[role="button"]')
    expect(addButton.exists()).toBe(true)
  })

  it('adds gallery images to the template on upload', async () => {
    const ctx = createContext({ gallery: [] })
    const { wrapper } = mountStep(ctx)

    const galleryInput = wrapper.find('input[multiple]')
    const file = new File([''], 'output.png', { type: 'image/png' })
    Object.defineProperty(galleryInput.element, 'files', { value: [file] })
    await galleryInput.trigger('change')

    expect(ctx.template.value.gallery).toHaveLength(1)
    expect(ctx.template.value.gallery![0].url).toMatch(/^blob:/)
    expect(ctx.template.value.gallery![0].caption).toBe('output.png')
  })

  it('removes a gallery image by index', async () => {
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

    const removeButtons = wrapper.findAll('button[aria-label="Remove"]')
    await removeButtons[0].trigger('click')

    expect(ctx.template.value.gallery).toHaveLength(1)
    expect(ctx.template.value.gallery![0].caption).toBe('b.png')
  })

  it('auto-generates workflow preview from the graph on mount', async () => {
    const screenshotBlob = new Blob(['png'], { type: 'image/png' })
    mockCreateScreenshot.mockResolvedValue(screenshotBlob)

    const ctx = createContext()
    mountStep(ctx)
    await flushPromises()

    expect(mockCreateScreenshot).toHaveBeenCalledWith(mockRootGraph)
    expect(ctx.template.value.workflowPreview).toMatch(/^blob:/)
  })

  it('skips auto-generation when workflow preview already exists', async () => {
    mockCreateScreenshot.mockResolvedValue(new Blob(['png']))
    const assets = useTemplatePreviewAssets()
    assets.setWorkflowPreview(new File([''], 'existing.png'))

    mountStep(createContext({ workflowPreview: 'blob:existing' }))
    await flushPromises()

    expect(mockCreateScreenshot).not.toHaveBeenCalled()
  })

  it('skips auto-generation when screenshot returns null', async () => {
    mockCreateScreenshot.mockResolvedValue(null)

    const ctx = createContext()
    mountStep(ctx)
    await flushPromises()

    expect(ctx.template.value.workflowPreview).toBeUndefined()
  })
})
