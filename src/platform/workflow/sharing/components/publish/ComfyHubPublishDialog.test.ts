import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useI18n: () => ({ t: (key: string) => key })
  }
})

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() })
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
  () => ({
    useComfyHubPublishWizard: () => ({
      currentStep: ref('finish'),
      formData: ref({
        name: '',
        description: '',
        tags: [],
        models: [],
        customNodes: [],
        thumbnailType: 'image',
        thumbnailFile: null,
        comparisonBeforeFile: null,
        comparisonAfterFile: null,
        exampleImages: [],
        tutorialUrl: '',
        metadata: {}
      }),
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
  })
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
    renameWorkflow: vi.fn(),
    saveWorkflow: vi.fn()
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: {
      path: 'workflows/test.json',
      filename: 'test.json',
      directory: 'workflows',
      isTemporary: false,
      isModified: false
    },
    saveWorkflow: vi.fn()
  })
}))

async function flushPromises() {
  await new Promise((r) => setTimeout(r, 0))
}

describe('ComfyHubPublishDialog', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchProfile.mockResolvedValue(null)
    mockSubmitToComfyHub.mockResolvedValue(undefined)
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
    expect(onClose).toHaveBeenCalledOnce()
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
})
