import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import GlobalToast from './GlobalToast.vue'

const { removeToast, viewErrorsInGraph } = vi.hoisted(() => ({
  removeToast: vi.fn(),
  viewErrorsInGraph: vi.fn()
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: vi.fn(),
    remove: removeToast,
    removeAllGroups: vi.fn()
  })
}))

vi.mock('@/composables/useViewErrorsInGraph', () => ({
  useViewErrorsInGraph: () => ({ viewErrorsInGraph })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: vi.fn() })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({
    messagesToAdd: [],
    messagesToRemove: [],
    removeAllRequested: false
  })
}))

const policyMessage = {
  severity: 'error',
  summary: 'Partner nodes',
  detail: 'This node has been disabled by your team admin.',
  group: 'partner-node-policy'
}

const ToastStub = defineComponent({
  props: { group: String },
  setup() {
    return { policyMessage }
  },
  template: `
    <div v-if="group === 'partner-node-policy'">
      <slot name="message" :message="policyMessage" />
    </div>
  `
})

describe('GlobalToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens the Errors tab from a partner policy toast', async () => {
    const user = userEvent.setup()
    render(GlobalToast, {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: {
              en: { rightSidePanel: { viewDetails: 'View details' } }
            }
          })
        ],
        stubs: { Toast: ToastStub }
      }
    })

    await user.click(screen.getByRole('button', { name: 'View details' }))

    expect(removeToast).toHaveBeenCalledWith(policyMessage)
    expect(viewErrorsInGraph).toHaveBeenCalledOnce()
  })
})
