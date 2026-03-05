import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import ComfyHubPublishDialog from '@/platform/workflow/sharing/components/publish/ComfyHubPublishDialog.vue'

const mockFetchProfile = vi.hoisted(() => vi.fn())
const mockGoToStep = vi.hoisted(() => vi.fn())
const mockGoNext = vi.hoisted(() => vi.fn())
const mockGoBack = vi.hoisted(() => vi.fn())
const mockOpenProfileCreationStep = vi.hoisted(() => vi.fn())
const mockCloseProfileCreationStep = vi.hoisted(() => vi.fn())

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
        workflowType: '',
        tags: [],
        thumbnailType: 'image',
        thumbnailFile: null,
        comparisonBeforeFile: null,
        comparisonAfterFile: null,
        exampleImages: [],
        selectedExampleIds: []
      }),
      isFirstStep: ref(false),
      isLastStep: ref(true),
      goToStep: mockGoToStep,
      goNext: mockGoNext,
      goBack: mockGoBack,
      openProfileCreationStep: mockOpenProfileCreationStep,
      closeProfileCreationStep: mockCloseProfileCreationStep
    })
  })
)

describe('ComfyHubPublishDialog', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchProfile.mockResolvedValue(null)
  })

  function createWrapper() {
    return mount(ComfyHubPublishDialog, {
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
              '<div><button data-testid="require-profile" @click="$props.onRequireProfile()" /><button data-testid="gate-complete" @click="$props.onGateComplete()" /><button data-testid="gate-close" @click="$props.onGateClose()" /></div>',
            props: [
              'currentStep',
              'formData',
              'isFirstStep',
              'isLastStep',
              'onGoNext',
              'onGoBack',
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
    createWrapper()
    await flushPromises()

    expect(mockFetchProfile).toHaveBeenCalledWith()
  })

  it('switches to profile creation step when final-step publish requires profile', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    await wrapper.find('[data-testid="require-profile"]').trigger('click')

    expect(mockOpenProfileCreationStep).toHaveBeenCalledOnce()
  })

  it('returns to finish state after gate complete and does not auto-close', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    await wrapper.find('[data-testid="require-profile"]').trigger('click')
    await wrapper.find('[data-testid="gate-complete"]').trigger('click')

    expect(mockOpenProfileCreationStep).toHaveBeenCalledOnce()
    expect(mockCloseProfileCreationStep).toHaveBeenCalledOnce()
    expect(mockFetchProfile).toHaveBeenCalledWith({ force: true })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('returns to finish state when profile gate is closed', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    await wrapper.find('[data-testid="require-profile"]').trigger('click')
    await wrapper.find('[data-testid="gate-close"]').trigger('click')

    expect(mockOpenProfileCreationStep).toHaveBeenCalledOnce()
    expect(mockCloseProfileCreationStep).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
  })
})
