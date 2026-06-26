import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useI18n: () => ({ t: (key: string) => key })
  }
})

const mockToastAdd = vi.hoisted(() => vi.fn())

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd })
}))

import ComfyHubPublishDialog from '@/platform/workflow/sharing/components/publish/ComfyHubPublishDialog.vue'

const mockFetchProfile = vi.hoisted(() => vi.fn())
const mockGoToStep = vi.hoisted(() => vi.fn())
const mockGoNext = vi.hoisted(() => vi.fn())
const mockGoBack = vi.hoisted(() => vi.fn())
const mockOpenProfileCreationStep = vi.hoisted(() => vi.fn())
const mockCloseProfileCreationStep = vi.hoisted(() => vi.fn())
const mockApplyPrefill = vi.hoisted(() => vi.fn())
const mockCachePublishPrefill = vi.hoisted(() => vi.fn())
const mockGetCachedPrefill = vi.hoisted(() => vi.fn())
const mockSubmitToComfyHub = vi.hoisted(() => vi.fn())
const mockGetPublishStatus = vi.hoisted(() => vi.fn())
const mockRenameWorkflow = vi.hoisted(() => vi.fn())
const mockFormDataHolder = vi.hoisted(
  () => ({ value: null }) as { value: Record<string, unknown> | null }
)

vi.mock(
  '@/platform/workflow/sharing/composables/useComfyHubProfileGate',
  () => ({
    useComfyHubProfileGate: () => ({
      fetchProfile: mockFetchProfile
    })
  })
)

vi.mock(
  '@/platform/workflow/sharing/composables/useComfyHubPublishWizard',
  () => {
    mockFormDataHolder.value = {
      name: '',
      description: '',
      tags: [],
      models: [],
      customNodes: [],
      thumbnailType: 'image',
      thumbnailFile: null,
      thumbnailUrl: null,
      existingThumbnailType: null,
      comparisonBeforeFile: null,
      comparisonAfterFile: null,
      comparisonAfterUrl: null,
      exampleImages: [],
      tutorialUrl: '',
      metadata: {}
    }
    return {
      useComfyHubPublishWizard: () => ({
        currentStep: ref('finish'),
        formData: ref(mockFormDataHolder.value),
        isFirstStep: ref(false),
        isLastStep: ref(true),
        goToStep: mockGoToStep,
        goNext: mockGoNext,
        goBack: mockGoBack,
        openProfileCreationStep: mockOpenProfileCreationStep,
        closeProfileCreationStep: mockCloseProfileCreationStep,
        applyPrefill: mockApplyPrefill
      }),
      cachePublishPrefill: mockCachePublishPrefill,
      getCachedPrefill: mockGetCachedPrefill
    }
  }
)

vi.mock(
  '@/platform/workflow/sharing/composables/useComfyHubPublishSubmission',
  () => ({
    useComfyHubPublishSubmission: () => ({
      submitToComfyHub: mockSubmitToComfyHub
    })
  })
)

vi.mock('@/platform/workflow/sharing/services/workflowShareService', () => ({
  useWorkflowShareService: () => ({
    getPublishStatus: mockGetPublishStatus
  })
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({
    renameWorkflow: mockRenameWorkflow,
    saveWorkflow: vi.fn()
  })
}))

const mockWorkflowStore = vi.hoisted(() => {
  return {
    instance: null as { activeWorkflow: Record<string, unknown> | null } | null
  }
})

vi.mock('@/platform/workflow/management/stores/workflowStore', async () => {
  const { reactive } = await import('vue')
  mockWorkflowStore.instance = reactive({
    activeWorkflow: {
      path: 'workflows/test.json',
      filename: 'test.json',
      directory: 'workflows',
      isTemporary: false,
      isModified: false
    } as Record<string, unknown> | null
  })
  return {
    useWorkflowStore: () => ({
      ...mockWorkflowStore.instance,
      get activeWorkflow() {
        return mockWorkflowStore.instance?.activeWorkflow ?? null
      },
      saveWorkflow: vi.fn()
    })
  }
})

function setActiveWorkflow(workflow: Record<string, unknown> | null) {
  if (mockWorkflowStore.instance) {
    mockWorkflowStore.instance.activeWorkflow = workflow
  }
}

async function flushPromises() {
  await new Promise((r) => setTimeout(r, 0))
}

describe('ComfyHubPublishDialog', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    setActiveWorkflow({
      path: 'workflows/test.json',
      filename: 'test.json',
      directory: 'workflows',
      isTemporary: false,
      isModified: false
    })
    mockFetchProfile.mockResolvedValue(null)
    mockSubmitToComfyHub.mockResolvedValue(undefined)
    mockRenameWorkflow.mockResolvedValue(undefined)
    if (mockFormDataHolder.value) mockFormDataHolder.value.name = ''
    mockGetCachedPrefill.mockReturnValue(null)
    mockGetPublishStatus.mockResolvedValue({
      isPublished: false,
      shareId: null,
      shareUrl: null,
      publishedAt: null,
      prefill: null
    })
  })

  function renderComponent() {
    return render(ComfyHubPublishDialog, {
      props: { onClose },
      global: {
        mocks: {
          $t: (key: string) => key
        },
        stubs: {
          BaseModalLayout: {
            template:
              '<div data-testid="base-modal-layout"><slot name="leftPanelHeaderTitle" /><slot name="leftPanel" /><slot name="header" /><slot name="content" /></div>'
          },
          ComfyHubPublishNav: {
            template: '<nav data-testid="publish-nav" />',
            props: ['currentStep']
          },
          'comfy-hub-publish-nav': {
            template: '<nav data-testid="publish-nav" />',
            props: ['currentStep']
          },
          ComfyHubPublishWizardContent: {
            template:
              '<div :data-is-publishing="$props.isPublishing"><button data-testid="require-profile" @click="$props.onRequireProfile()" /><button data-testid="gate-complete" @click="$props.onGateComplete()" /><button data-testid="gate-close" @click="$props.onGateClose()" /><button data-testid="publish" @click="$props.onPublish()" /></div>',
            props: [
              'currentStep',
              'formData',
              'isFirstStep',
              'isLastStep',
              'isPublishing',
              'onGoNext',
              'onGoBack',
              'onPublish',
              'onRequireProfile',
              'onGateComplete',
              'onGateClose'
            ]
          }
        }
      }
    })
  }

  it('starts in publish wizard mode and prefetches profile asynchronously', async () => {
    renderComponent()
    await flushPromises()

    expect(mockFetchProfile).toHaveBeenCalledWith()
  })

  it('switches to profile creation step when final-step publish requires profile', async () => {
    renderComponent()
    await flushPromises()

    await userEvent.click(screen.getByTestId('require-profile'))

    expect(mockOpenProfileCreationStep).toHaveBeenCalledOnce()
  })

  it('returns to finish state after gate complete and does not auto-close', async () => {
    renderComponent()
    await flushPromises()

    await userEvent.click(screen.getByTestId('require-profile'))
    await userEvent.click(screen.getByTestId('gate-complete'))

    expect(mockOpenProfileCreationStep).toHaveBeenCalledOnce()
    expect(mockCloseProfileCreationStep).toHaveBeenCalledOnce()
    expect(mockFetchProfile).toHaveBeenCalledWith({ force: true })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('returns to finish state when profile gate is closed', async () => {
    renderComponent()
    await flushPromises()

    await userEvent.click(screen.getByTestId('require-profile'))
    await userEvent.click(screen.getByTestId('gate-close'))

    expect(mockOpenProfileCreationStep).toHaveBeenCalledOnce()
    expect(mockCloseProfileCreationStep).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes dialog after successful publish', async () => {
    renderComponent()
    await flushPromises()

    await userEvent.click(screen.getByTestId('publish'))
    await flushPromises()

    expect(mockSubmitToComfyHub).toHaveBeenCalledOnce()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renames the local workflow when the published name differs', async () => {
    renderComponent()
    await flushPromises()
    if (mockFormDataHolder.value) mockFormDataHolder.value.name = 'renamed'

    await userEvent.click(screen.getByTestId('publish'))
    await flushPromises()

    expect(mockRenameWorkflow).toHaveBeenCalledWith(
      expect.anything(),
      'workflows/renamed.json'
    )
    expect(mockSubmitToComfyHub.mock.invocationCallOrder[0]).toBeLessThan(
      mockRenameWorkflow.mock.invocationCallOrder[0]
    )
  })

  it('does not rename when the published name matches the file name', async () => {
    renderComponent()
    await flushPromises()
    if (mockFormDataHolder.value) mockFormDataHolder.value.name = 'test'

    await userEvent.click(screen.getByTestId('publish'))
    await flushPromises()

    expect(mockRenameWorkflow).not.toHaveBeenCalled()
  })

  it('still reports success but warns when the post-publish rename fails', async () => {
    mockRenameWorkflow.mockRejectedValueOnce(new Error('rename failed'))
    renderComponent()
    await flushPromises()
    if (mockFormDataHolder.value) mockFormDataHolder.value.name = 'renamed'

    await userEvent.click(screen.getByTestId('publish'))
    await flushPromises()

    expect(mockSubmitToComfyHub).toHaveBeenCalledOnce()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn' })
    )
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not rename or close when publish submission fails', async () => {
    mockSubmitToComfyHub.mockRejectedValueOnce(new Error('submit failed'))
    renderComponent()
    await flushPromises()
    if (mockFormDataHolder.value) mockFormDataHolder.value.name = 'renamed'

    await userEvent.click(screen.getByTestId('publish'))
    await flushPromises()

    expect(mockSubmitToComfyHub).toHaveBeenCalledOnce()
    expect(mockRenameWorkflow).not.toHaveBeenCalled()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
    expect(mockToastAdd).not.toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not refetch publish status when the rename changes the path mid-publish', async () => {
    mockRenameWorkflow.mockImplementationOnce(async () => {
      setActiveWorkflow({
        path: 'workflows/renamed.json',
        filename: 'renamed.json',
        directory: 'workflows',
        isTemporary: false,
        isModified: false
      })
    })
    renderComponent()
    await flushPromises()
    mockGetPublishStatus.mockClear()
    if (mockFormDataHolder.value) mockFormDataHolder.value.name = 'renamed'

    await userEvent.click(screen.getByTestId('publish'))
    await flushPromises()

    expect(mockGetPublishStatus).not.toHaveBeenCalledWith(
      'workflows/renamed.json'
    )
  })

  it('caches the prefill under the renamed path after publish', async () => {
    mockRenameWorkflow.mockImplementationOnce(async () => {
      setActiveWorkflow({
        path: 'workflows/renamed.json',
        filename: 'renamed.json',
        directory: 'workflows',
        isTemporary: false,
        isModified: false
      })
    })
    renderComponent()
    await flushPromises()
    if (mockFormDataHolder.value) mockFormDataHolder.value.name = 'renamed'

    await userEvent.click(screen.getByTestId('publish'))
    await flushPromises()

    expect(mockCachePublishPrefill).toHaveBeenCalledWith(
      'workflows/renamed.json',
      expect.anything()
    )
  })

  it('applies prefill when workflow is already published with metadata', async () => {
    mockGetPublishStatus.mockResolvedValue({
      isPublished: true,
      shareId: 'abc123',
      shareUrl: 'http://localhost/?share=abc123',
      publishedAt: new Date(),
      prefill: {
        description: 'Existing description',
        tags: ['art', 'upscale'],
        thumbnailType: 'video',
        sampleImageUrls: ['https://example.com/img1.png']
      }
    })

    renderComponent()
    await flushPromises()

    expect(mockApplyPrefill).toHaveBeenCalledWith({
      description: 'Existing description',
      tags: ['art', 'upscale'],
      thumbnailType: 'video',
      sampleImageUrls: ['https://example.com/img1.png']
    })
  })

  it('does not apply prefill when workflow is not published', async () => {
    renderComponent()
    await flushPromises()

    expect(mockApplyPrefill).not.toHaveBeenCalled()
  })

  it('does not apply prefill when status has no prefill data', async () => {
    mockGetPublishStatus.mockResolvedValue({
      isPublished: true,
      shareId: 'abc123',
      shareUrl: 'http://localhost/?share=abc123',
      publishedAt: new Date(),
      prefill: null
    })

    renderComponent()
    await flushPromises()

    expect(mockApplyPrefill).not.toHaveBeenCalled()
  })

  it('silently ignores prefill fetch errors', async () => {
    mockGetPublishStatus.mockRejectedValue(new Error('Network error'))

    renderComponent()
    await flushPromises()

    expect(mockApplyPrefill).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('falls back to cached prefill when the status fetch fails', async () => {
    mockGetPublishStatus.mockRejectedValue(new Error('Network error'))
    const cached = { description: 'cached' }
    mockGetCachedPrefill.mockReturnValue(cached)

    renderComponent()
    await flushPromises()

    expect(mockApplyPrefill).toHaveBeenCalledWith(cached)
  })

  it('refetches prefill when the active workflow path changes (e.g. rename)', async () => {
    renderComponent()
    await flushPromises()
    expect(mockGetPublishStatus).toHaveBeenLastCalledWith('workflows/test.json')

    mockGetPublishStatus.mockClear()
    setActiveWorkflow({
      path: 'workflows/renamed.json',
      filename: 'renamed.json',
      directory: 'workflows',
      isTemporary: false,
      isModified: false
    })
    await nextTick()
    await flushPromises()

    expect(mockGetPublishStatus).toHaveBeenCalledWith('workflows/renamed.json')
  })

  it('does not refetch prefill when the active workflow path is unchanged', async () => {
    renderComponent()
    await flushPromises()

    mockGetPublishStatus.mockClear()
    setActiveWorkflow({
      path: 'workflows/test.json',
      filename: 'test.json',
      directory: 'workflows',
      isTemporary: false,
      isModified: true
    })
    await nextTick()
    await flushPromises()

    expect(mockGetPublishStatus).not.toHaveBeenCalled()
  })

  it('ignores a stale prefill response after the workflow path changes', async () => {
    const stalePrefill = { description: 'stale' }
    let resolveStale: (value: unknown) => void = () => {}
    mockGetPublishStatus.mockImplementation((path: string) => {
      if (path === 'workflows/test.json') {
        return new Promise((resolve) => {
          resolveStale = resolve
        })
      }
      return Promise.resolve({
        isPublished: true,
        shareId: 'fresh',
        shareUrl: null,
        publishedAt: new Date(),
        prefill: { description: 'fresh' }
      })
    })

    renderComponent()
    await nextTick()

    setActiveWorkflow({
      path: 'workflows/renamed.json',
      filename: 'renamed.json',
      directory: 'workflows',
      isTemporary: false,
      isModified: false
    })
    await nextTick()
    await flushPromises()

    resolveStale({
      isPublished: true,
      shareId: 'stale',
      shareUrl: null,
      publishedAt: new Date(),
      prefill: stalePrefill
    })
    await flushPromises()

    expect(mockApplyPrefill).not.toHaveBeenCalledWith(stalePrefill)
  })
})
