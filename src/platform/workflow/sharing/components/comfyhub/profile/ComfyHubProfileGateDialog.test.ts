import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import ComfyHubProfileGateDialog from '@/platform/workflow/sharing/components/comfyhub/profile/ComfyHubProfileGateDialog.vue'

describe('ComfyHubProfileGateDialog', () => {
  function createWrapper(initialStep?: 'intro' | 'create') {
    return mount(ComfyHubProfileGateDialog, {
      props: {
        onComplete: vi.fn(),
        onClose: vi.fn(),
        ...(initialStep ? { initialStep } : {})
      },
      global: {
        stubs: {
          ComfyHubIntroPopover: {
            template: '<section data-testid="profile-gate-intro" />'
          },
          ComfyHubCreateProfileModal: {
            template: '<section data-testid="profile-gate-create" />'
          },
          ComfyHubProfileSuccessPopover: {
            template: '<section data-testid="profile-gate-success" />'
          },
          'comfy-hub-intro-popover': {
            template: '<section data-testid="profile-gate-intro" />'
          },
          'comfy-hub-create-profile-modal': {
            template: '<section data-testid="profile-gate-create" />'
          },
          'comfy-hub-profile-success-popover': {
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
