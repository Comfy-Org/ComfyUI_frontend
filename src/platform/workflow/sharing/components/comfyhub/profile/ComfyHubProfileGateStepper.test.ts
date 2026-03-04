import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import ComfyHubProfileGateStepper from '@/platform/workflow/sharing/components/comfyhub/profile/ComfyHubProfileGateStepper.vue'

describe('ComfyHubProfileGateStepper', () => {
  function createWrapper(initialStep?: 'intro' | 'create') {
    return mount(ComfyHubProfileGateStepper, {
      props: {
        onComplete: vi.fn(),
        onClose: vi.fn(),
        ...(initialStep ? { initialStep } : {})
      },
      global: {
        stubs: {
          ComfyHubPublishIntroPanel: {
            template: '<section data-testid="profile-gate-intro" />'
          },
          ComfyHubCreateProfileForm: {
            template: '<section data-testid="profile-gate-create" />'
          },
          ComfyHubProfileSuccessPanel: {
            template: '<section data-testid="profile-gate-success" />'
          },
          'comfy-hub-publish-intro-panel': {
            template: '<section data-testid="profile-gate-intro" />'
          },
          'comfy-hub-create-profile-form': {
            template: '<section data-testid="profile-gate-create" />'
          },
          'comfy-hub-profile-success-panel': {
            template: '<section data-testid="profile-gate-success" />'
          }
        }
      }
    })
  }

  it('starts at intro step by default', () => {
    const wrapper = createWrapper()

    expect(wrapper.find('[data-testid="profile-gate-intro"]').exists()).toBe(
      true
    )
    expect(wrapper.find('[data-testid="profile-gate-create"]').exists()).toBe(
      false
    )
  })

  it('can start directly at create step', async () => {
    const wrapper = createWrapper('create')
    await nextTick()

    expect(wrapper.find('[data-testid="profile-gate-intro"]').exists()).toBe(
      false
    )
    expect(wrapper.find('[data-testid="profile-gate-create"]').exists()).toBe(
      true
    )
  })
})
