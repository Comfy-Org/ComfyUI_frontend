import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import messages from '@/locales/en/main.json'
import SidebarCommunityButton from './SidebarCommunityButton.vue'

const mocks = vi.hoisted(() => ({ show: vi.fn() }))
vi.mock('@/platform/community/composables/useCommunityDialog', () => ({
  useCommunityDialog: () => ({ show: mocks.show })
}))

describe('Community sidebar entry', () => {
  it('opens Community from its labelled sidebar action', async () => {
    const user = userEvent.setup()
    render(SidebarCommunityButton, {
      global: {
        directives: { tooltip: {} },
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: messages }
          })
        ]
      }
    })
    const button = screen.getByRole('button', { name: 'Community' })
    expect(button).toHaveTextContent('Community')
    await user.click(button)
    expect(mocks.show).toHaveBeenCalledOnce()
  })
})
