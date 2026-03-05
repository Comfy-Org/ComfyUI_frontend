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

const mockToast = vi.hoisted(() => ({ add: vi.fn() }))

vi.mock('primevue/usetoast', () => ({
  useToast: () => mockToast
}))

vi.mock('@formkit/auto-animate/vue', () => ({
  vAutoAnimate: {}
}))

const mockFlags = vi.hoisted(() => ({
  comfyHubUploadEnabled: false,
  comfyHubProfileGateEnabled: true
}))

const mockShowPublishDialog = vi.hoisted(() => vi.fn())

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: mockFlags
  })
}))

vi.mock(
  '@/platform/workflow/sharing/composables/useComfyHubPublishDialog',
  () => ({
    useComfyHubPublishDialog: () => ({
      show: mockShowPublishDialog
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
  items: [
    {
      id: 'test.png',
      name: 'test.png',
      preview_url: '',
      storage_url: '',
      model: false,
      public: false,
      in_library: false
    },
    {
      id: 'model.safetensors',
      name: 'model.safetensors',
      preview_url: '',
      storage_url: '',
      model: true,
      public: false,
      in_library: false
    }
  ]
}))

const mockGetPublishStatus = vi.hoisted(() => vi.fn())
const mockPublishWorkflow = vi.hoisted(() => vi.fn())
const mockGetShareableAssets = vi.hoisted(() => vi.fn())

vi.mock('@/platform/workflow/sharing/services/workflowShareService', () => ({
  useWorkflowShareService: () => ({
    getPublishStatus: mockGetPublishStatus,
    publishWorkflow: mockPublishWorkflow,
    getShareableAssets: mockGetShareableAssets
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close', error: 'Error' },
      shareWorkflow: {
        unsavedDescription: 'You must save your workflow before sharing.',
        shareLinkTab: 'Share',
        publishToHubTab: 'Publish',
        workflowNameLabel: 'Workflow name',
        saving: 'Saving...',
        saveButton: 'Save workflow',
        createLinkButton: 'Create link',
        creatingLink: 'Creating link...',
        checkingAssets: 'Checking assets...',
        successDescription: 'Anyone with this link...',
        hasChangesDescription: 'You have made changes...',
        updateLinkButton: 'Update link',
        updatingLink: 'Updating link...',
        publishedOn: 'Published on {date}',
        mediaLabel: '{count} Media File | {count} Media Files',
        modelsLabel: '{count} Model | {count} Models',
        acknowledgeCheckbox: 'I understand these assets...',
        loadFailed: 'Failed to load publish status'
      },
      comfyHubProfile: {
        introTitle: 'Introducing ComfyHub',
        createProfileButton: 'Create my profile',
        startPublishingButton: 'Start publishing'
      }
    }
  }
})

describe('ShareWorkflowDialogContent', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockPublishWorkflow.mockReset()
    mockGetShareableAssets.mockReset()
    mockWorkflowStore.activeWorkflow = {
      path: 'workflows/test.json',
      directory: 'workflows',
      filename: 'test.json',
      isTemporary: false,
      isModified: false,
      lastModified: 1000
    }
    mockGetPublishStatus.mockResolvedValue({
      isPublished: false,
      shareId: null,
      shareUrl: null,
      publishedAt: null
    })
    mockFlags.comfyHubUploadEnabled = false
    mockShareServiceData.items = [
      {
        id: 'test.png',
        name: 'test.png',
        preview_url: '',
        storage_url: '',
        model: false,
        public: false,
        in_library: false
      },
      {
        id: 'model.safetensors',
        name: 'model.safetensors',
        preview_url: '',
        storage_url: '',
        model: true,
        public: false,
        in_library: false
      }
    ]
    mockPublishWorkflow.mockResolvedValue({
      shareId: 'test-123',
      shareUrl: 'https://comfy.org/shared/test-123',
      publishedAt: new Date('2026-01-15')
    })
    mockGetShareableAssets.mockResolvedValue(mockShareServiceData.items)
  })

  function createWrapper() {
    return mount(ShareWorkflowDialogContent, {
      props: { onClose },
      global: {
        plugins: [i18n],
        stubs: {
          ComfyHubPublishIntroPanel: {
            template:
              '<section data-testid="publish-intro"><button data-testid="publish-intro-cta" @click="$props.onCreateProfile()">Start publishing</button></section>',
            props: ['onCreateProfile']
          },
          'comfy-hub-publish-intro-panel': {
            template:
              '<section data-testid="publish-intro"><button data-testid="publish-intro-cta" @click="$props.onCreateProfile()">Start publishing</button></section>',
            props: ['onCreateProfile']
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

  it('renders share-link and publish tabs when comfy hub upload is enabled', async () => {
    mockFlags.comfyHubUploadEnabled = true
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.text()).toContain('Share')
    expect(wrapper.text()).toContain('Publish')
    const publishTabPanel = wrapper.find('[data-testid="publish-tab-panel"]')
    expect(publishTabPanel.exists()).toBe(true)
    expect(publishTabPanel.attributes('style')).toContain('display: none')
  })

  it('hides the publish tab when comfy hub upload is disabled', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.text()).toContain('Share')
    expect(wrapper.text()).not.toContain('Publish')
    expect(wrapper.find('[data-testid="publish-intro"]').exists()).toBe(false)
  })

  it('shows publish intro panel in the share dialog', async () => {
    mockFlags.comfyHubUploadEnabled = true
    const wrapper = createWrapper()
    await flushPromises()

    const publishTab = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Publish'))

    expect(publishTab).toBeDefined()
    await publishTab!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="publish-intro"]').exists()).toBe(true)
  })

  it('shows start publishing CTA in the publish intro panel', async () => {
    mockFlags.comfyHubUploadEnabled = true
    const wrapper = createWrapper()
    await flushPromises()

    const publishTab = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Publish'))
    expect(publishTab).toBeDefined()

    await publishTab!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="publish-intro-cta"]').text()).toBe(
      'Start publishing'
    )
  })

  it('opens publish dialog from intro cta and closes share dialog', async () => {
    mockFlags.comfyHubUploadEnabled = true
    const wrapper = createWrapper()
    await flushPromises()

    const publishTab = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Publish'))

    expect(publishTab).toBeDefined()
    await publishTab!.trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="publish-intro-cta"]').trigger('click')
    await nextTick()

    expect(onClose).toHaveBeenCalledOnce()
    expect(mockShowPublishDialog).toHaveBeenCalledOnce()
  })

  it('disables publish button when acknowledgment is unchecked', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const publishButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Create link'))

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
      .find((button) => button.text().includes('Create link'))

    expect(publishButton?.attributes('disabled')).toBeUndefined()
  })

  it('calls onClose when close button is clicked', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const closeButton = wrapper.find('[aria-label="Close"]')
    await closeButton.trigger('click')

    expect(onClose).toHaveBeenCalled()
  })

  it('publishes using acknowledged assets from initial load', async () => {
    const initialShareableAssets = [
      {
        id: 'local-photo-id',
        name: 'photo.png',
        preview_url: '',
        storage_url: '',
        model: false,
        public: false,
        in_library: false
      },
      {
        id: 'local-model-id',
        name: 'model.safetensors',
        preview_url: '',
        storage_url: '',
        model: true,
        public: false,
        in_library: false
      }
    ]

    mockGetShareableAssets.mockResolvedValueOnce(initialShareableAssets)

    const wrapper = createWrapper()
    await flushPromises()

    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    await nextTick()

    const publishButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Create link'))
    expect(publishButton).toBeDefined()

    await publishButton!.trigger('click')
    await flushPromises()

    expect(mockGetShareableAssets).toHaveBeenCalledTimes(1)
    expect(mockPublishWorkflow).toHaveBeenCalledWith(
      'workflows/test.json',
      initialShareableAssets
    )
  })

  it('shows update button when workflow was saved after last publish', async () => {
    const publishedAt = new Date('2026-01-15T00:00:00Z')
    const savedAfterPublishMs = publishedAt.getTime() + 60_000

    mockWorkflowStore.activeWorkflow = {
      path: 'workflows/test.json',
      directory: 'workflows',
      filename: 'test.json',
      isTemporary: false,
      isModified: false,
      lastModified: savedAfterPublishMs
    }
    mockGetPublishStatus.mockResolvedValue({
      isPublished: true,
      shareId: 'abc-123',
      shareUrl: 'https://comfy.org/shared/abc-123',
      publishedAt
    })

    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.text()).toContain('You have made changes...')
    expect(wrapper.text()).toContain('Update link')
  })

  it('shows copy URL when workflow has not changed since publish', async () => {
    const publishedAt = new Date('2026-01-15T00:00:00Z')
    const savedBeforePublishMs = publishedAt.getTime() - 60_000

    mockWorkflowStore.activeWorkflow = {
      path: 'workflows/test.json',
      directory: 'workflows',
      filename: 'test.json',
      isTemporary: false,
      isModified: false,
      lastModified: savedBeforePublishMs
    }
    mockGetPublishStatus.mockResolvedValue({
      isPublished: true,
      shareId: 'abc-123',
      shareUrl: 'https://comfy.org/shared/abc-123',
      publishedAt
    })

    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.text()).toContain('Anyone with this link...')
    expect(wrapper.text()).not.toContain('Update link')
  })

  describe('error and edge cases', () => {
    it('renders unsaved state when workflow is temporary', async () => {
      mockWorkflowStore.activeWorkflow = {
        path: 'workflows/Unsaved Workflow.json',
        directory: 'workflows',
        filename: 'Unsaved Workflow.json',
        isTemporary: true,
        isModified: false,
        lastModified: 1000
      }
      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.text()).toContain(
        'You must save your workflow before sharing.'
      )
      expect(wrapper.text()).toContain('Workflow name')
    })

    it('shows error toast when getPublishStatus rejects', async () => {
      mockGetPublishStatus.mockRejectedValue(new Error('Server down'))

      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.text()).toContain('Create link')
      expect(mockToast.add).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'Failed to load publish status'
      })
    })

    it('shows error toast when publishWorkflow rejects', async () => {
      mockGetShareableAssets.mockResolvedValue([])

      const wrapper = createWrapper()
      await flushPromises()

      mockPublishWorkflow.mockRejectedValue(new Error('Publish failed'))

      const publishButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('Create link'))
      expect(publishButton).toBeDefined()
      await publishButton!.trigger('click')
      await flushPromises()

      expect(wrapper.text()).not.toContain('Anyone with this link...')
      expect(mockToast.add).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'Error',
        detail: 'Publish failed',
        life: 5000
      })
    })

    it('renders unsaved state when no active workflow exists', async () => {
      mockWorkflowStore.activeWorkflow = null
      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.text()).toContain(
        'You must save your workflow before sharing.'
      )
    })

    it('does not call publishWorkflow when workflow is null during publish', async () => {
      mockGetShareableAssets.mockResolvedValue([])

      const wrapper = createWrapper()
      await flushPromises()

      mockWorkflowStore.activeWorkflow = null

      const publishButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('Create link'))
      if (publishButton) {
        await publishButton.trigger('click')
        await flushPromises()
      }

      expect(mockPublishWorkflow).not.toHaveBeenCalled()
    })

    it('does not switch to publishToHub mode when flag is disabled', async () => {
      mockFlags.comfyHubUploadEnabled = false
      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.find('[data-testid="publish-tab-panel"]').exists()).toBe(
        false
      )
      expect(wrapper.text()).not.toContain('Publish')
    })
  })
})
