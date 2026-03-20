import { flushPromises, mount } from '@vue/test-utils'
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

  function createWrapper(
    overrides: Partial<
      InstanceType<typeof ComfyHubPublishWizardContent>['$props']
    > = {}
  ) {
    return mount(ComfyHubPublishWizardContent, {
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
            props: ['profile', 'acknowledged'],
            setup() {
              return { isReady: true }
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

      const wrapper = createWrapper()
      await wrapper.find('[data-testid="publish-btn"]').trigger('click')
      await flushPromises()

      expect(mockCheckProfile).toHaveBeenCalledOnce()
      expect(onPublish).toHaveBeenCalledOnce()
      expect(onRequireProfile).not.toHaveBeenCalled()
    })

    it('calls onRequireProfile when no profile exists', async () => {
      mockCheckProfile.mockResolvedValue(false)

      const wrapper = createWrapper()
      await wrapper.find('[data-testid="publish-btn"]').trigger('click')
      await flushPromises()

      expect(onRequireProfile).toHaveBeenCalledOnce()
      expect(onPublish).not.toHaveBeenCalled()
    })

    it('shows toast and aborts when checkProfile throws', async () => {
      const error = new Error('Network error')
      mockCheckProfile.mockRejectedValue(error)

      const wrapper = createWrapper()
      await wrapper.find('[data-testid="publish-btn"]').trigger('click')
      await flushPromises()

      expect(mockToastErrorHandler).toHaveBeenCalledWith(error)
      expect(onPublish).not.toHaveBeenCalled()
      expect(onRequireProfile).not.toHaveBeenCalled()
    })

    it('calls onPublish directly when profile gate is disabled', async () => {
      mockFlags.comfyHubProfileGateEnabled = false

      const wrapper = createWrapper()
      await wrapper.find('[data-testid="publish-btn"]').trigger('click')
      await flushPromises()

      expect(mockCheckProfile).not.toHaveBeenCalled()
      expect(onPublish).toHaveBeenCalledOnce()
    })
  })

  describe('handlePublish - async submission', () => {
    it('prevents duplicate publish submissions while in-flight', async () => {
      const publishDeferred = createDeferred<void>()
      onPublish.mockReturnValue(publishDeferred.promise)

      const wrapper = createWrapper()
      const publishBtn = wrapper.find('[data-testid="publish-btn"]')

      await publishBtn.trigger('click')
      await publishBtn.trigger('click')
      await flushPromises()

      expect(onPublish).toHaveBeenCalledTimes(1)

      publishDeferred.resolve(undefined)
      await flushPromises()
    })

    it('calls onPublish and does not close when publish request fails', async () => {
      const publishError = new Error('Publish failed')
      onPublish.mockRejectedValueOnce(publishError)

      const wrapper = createWrapper()
      await wrapper.find('[data-testid="publish-btn"]').trigger('click')
      await flushPromises()

      expect(onPublish).toHaveBeenCalledOnce()
      expect(mockToastErrorHandler).toHaveBeenCalledWith(publishError)
      expect(onGateClose).not.toHaveBeenCalled()
    })

    it('shows publish disabled while submitting', async () => {
      const publishDeferred = createDeferred<void>()
      onPublish.mockReturnValue(publishDeferred.promise)

      const wrapper = createWrapper()
      const publishBtn = wrapper.find('[data-testid="publish-btn"]')

      await publishBtn.trigger('click')
      await flushPromises()

      const footer = wrapper.find('[data-testid="publish-footer"]')
      expect(footer.attributes('data-publish-disabled')).toBe('true')
      expect(footer.attributes('data-is-publishing')).toBe('true')

      publishDeferred.resolve(undefined)
      await flushPromises()

      expect(footer.attributes('data-is-publishing')).toBe('false')
    })

    it('resets guard after publish error so retry is possible', async () => {
      onPublish.mockRejectedValueOnce(new Error('Publish failed'))

      const wrapper = createWrapper()
      const publishBtn = wrapper.find('[data-testid="publish-btn"]')

      await publishBtn.trigger('click')
      await flushPromises()

      onPublish.mockResolvedValueOnce(undefined)
      await publishBtn.trigger('click')
      await flushPromises()

      expect(onPublish).toHaveBeenCalledTimes(2)
    })
  })

  describe('isPublishDisabled', () => {
    it('disables publish when gate enabled and hasProfile is not true', () => {
      mockHasProfile.value = null
      const wrapper = createWrapper()

      const footer = wrapper.find('[data-testid="publish-footer"]')
      expect(footer.attributes('data-publish-disabled')).toBe('true')
    })

    it('enables publish when gate enabled and hasProfile is true', () => {
      mockHasProfile.value = true
      const wrapper = createWrapper()

      const footer = wrapper.find('[data-testid="publish-footer"]')
      expect(footer.attributes('data-publish-disabled')).toBe('false')
    })

    it('enables publish when gate is disabled regardless of profile', () => {
      mockFlags.comfyHubProfileGateEnabled = false
      mockHasProfile.value = null
      const wrapper = createWrapper()

      const footer = wrapper.find('[data-testid="publish-footer"]')
      expect(footer.attributes('data-publish-disabled')).toBe('false')
    })
  })

  describe('profileCreation step rendering', () => {
    it('shows profile creation form when on profileCreation step', () => {
      const wrapper = createWrapper({ currentStep: 'profileCreation' })
      expect(wrapper.find('[data-testid="publish-gate-flow"]').exists()).toBe(
        true
      )
      expect(wrapper.find('[data-testid="publish-footer"]').exists()).toBe(
        false
      )
    })

    it('shows wizard content when not on profileCreation step', () => {
      const wrapper = createWrapper({ currentStep: 'finish' })
      expect(wrapper.find('[data-testid="publish-gate-flow"]').exists()).toBe(
        false
      )
      expect(wrapper.find('[data-testid="publish-footer"]').exists()).toBe(true)
    })
  })
})
