import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import ComfyHubPublishWizardContent from './ComfyHubPublishWizardContent.vue'
import type { ComfyHubPublishFormData } from '@/platform/workflow/sharing/types/comfyHubTypes'

const mockCheckProfile = vi.hoisted(() => vi.fn())
const mockToastErrorHandler = vi.hoisted(() => vi.fn())
const mockHasProfile = ref<boolean | null>(true)
const mockIsFetchingProfile = ref(false)
const mockProfile = ref<{ username: string; name?: string } | null>({
  username: 'testuser',
  name: 'Test User'
})

vi.mock(
  '@/platform/workflow/sharing/composables/useComfyHubProfileGate',
  () => ({
    useComfyHubProfileGate: () => ({
      checkProfile: mockCheckProfile,
      hasProfile: mockHasProfile,
      isFetchingProfile: mockIsFetchingProfile,
      profile: mockProfile
    })
  })
)

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    toastErrorHandler: mockToastErrorHandler
  })
}))

const mockFlags = vi.hoisted(() => ({
  comfyHubProfileGateEnabled: true
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: mockFlags
  })
}))

function createDefaultFormData(): ComfyHubPublishFormData {
  return {
    name: 'Test Workflow',
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
  }
}

async function flushPromises() {
  await new Promise((r) => setTimeout(r, 0))
}

describe('ComfyHubPublishWizardContent', () => {
  const onPublish = vi.fn()
  const onGoNext = vi.fn()
  const onGoBack = vi.fn()
  const onUpdateFormData = vi.fn()
  const onRequireProfile = vi.fn()
  const onGateComplete = vi.fn()
  const onGateClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    onPublish.mockResolvedValue(undefined)
    mockCheckProfile.mockResolvedValue(true)
    mockHasProfile.value = true
    mockIsFetchingProfile.value = false
    mockProfile.value = { username: 'testuser', name: 'Test User' }
    mockFlags.comfyHubProfileGateEnabled = true
  })

  function renderComponent(
    overrides: Partial<
      InstanceType<typeof ComfyHubPublishWizardContent>['$props']
    > = {}
  ) {
    return render(ComfyHubPublishWizardContent, {
      props: {
        currentStep: 'finish',
        formData: createDefaultFormData(),
        isFirstStep: false,
        isLastStep: true,
        onGoNext,
        onGoBack,
        onUpdateFormData,
        onPublish,
        onRequireProfile,
        onGateComplete,
        onGateClose,
        ...overrides
      },
      global: {
        mocks: {
          $t: (key: string) => key
        },
        stubs: {
          ComfyHubCreateProfileForm: {
            template: '<div data-testid="publish-gate-flow" />',
            props: ['onProfileCreated', 'onClose', 'showCloseButton']
          },
          'comfy-hub-create-profile-form': {
            template: '<div data-testid="publish-gate-flow" />',
            props: ['onProfileCreated', 'onClose', 'showCloseButton']
          },
          Skeleton: {
            template: '<div class="skeleton" />'
          },
          ComfyHubDescribeStep: {
            template: '<div data-testid="describe-step" />'
          },
          ComfyHubFinishStep: {
            template: '<div data-testid="finish-step" />',
            props: ['profile', 'acknowledged', 'ready'],
            emits: ['update:ready', 'update:acknowledged'],
            setup(
              _: unknown,
              { emit }: { emit: (e: string, v: boolean) => void }
            ) {
              emit('update:ready', true)
            }
          },
          ComfyHubExamplesStep: {
            template: '<div data-testid="examples-step" />'
          },
          ComfyHubThumbnailStep: {
            template: '<div data-testid="thumbnail-step" />'
          },
          ComfyHubProfilePromptPanel: {
            template:
              '<div data-testid="profile-prompt"><button data-testid="request-profile" @click="$emit(\'request-profile\')" /></div>',
            emits: ['request-profile']
          },
          ComfyHubPublishFooter: {
            template:
              '<div data-testid="publish-footer" :data-publish-disabled="isPublishDisabled" :data-is-publishing="isPublishing"><button data-testid="publish-btn" @click="$emit(\'publish\')" /><button data-testid="next-btn" @click="$emit(\'next\')" /><button data-testid="back-btn" @click="$emit(\'back\')" /></div>',
            props: [
              'isFirstStep',
              'isLastStep',
              'isPublishDisabled',
              'isPublishing'
            ],
            emits: ['publish', 'next', 'back']
          }
        }
      }
    })
  }

  function createDeferred<T>() {
    let resolve: (value: T) => void = () => {}
    let reject: (error: unknown) => void = () => {}

    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })

    return { promise, resolve, reject }
  }

  describe('handlePublish - profile check routing', () => {
    it('calls onPublish when profile exists', async () => {
      mockCheckProfile.mockResolvedValue(true)

      renderComponent()
      await userEvent.click(screen.getByTestId('publish-btn'))
      await flushPromises()

      expect(mockCheckProfile).toHaveBeenCalledOnce()
      expect(onPublish).toHaveBeenCalledOnce()
      expect(onRequireProfile).not.toHaveBeenCalled()
    })

    it('calls onRequireProfile when no profile exists', async () => {
      mockCheckProfile.mockResolvedValue(false)

      renderComponent()
      await userEvent.click(screen.getByTestId('publish-btn'))
      await flushPromises()

      expect(onRequireProfile).toHaveBeenCalledOnce()
      expect(onPublish).not.toHaveBeenCalled()
    })

    it('shows toast and aborts when checkProfile throws', async () => {
      const error = new Error('Network error')
      mockCheckProfile.mockRejectedValue(error)

      renderComponent()
      await userEvent.click(screen.getByTestId('publish-btn'))
      await flushPromises()

      expect(mockToastErrorHandler).toHaveBeenCalledWith(error)
      expect(onPublish).not.toHaveBeenCalled()
      expect(onRequireProfile).not.toHaveBeenCalled()
    })

    it('calls onPublish directly when profile gate is disabled', async () => {
      mockFlags.comfyHubProfileGateEnabled = false

      renderComponent()
      await userEvent.click(screen.getByTestId('publish-btn'))
      await flushPromises()

      expect(mockCheckProfile).not.toHaveBeenCalled()
      expect(onPublish).toHaveBeenCalledOnce()
    })
  })

  describe('handlePublish - async submission', () => {
    it('prevents duplicate publish submissions while in-flight', async () => {
      const publishDeferred = createDeferred<void>()
      onPublish.mockReturnValue(publishDeferred.promise)

      renderComponent()
      const publishBtn = screen.getByTestId('publish-btn')

      await userEvent.click(publishBtn)
      await userEvent.click(publishBtn)
      await flushPromises()

      expect(onPublish).toHaveBeenCalledTimes(1)

      publishDeferred.resolve(undefined)
      await flushPromises()
    })

    it('calls onPublish and does not close when publish request fails', async () => {
      const publishError = new Error('Publish failed')
      onPublish.mockRejectedValueOnce(publishError)

      renderComponent()
      await userEvent.click(screen.getByTestId('publish-btn'))
      await flushPromises()

      expect(onPublish).toHaveBeenCalledOnce()
      expect(mockToastErrorHandler).toHaveBeenCalledWith(publishError)
      expect(onGateClose).not.toHaveBeenCalled()
    })

    it('shows publish disabled while submitting', async () => {
      const publishDeferred = createDeferred<void>()
      onPublish.mockReturnValue(publishDeferred.promise)

      renderComponent()
      const publishBtn = screen.getByTestId('publish-btn')

      await userEvent.click(publishBtn)
      await flushPromises()

      const footer = screen.getByTestId('publish-footer')
      expect(footer.getAttribute('data-publish-disabled')).toBe('true')
      expect(footer.getAttribute('data-is-publishing')).toBe('true')

      publishDeferred.resolve(undefined)
      await flushPromises()

      expect(footer.getAttribute('data-is-publishing')).toBe('false')
    })

    it('resets guard after publish error so retry is possible', async () => {
      onPublish.mockRejectedValueOnce(new Error('Publish failed'))

      renderComponent()
      const publishBtn = screen.getByTestId('publish-btn')

      await userEvent.click(publishBtn)
      await flushPromises()

      onPublish.mockResolvedValueOnce(undefined)
      await userEvent.click(publishBtn)
      await flushPromises()

      expect(onPublish).toHaveBeenCalledTimes(2)
    })
  })

  describe('isPublishDisabled', () => {
    it('disables publish when gate enabled and hasProfile is not true', () => {
      mockHasProfile.value = null
      renderComponent()

      const footer = screen.getByTestId('publish-footer')
      expect(footer.getAttribute('data-publish-disabled')).toBe('true')
    })

    it('enables publish when gate enabled and hasProfile is true', async () => {
      mockHasProfile.value = true
      renderComponent()
      await flushPromises()

      const footer = screen.getByTestId('publish-footer')
      expect(footer.getAttribute('data-publish-disabled')).toBe('false')
    })

    it('enables publish when gate is disabled regardless of profile', () => {
      mockFlags.comfyHubProfileGateEnabled = false
      mockHasProfile.value = null
      renderComponent()

      const footer = screen.getByTestId('publish-footer')
      expect(footer.getAttribute('data-publish-disabled')).toBe('false')
    })
  })

  describe('profileCreation step rendering', () => {
    it('shows profile creation form when on profileCreation step', () => {
      renderComponent({ currentStep: 'profileCreation' })
      expect(screen.getByTestId('publish-gate-flow')).toBeTruthy()
      expect(screen.queryByTestId('publish-footer')).not.toBeInTheDocument()
    })

    it('shows wizard content when not on profileCreation step', () => {
      renderComponent({ currentStep: 'finish' })
      expect(screen.queryByTestId('publish-gate-flow')).not.toBeInTheDocument()
      expect(screen.getByTestId('publish-footer')).toBeTruthy()
    })
  })
})
