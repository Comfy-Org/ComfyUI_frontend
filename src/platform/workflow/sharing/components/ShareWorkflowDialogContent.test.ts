import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { createI18n } from 'vue-i18n'

import ShareWorkflowDialogContent from '@/platform/workflow/sharing/components/ShareWorkflowDialogContent.vue'

const mockWorkflowStore = reactive<{
  activeWorkflow: {
    path: string
    isTemporary: boolean
    isModified: boolean
    lastModified: number
  } | null
}>({
  activeWorkflow: null
})

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => mockWorkflowStore
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({
    saveWorkflow: vi.fn(),
    saveWorkflowAs: vi.fn()
  })
}))

const mockShareServiceData = vi.hoisted(() => ({
  assets: [{ name: 'test.png', thumbnailUrl: null }] as {
    name: string
    thumbnailUrl: string | null
  }[],
  models: [{ name: 'model.safetensors' }] as { name: string }[]
}))

vi.mock('@/platform/workflow/sharing/services/workflowShareService', () => ({
  useWorkflowShareService: () => ({
    getPublishStatus: () => ({
      isPublished: false,
      shareUrl: null,
      publishedAt: null,
      hasChangesSincePublish: false
    }),
    publishWorkflow: () =>
      Promise.resolve({
        shareUrl: 'https://comfy.org/shared/test-123',
        publishedAt: new Date('2026-01-15')
      }),
    getWorkflowAssets: () => mockShareServiceData.assets,
    getWorkflowModels: () => mockShareServiceData.models
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      shareWorkflow: {
        unsavedTitle: 'Save workflow first',
        unsavedDescription: 'You must save your workflow before sharing.',
        saveButton: 'Save workflow',
        publishTitle: 'Publish workflow',
        publishDescription: 'Publishing this workflow...',
        publishButton: 'Publish workflow',
        publishing: 'Publishing...',
        successTitle: 'Workflow successfully published!',
        successDescription: 'Anyone with this link...',
        hasChangesTitle: 'Share workflow',
        hasChangesDescription: 'You have made changes...',
        republishButton: 'Publish updates',
        republishing: 'Publishing...',
        publishedOn: 'Published on {date}',
        copyLink: 'Copy',
        linkCopied: 'Copied!',
        assetWarningTitle: 'This workflow includes...',
        assetsLabel: 'Assets ({count})',
        modelsLabel: 'Models ({count})',
        acknowledgeCheckbox: 'I understand these assets...',
        comfyHubTitle: 'Upload to ComfyHub',
        comfyHubDescription: 'Share your workflow...',
        comfyHubButton: 'Upload to ComfyHub'
      }
    }
  }
})

describe('ShareWorkflowDialogContent', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkflowStore.activeWorkflow = {
      path: 'workflows/test.json',
      isTemporary: false,
      isModified: false,
      lastModified: 1000
    }
    mockShareServiceData.assets = [{ name: 'test.png', thumbnailUrl: null }]
    mockShareServiceData.models = [{ name: 'model.safetensors' }]
  })

  function createWrapper() {
    return mount(ShareWorkflowDialogContent, {
      props: { onClose },
      global: {
        plugins: [i18n]
      }
    })
  }

  it('renders in unsaved state when workflow is modified', () => {
    mockWorkflowStore.activeWorkflow = {
      path: 'workflows/test.json',
      isTemporary: false,
      isModified: true,
      lastModified: 1000
    }
    const wrapper = createWrapper()

    expect(wrapper.text()).toContain('Save workflow first')
    expect(wrapper.text()).toContain('Save workflow')
  })

  it('renders in unsaved state when workflow is temporary', () => {
    mockWorkflowStore.activeWorkflow = {
      path: 'workflows/test.json',
      isTemporary: true,
      isModified: false,
      lastModified: 1000
    }
    const wrapper = createWrapper()

    expect(wrapper.text()).toContain('Save workflow first')
  })

  it('renders in unpublished state when workflow is saved', async () => {
    const wrapper = createWrapper()
    await nextTick()

    expect(wrapper.text()).toContain('Publish workflow')
  })

  it('disables publish button when acknowledgment is unchecked', async () => {
    const wrapper = createWrapper()
    await nextTick()

    const publishButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Publish workflow'))

    expect(publishButton?.attributes('disabled')).toBeDefined()
  })

  it('enables publish button when acknowledgment is checked', async () => {
    const wrapper = createWrapper()
    await nextTick()

    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    await nextTick()

    const publishButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Publish workflow'))

    expect(publishButton?.attributes('disabled')).toBeUndefined()
  })

  it('enables publish button without acknowledgment when no assets or models', async () => {
    mockShareServiceData.assets = []
    mockShareServiceData.models = []
    const wrapper = createWrapper()
    await nextTick()

    const checkbox = wrapper.find('input[type="checkbox"]')
    expect(checkbox.exists()).toBe(false)

    const publishButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Publish workflow'))

    expect(publishButton?.attributes('disabled')).toBeUndefined()
  })

  it('calls onClose when close button is clicked', async () => {
    const wrapper = createWrapper()

    const closeButton = wrapper.find('[aria-label="Close"]')
    await closeButton.trigger('click')

    expect(onClose).toHaveBeenCalled()
  })

  it('renders ComfyHub upload section', () => {
    const wrapper = createWrapper()

    expect(wrapper.text()).toContain('Upload to ComfyHub')
  })
})
