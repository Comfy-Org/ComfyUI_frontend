import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
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

async function flushPromises() {
  await new Promise((r) => setTimeout(r, 0))
}

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

  function renderComponent() {
    return render(ShareWorkflowDialogContent, {
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
    const { container } = renderComponent()
    await flushPromises()

    expect(container.textContent).toContain(
      'You must save your workflow before sharing.'
    )
    expect(container.textContent).toContain('Save workflow')
  })

  it('renders share-link and publish tabs when comfy hub upload is enabled', async () => {
    mockFlags.comfyHubUploadEnabled = true
    const { container } = renderComponent()
    await flushPromises()

    expect(container.textContent).toContain('Share')
    expect(container.textContent).toContain('Publish')
    const publishTabPanel = screen.getByTestId('publish-tab-panel')
    expect(publishTabPanel).not.toBeVisible()
  })

  it('hides the publish tab when comfy hub upload is disabled', async () => {
    const { container } = renderComponent()
    await flushPromises()

    expect(container.textContent).toContain('Share')
    expect(container.textContent).not.toContain('Publish')
    expect(screen.queryByTestId('publish-intro')).not.toBeInTheDocument()
  })

  it('shows publish intro panel in the share dialog', async () => {
    mockFlags.comfyHubUploadEnabled = true
    renderComponent()
    await flushPromises()

    const publishTab = screen.getByRole('tab', { name: /Publish/ })

    await userEvent.click(publishTab)
    await flushPromises()

    expect(screen.getByTestId('publish-intro')).toBeTruthy()
  })

  it('shows start publishing CTA in the publish intro panel', async () => {
    mockFlags.comfyHubUploadEnabled = true
    renderComponent()
    await flushPromises()

    const publishTab = screen.getByRole('tab', { name: /Publish/ })

    await userEvent.click(publishTab)
    await flushPromises()

    expect(screen.getByTestId('publish-intro-cta').textContent).toBe(
      'Start publishing'
    )
  })

  it('opens publish dialog from intro cta and closes share dialog', async () => {
    mockFlags.comfyHubUploadEnabled = true
    renderComponent()
    await flushPromises()

    const publishTab = screen.getByRole('tab', { name: /Publish/ })

    await userEvent.click(publishTab)
    await flushPromises()

    await userEvent.click(screen.getByTestId('publish-intro-cta'))
    await nextTick()

    expect(onClose).toHaveBeenCalledOnce()
    expect(mockShowPublishDialog).toHaveBeenCalledOnce()
  })

  it('disables publish button when acknowledgment is unchecked', async () => {
    renderComponent()
    await flushPromises()

    const publishButton = screen.getByRole('button', {
      name: /Create link/i
    })

    expect(publishButton).toBeDisabled()
  })

  it('enables publish button when acknowledgment is checked', async () => {
    renderComponent()
    await flushPromises()

    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)
    await nextTick()

    const publishButton = screen.getByRole('button', {
      name: /Create link/i
    })

    expect(publishButton).toBeEnabled()
  })

  it('calls onClose when close button is clicked', async () => {
    renderComponent()
    await flushPromises()

    const closeButton = screen.getByRole('button', { name: 'Close' })
    await userEvent.click(closeButton)

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

    renderComponent()
    await flushPromises()

    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)
    await nextTick()

    const publishButton = screen.getByRole('button', {
      name: /Create link/i
    })

    await userEvent.click(publishButton)
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

    const { container } = renderComponent()
    await flushPromises()

    expect(container.textContent).toContain('You have made changes...')
    expect(container.textContent).toContain('Update link')
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

    const { container } = renderComponent()
    await flushPromises()

    expect(container.textContent).toContain('Anyone with this link...')
    expect(container.textContent).not.toContain('Update link')
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
      const { container } = renderComponent()
      await flushPromises()

      expect(container.textContent).toContain(
        'You must save your workflow before sharing.'
      )
      expect(container.textContent).toContain('Workflow name')
    })

    it('shows error toast when getPublishStatus rejects', async () => {
      mockGetPublishStatus.mockRejectedValue(new Error('Server down'))

      const { container } = renderComponent()
      await flushPromises()

      expect(container.textContent).toContain('Create link')
      expect(mockToast.add).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'Failed to load publish status'
      })
    })

    it('shows error toast when publishWorkflow rejects', async () => {
      mockGetShareableAssets.mockResolvedValue([])

      const { container } = renderComponent()
      await flushPromises()

      mockPublishWorkflow.mockRejectedValue(new Error('Publish failed'))

      const publishButton = screen.getByRole('button', {
        name: /Create link/i
      })
      await userEvent.click(publishButton)
      await flushPromises()

      expect(container.textContent).not.toContain('Anyone with this link...')
      expect(mockToast.add).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'Error',
        detail: 'Publish failed'
      })
    })

    it('renders unsaved state when no active workflow exists', async () => {
      mockWorkflowStore.activeWorkflow = null
      const { container } = renderComponent()
      await flushPromises()

      expect(container.textContent).toContain(
        'You must save your workflow before sharing.'
      )
    })

    it('does not call publishWorkflow when workflow is null during publish', async () => {
      mockGetShareableAssets.mockResolvedValue([])

      renderComponent()
      await flushPromises()

      mockWorkflowStore.activeWorkflow = null

      const publishButton = screen.getByRole('button', {
        name: /Create link/i
      })
      await userEvent.click(publishButton)
      await flushPromises()

      expect(mockPublishWorkflow).not.toHaveBeenCalled()
    })

    it('does not switch to publishToHub mode when flag is disabled', async () => {
      mockFlags.comfyHubUploadEnabled = false
      const { container } = renderComponent()
      await flushPromises()

      expect(screen.queryByTestId('publish-tab-panel')).not.toBeInTheDocument()
      expect(container.textContent).not.toContain('Publish')
    })
  })
})
