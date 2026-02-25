import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import ComfyHubPublishDialog from '@/platform/workflow/sharing/components/comfyhub/publish/ComfyHubPublishDialog.vue'

const mockFlags = vi.hoisted(() => ({
  comfyHubProfileGateEnabled: true
}))
const mockCheckProfile = vi.hoisted(() => vi.fn<() => Promise<boolean>>())
const mockGoToStep = vi.hoisted(() => vi.fn())
const mockGoNext = vi.hoisted(() => vi.fn())
const mockGoBack = vi.hoisted(() => vi.fn())

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: mockFlags
  })
}))

vi.mock(
  '@/platform/workflow/sharing/composables/useComfyHubProfileGate',
  () => ({
    useComfyHubProfileGate: () => ({
      checkProfile: mockCheckProfile
    })
  })
)

vi.mock(
  '@/platform/workflow/sharing/composables/useComfyHubPublishWizard',
  () => ({
    useComfyHubPublishWizard: () => ({
      currentStep: ref('describe'),
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
      isFirstStep: ref(true),
      isLastStep: ref(false),
      goToStep: mockGoToStep,
      goNext: mockGoNext,
      goBack: mockGoBack
    })
  })
)

describe('ComfyHubPublishDialog', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFlags.comfyHubProfileGateEnabled = true
    mockCheckProfile.mockResolvedValue(true)
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
          ComfyHubPublishWizardPanel: {
            template:
              '<div data-testid="publish-panel-state">{{ $props.publishPanelState }}</div>',
            props: [
              'publishPanelState',
              'currentStep',
              'formData',
              'isFirstStep',
              'isLastStep',
              'onGoNext',
              'onGoBack',
              'onCancel'
            ]
          },
          'comfy-hub-publish-wizard-panel': {
            template:
              '<div data-testid="publish-panel-state">{{ $props.publishPanelState }}</div>',
            props: [
              'publishPanelState',
              'currentStep',
              'formData',
              'isFirstStep',
              'isLastStep',
              'onGoNext',
              'onGoBack',
              'onCancel'
            ]
          }
        }
      }
    })
  }

  it('shows publish wizard immediately when profile gate is disabled', async () => {
    mockFlags.comfyHubProfileGateEnabled = false
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.find('[data-testid="publish-panel-state"]').text()).toBe(
      'publishWizard'
    )
    expect(mockCheckProfile).not.toHaveBeenCalled()
  })

  it('shows gate flow when profile is missing', async () => {
    mockCheckProfile.mockResolvedValueOnce(false)
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.find('[data-testid="publish-panel-state"]').text()).toBe(
      'gateFlow'
    )
  })

  it('shows publish wizard when profile exists', async () => {
    mockCheckProfile.mockResolvedValueOnce(true)
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.find('[data-testid="publish-panel-state"]').text()).toBe(
      'publishWizard'
    )
  })

  it('closes dialog when access check fails', async () => {
    mockCheckProfile.mockRejectedValueOnce(new Error('Network error'))
    createWrapper()
    await flushPromises()

    expect(onClose).toHaveBeenCalledOnce()
  })
})
