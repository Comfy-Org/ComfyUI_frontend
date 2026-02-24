import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { createI18n } from 'vue-i18n'

import ShareWorkflowDialogContent from '@/platform/workflow/sharing/components/ShareWorkflowDialogContent.vue'

const mockWorkflowStore = reactive<{
  activeWorkflow: {
    path: string
    directory: string
    filename: string
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

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: vi.fn()
  })
}))

vi.mock('@formkit/auto-animate/vue', () => ({
  vAutoAnimate: {}
}))

const mockFlags = vi.hoisted(() => ({
  comfyHubUploadEnabled: false
}))
const mockEnsurePublishAccess = vi.hoisted(() => vi.fn())

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: mockFlags
  })
}))

vi.mock(
  '@/platform/workflow/sharing/composables/useComfyHubProfileGate',
  () => ({
    useComfyHubProfileGate: () => ({
      ensurePublishAccess: mockEnsurePublishAccess
    })
  })
)

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({
    saveWorkflow: vi.fn(),
    renameWorkflow: vi.fn()
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
    getPublishStatus: () =>
      Promise.resolve({
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
    getShareableAssets: () =>
      Promise.resolve({
        assets: mockShareServiceData.assets,
        models: mockShareServiceData.models
      })
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      shareWorkflow: {
        loadingTitle: 'Loading...',
        unsavedTitle: 'Save workflow first',
        unsavedDescription: 'You must save your workflow before sharing.',
        shareLinkTab: 'Share link',
        publishToHubTab: 'Publish to Hub',
        workflowNameLabel: 'Workflow name',
        saving: 'Saving...',
        saveButton: 'Save workflow',
        createLinkTitle: 'Create shareable link',
        createLinkButton: 'Create link',
        creatingLink: 'Creating link...',
        checkingAssets: 'Checking assets...',
        createLinkDescription:
          'When you create a link, you will share these assets',
        successTitle: 'Workflow successfully published!',
        successDescription: 'Anyone with this link...',
        hasChangesTitle: 'Share workflow',
        hasChangesDescription: 'You have made changes...',
        updateLinkButton: 'Update link',
        updatingLink: 'Updating link...',
        publishedOn: 'Published on {date}',
        mediaLabel: 'Media ({count})',
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
      directory: 'workflows',
      filename: 'test.json',
      isTemporary: false,
      isModified: false,
      lastModified: 1000
    }
    mockEnsurePublishAccess.mockResolvedValue(true)
    mockShareServiceData.assets = [{ name: 'test.png', thumbnailUrl: null }]
    mockShareServiceData.models = [{ name: 'model.safetensors' }]
  })

  function createWrapper() {
    return mount(ShareWorkflowDialogContent, {
      props: { onClose },
      global: {
        plugins: [i18n],
        stubs: {
          ComfyHubPublishWizardPanel: {
            data: () => ({
              publishName: ''
            }),
            template:
              '<section data-testid="publish-panel"><input v-model="publishName" data-testid="publish-panel-input" /></section>'
          },
          Input: {
            template: '<input v-bind="$attrs" />',
            methods: { focus() {}, select() {} }
          }
        }
      }
    })
  }

  it('renders in unsaved state when workflow is modified', async () => {
    mockWorkflowStore.activeWorkflow = {
      path: 'workflows/test.json',
      directory: 'workflows',
      filename: 'test.json',
      isTemporary: false,
      isModified: true,
      lastModified: 1000
    }
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.text()).toContain(
      'You must save your workflow before sharing.'
    )
    expect(wrapper.text()).toContain('Save workflow')
  })

  it('renders in unsaved state when workflow is temporary', async () => {
    mockWorkflowStore.activeWorkflow = {
      path: 'workflows/test.json',
      directory: 'workflows',
      filename: 'test.json',
      isTemporary: true,
      isModified: false,
      lastModified: 1000
    }
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.text()).toContain(
      'You must save your workflow before sharing.'
    )
  })

  it('renders share-link and publish tabs when comfy hub upload is enabled', async () => {
    mockFlags.comfyHubUploadEnabled = true
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.text()).toContain('Share link')
    expect(wrapper.text()).toContain('Publish to Hub')
    expect(wrapper.text()).toContain('Create link')
    const publishTabPanel = wrapper.find('[data-testid="publish-tab-panel"]')
    expect(publishTabPanel.exists()).toBe(true)
    expect(publishTabPanel.attributes('style') ?? '').toContain(
      'display: none;'
    )
    const publishPanel = wrapper.find('[data-testid="publish-panel"]')
    expect(publishPanel.exists()).toBe(true)
    mockFlags.comfyHubUploadEnabled = false
  })

  it('hides the publish tab when comfy hub upload is disabled', async () => {
    mockFlags.comfyHubUploadEnabled = false
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.text()).toContain('Share link')
    expect(wrapper.text()).not.toContain('Publish to Hub')
    expect(wrapper.find('[data-testid="publish-panel"]').exists()).toBe(false)
  })

  it('renders in unpublished state when workflow is saved', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.text()).toContain('Create link')
  })

  it('switches to publish tab when publish access is granted', async () => {
    mockFlags.comfyHubUploadEnabled = true
    mockEnsurePublishAccess.mockResolvedValueOnce(true)
    const wrapper = createWrapper()
    await flushPromises()

    const publishTab = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Publish to Hub'))

    expect(publishTab).toBeDefined()
    await publishTab!.trigger('click')
    await flushPromises()

    const publishTabPanel = wrapper.find('[data-testid="publish-tab-panel"]')
    expect(publishTabPanel.attributes('style')).toBeUndefined()
    expect(mockEnsurePublishAccess).toHaveBeenCalledOnce()
    expect(mockEnsurePublishAccess).toHaveBeenCalledWith()
    mockFlags.comfyHubUploadEnabled = false
  })

  it('keeps the share tab active when publish gate is cancelled', async () => {
    mockFlags.comfyHubUploadEnabled = true
    mockEnsurePublishAccess.mockResolvedValueOnce(false)
    const wrapper = createWrapper()
    await flushPromises()

    const publishTab = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Publish to Hub'))

    expect(publishTab).toBeDefined()
    await publishTab!.trigger('click')
    await flushPromises()

    const publishTabPanel = wrapper.find('[data-testid="publish-tab-panel"]')
    expect(publishTabPanel.attributes('style') ?? '').toContain(
      'display: none;'
    )
    expect(mockEnsurePublishAccess).toHaveBeenCalledOnce()
    expect(mockEnsurePublishAccess).toHaveBeenCalledWith()
    mockFlags.comfyHubUploadEnabled = false
  })

  it('keeps the share tab active while publish access is pending', async () => {
    mockFlags.comfyHubUploadEnabled = true
    let resolveGate: ((value: boolean) => void) | undefined
    mockEnsurePublishAccess.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveGate = resolve
      })
    )
    const wrapper = createWrapper()
    await flushPromises()

    const publishTab = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Publish to Hub'))

    expect(publishTab).toBeDefined()
    await publishTab!.trigger('click')
    await nextTick()

    const publishTabPanel = wrapper.find('[data-testid="publish-tab-panel"]')
    expect(publishTabPanel.attributes('style') ?? '').toContain(
      'display: none;'
    )

    resolveGate?.(true)
    await flushPromises()

    expect(publishTabPanel.attributes('style')).toBeUndefined()
    mockFlags.comfyHubUploadEnabled = false
  })

  it('ignores stale publish access results when user switches back to share tab', async () => {
    mockFlags.comfyHubUploadEnabled = true
    let resolveGate: ((value: boolean) => void) | undefined
    mockEnsurePublishAccess.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveGate = resolve
      })
    )
    const wrapper = createWrapper()
    await flushPromises()

    const publishTab = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Publish to Hub'))
    const shareTab = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Share link'))

    expect(publishTab).toBeDefined()
    expect(shareTab).toBeDefined()

    await publishTab!.trigger('click')
    await nextTick()

    await shareTab!.trigger('click')
    await nextTick()

    resolveGate?.(true)
    await flushPromises()

    const publishTabPanel = wrapper.find('[data-testid="publish-tab-panel"]')
    expect(publishTabPanel.attributes('style') ?? '').toContain(
      'display: none;'
    )
    mockFlags.comfyHubUploadEnabled = false
  })

  it('keeps the share tab active when publish access check fails', async () => {
    mockFlags.comfyHubUploadEnabled = true
    mockEnsurePublishAccess.mockRejectedValueOnce(new Error('Network error'))
    const wrapper = createWrapper()
    await flushPromises()

    const publishTab = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Publish to Hub'))

    expect(publishTab).toBeDefined()
    await publishTab!.trigger('click')
    await flushPromises()

    const publishTabPanel = wrapper.find('[data-testid="publish-tab-panel"]')
    expect(publishTabPanel.attributes('style') ?? '').toContain(
      'display: none;'
    )
    expect(mockEnsurePublishAccess).toHaveBeenCalledOnce()
    expect(mockEnsurePublishAccess).toHaveBeenCalledWith()
    mockFlags.comfyHubUploadEnabled = false
  })

  it('disables publish button when acknowledgment is unchecked', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const publishButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Create link'))

    expect(publishButton?.attributes('disabled')).toBeDefined()
  })

  it('enables publish button when acknowledgment is checked', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    await nextTick()

    const publishButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Create link'))

    expect(publishButton?.attributes('disabled')).toBeUndefined()
  })

  it('enables publish button without acknowledgment when no assets or models', async () => {
    mockShareServiceData.assets = []
    mockShareServiceData.models = []
    const wrapper = createWrapper()
    await flushPromises()

    const checkbox = wrapper.find('input[type="checkbox"]')
    expect(checkbox.exists()).toBe(false)

    const publishButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Create link'))

    expect(publishButton?.attributes('disabled')).toBeUndefined()
  })

  it('calls onClose when close button is clicked', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const closeButton = wrapper.find('[aria-label="Close"]')
    await closeButton.trigger('click')

    expect(onClose).toHaveBeenCalled()
  })

  it('preserves share-link acknowledgment state across tab switches', async () => {
    mockFlags.comfyHubUploadEnabled = true
    const wrapper = createWrapper()
    await flushPromises()

    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    await nextTick()

    const publishButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Create link'))

    expect(publishButton?.attributes('disabled')).toBeUndefined()

    const publishTab = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Publish to Hub'))

    expect(publishTab).toBeDefined()
    await publishTab!.trigger('click')
    await flushPromises()

    const publishTabPanel = wrapper.find('[data-testid="publish-tab-panel"]')
    expect(publishTabPanel.attributes('style')).toBeUndefined()

    const publishPanel = wrapper.find('[data-testid="publish-panel"]')
    expect(publishPanel.exists()).toBe(true)

    const publishPanelInput = wrapper.find(
      '[data-testid="publish-panel-input"]'
    )
    await publishPanelInput.setValue('In-progress publish draft')

    const shareTab = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Share link'))

    expect(shareTab).toBeDefined()
    await shareTab!.trigger('click')

    const createLinkButtonAfterSwitch = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Create link'))

    expect(createLinkButtonAfterSwitch?.attributes('disabled')).toBeUndefined()

    const publishPanelAfterShareSwitch = wrapper.find(
      '[data-testid="publish-panel"]'
    )
    expect(publishPanelAfterShareSwitch.exists()).toBe(true)
    expect(publishTabPanel.attributes('style') ?? '').toContain(
      'display: none;'
    )

    await publishTab!.trigger('click')
    expect(
      (
        wrapper.find('[data-testid="publish-panel-input"]')
          .element as HTMLInputElement
      ).value
    ).toBe('In-progress publish draft')
    mockFlags.comfyHubUploadEnabled = false
  })
})
