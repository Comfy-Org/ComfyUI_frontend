import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ComfyHubPublishDialog from '@/platform/workflow/sharing/components/publish/ComfyHubPublishDialog.vue'
import type { ComfyHubProfile } from '@/schemas/apiSchema'

const mockFetchApi = vi.hoisted(() => vi.fn())
const mockToastErrorHandler = vi.hoisted(() => vi.fn())
const mockResolvedUserInfo = vi.hoisted(() => ({
  value: { id: 'user-a' }
}))

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: mockFetchApi
  }
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    resolvedUserInfo: mockResolvedUserInfo
  })
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    toastErrorHandler: mockToastErrorHandler
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: { filename: 'test-workflow' }
  })
}))

const mockProfile: ComfyHubProfile = {
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

function mockErrorResponse(status = 404) {
  return {
    ok: false,
    status,
    json: async () => ({ message: 'Not found' })
  } as Response
}

// Reset module-level singleton state in useComfyHubProfileGate between tests
async function resetProfileGateSingleton() {
  const { useComfyHubProfileGate } =
    await import('@/platform/workflow/sharing/composables/useComfyHubProfileGate')
  const gate = useComfyHubProfileGate()
  gate.hasProfile.value = null
  gate.profile.value = null
  gate.isCheckingProfile.value = false
  gate.isFetchingProfile.value = false
}

describe('ComfyHubPublishDialog', () => {
  const onClose = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    mockResolvedUserInfo.value = { id: 'user-a' }
    mockFetchApi.mockResolvedValue(mockErrorResponse())
    await resetProfileGateSingleton()
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
              '<div><button data-testid="require-profile" @click="$props.onRequireProfile()" /><button data-testid="gate-complete" @click="$props.onGateComplete()" /><button data-testid="gate-close" @click="$props.onGateClose()" /><span data-testid="current-step">{{ $props.currentStep }}</span></div>',
            props: [
              'currentStep',
              'formData',
              'isFirstStep',
              'isLastStep',
              'onGoNext',
              'onGoBack',
              'onRequireProfile',
              'onGateComplete',
              'onGateClose',
              'onUpdateFormData',
              'onPublish'
            ]
          }
        }
      }
    })
  }

  it('prefetches profile on mount via real composable', async () => {
    createWrapper()
    await flushPromises()

    expect(mockFetchApi).toHaveBeenCalledWith('/hub/profile')
  })

  it('starts on the describe step with real wizard composable', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.find('[data-testid="current-step"]').text()).toBe('describe')
  })

  it('switches to profileCreation step when require-profile is triggered', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    await wrapper.find('[data-testid="require-profile"]').trigger('click')

    expect(wrapper.find('[data-testid="current-step"]').text()).toBe(
      'profileCreation'
    )
  })

  it('returns to finish step and re-fetches profile after gate complete', async () => {
    mockFetchApi.mockResolvedValue(mockSuccessResponse())
    const wrapper = createWrapper()
    await flushPromises()

    await wrapper.find('[data-testid="require-profile"]').trigger('click')
    expect(wrapper.find('[data-testid="current-step"]').text()).toBe(
      'profileCreation'
    )

    await wrapper.find('[data-testid="gate-complete"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="current-step"]').text()).toBe('finish')
    // Initial prefetch + force re-fetch after gate complete
    expect(mockFetchApi).toHaveBeenCalledTimes(2)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('returns to finish step when profile gate is closed', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    await wrapper.find('[data-testid="require-profile"]').trigger('click')
    expect(wrapper.find('[data-testid="current-step"]').text()).toBe(
      'profileCreation'
    )

    await wrapper.find('[data-testid="gate-close"]').trigger('click')

    expect(wrapper.find('[data-testid="current-step"]').text()).toBe('finish')
    expect(onClose).not.toHaveBeenCalled()
  })
})
