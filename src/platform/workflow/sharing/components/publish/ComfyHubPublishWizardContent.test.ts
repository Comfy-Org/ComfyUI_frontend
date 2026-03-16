import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import ComfyHubPublishWizardContent from './ComfyHubPublishWizardContent.vue'
import type { ComfyHubPublishFormData } from '@/platform/workflow/sharing/types/comfyHubTypes'

const mockCheckProfile = vi.hoisted(() => vi.fn())
const mockToastErrorHandler = vi.hoisted(() => vi.fn())
const mockHasProfile = ref<boolean | null>(true)

vi.mock(
  '@/platform/workflow/sharing/composables/useComfyHubProfileGate',
  () => ({
    useComfyHubProfileGate: () => ({
      checkProfile: mockCheckProfile,
      hasProfile: mockHasProfile
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
    workflowType: '',
    tags: [],
    thumbnailType: 'image',
    thumbnailFile: null,
    comparisonBeforeFile: null,
    comparisonAfterFile: null,
    exampleImages: [],
    selectedExampleIds: []
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
    mockCheckProfile.mockResolvedValue(true)
    mockHasProfile.value = true
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
          ComfyHubDescribeStep: {
            template: '<div data-testid="describe-step" />'
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
              '<div data-testid="publish-footer" :data-publish-disabled="isPublishDisabled"><button data-testid="publish-btn" @click="$emit(\'publish\')" /><button data-testid="next-btn" @click="$emit(\'next\')" /><button data-testid="back-btn" @click="$emit(\'back\')" /></div>',
            props: ['isFirstStep', 'isLastStep', 'isPublishDisabled'],
            emits: ['publish', 'next', 'back']
          }
        }
      }
    })
  }

  describe('handlePublish — double-click guard', () => {
    it('prevents concurrent publish calls', async () => {
      let resolveCheck!: (v: boolean) => void
      mockCheckProfile.mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolveCheck = resolve
        })
      )

      const wrapper = createWrapper()

      const publishBtn = wrapper.find('[data-testid="publish-btn"]')
      await publishBtn.trigger('click')
      await publishBtn.trigger('click')

      resolveCheck(true)
      await flushPromises()

      expect(mockCheckProfile).toHaveBeenCalledTimes(1)
      expect(onPublish).toHaveBeenCalledTimes(1)
    })
  })

  describe('handlePublish — feature flag bypass', () => {
    it('calls onPublish directly when profile gate is disabled', async () => {
      mockFlags.comfyHubProfileGateEnabled = false

      const wrapper = createWrapper()
      await wrapper.find('[data-testid="publish-btn"]').trigger('click')
      await flushPromises()

      expect(mockCheckProfile).not.toHaveBeenCalled()
      expect(onPublish).toHaveBeenCalledOnce()
    })
  })

  describe('handlePublish — profile check routing', () => {
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

    it('resets guard after checkProfile error so retry is possible', async () => {
      mockCheckProfile.mockRejectedValueOnce(new Error('Network error'))

      const wrapper = createWrapper()
      const publishBtn = wrapper.find('[data-testid="publish-btn"]')

      await publishBtn.trigger('click')
      await flushPromises()
      expect(onPublish).not.toHaveBeenCalled()

      mockCheckProfile.mockResolvedValue(true)
      await publishBtn.trigger('click')
      await flushPromises()
      expect(onPublish).toHaveBeenCalledOnce()
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
