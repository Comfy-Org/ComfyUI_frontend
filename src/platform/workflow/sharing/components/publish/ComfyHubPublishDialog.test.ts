import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ComfyHubPublishDialog from '@/platform/workflow/sharing/components/publish/ComfyHubPublishDialog.vue'

const mockFetchApi = vi.hoisted(() => vi.fn())

vi.mock('@/scripts/api', () => ({
  api: { fetchApi: mockFetchApi }
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    resolvedUserInfo: { value: { id: 'user-a' } }
  })
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    toastErrorHandler: vi.fn()
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: { filename: 'test-workflow' }
  })
}))

// Import after mocks so real composables pick up the mocked dependencies
const { useComfyHubProfileGate } =
  await import('@/platform/workflow/sharing/composables/useComfyHubProfileGate')

const mockProfile = {
  username: 'testuser',
  name: 'Test User',
  description: 'A test profile'
}

function mockSuccessResponse(data?: unknown) {
  return {
    ok: true,
    json: async () => data ?? mockProfile
  } as Response
}

describe('ComfyHubPublishDialog', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchApi.mockResolvedValue(mockSuccessResponse())

    // Reset module-level singleton state
    const gate = useComfyHubProfileGate()
    gate.hasProfile.value = null
    gate.profile.value = null
    gate.isCheckingProfile.value = false
    gate.isFetchingProfile.value = false
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
              '<div :data-step="$props.currentStep"><button data-testid="require-profile" @click="$props.onRequireProfile()" /><button data-testid="gate-complete" @click="$props.onGateComplete()" /><button data-testid="gate-close" @click="$props.onGateClose()" /></div>',
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

    expect(mockFetchApi).toHaveBeenCalledWith('/hub/profile')
  })

  it('switches to profile creation step when final-step publish requires profile', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.find('[data-step]').attributes('data-step')).toBe('describe')

    await wrapper.find('[data-testid="require-profile"]').trigger('click')

    expect(wrapper.find('[data-step]').attributes('data-step')).toBe(
      'profileCreation'
    )
  })

  it('returns to finish state after gate complete and does not auto-close', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    await wrapper.find('[data-testid="require-profile"]').trigger('click')
    expect(wrapper.find('[data-step]').attributes('data-step')).toBe(
      'profileCreation'
    )

    mockFetchApi.mockClear()
    await wrapper.find('[data-testid="gate-complete"]').trigger('click')

    expect(wrapper.find('[data-step]').attributes('data-step')).toBe('finish')
    expect(mockFetchApi).toHaveBeenCalledWith('/hub/profile')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('returns to finish state when profile gate is closed', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    await wrapper.find('[data-testid="require-profile"]').trigger('click')
    expect(wrapper.find('[data-step]').attributes('data-step')).toBe(
      'profileCreation'
    )

    await wrapper.find('[data-testid="gate-close"]').trigger('click')

    expect(wrapper.find('[data-step]').attributes('data-step')).toBe('finish')
    expect(onClose).not.toHaveBeenCalled()
  })
})
