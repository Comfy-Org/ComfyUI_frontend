import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { i18n } from '@/i18n'

import AgentCostNotice from './AgentCostNotice.vue'

vi.mock(import('@/composables/auth/useCurrentUser'))

function mount() {
  vi.mocked(useCurrentUser).mockReturnValue({
    ...useCurrentUser(),
    isAuthInitialized: computed(() => true),
    resolvedUserInfo: computed(() => ({ id: 'cost-notice-user' }))
  })
  return render(AgentCostNotice, { global: { plugins: [i18n] } })
}

describe('AgentCostNotice', () => {
  it('explains paid use and links to the cost details', () => {
    mount()

    expect(
      screen.getByRole('note', { name: 'Agent cost notice' })
    ).toHaveTextContent(
      'Comfy Agent uses your workspace credits. Costs vary by model and request.'
    )
    expect(screen.getByRole('link', { name: 'Learn more' })).toHaveAttribute(
      'href',
      'https://docs.comfy.org/agent-tools/in-app-agent?utm_source=comfyui_local&utm_medium=product&utm_campaign=agent_panel#what-it-costs'
    )
  })

  it('stays dismissed for the account that dismissed it', async () => {
    const first = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('note')).toBeNull()
    first.unmount()

    mount()
    expect(screen.queryByRole('note')).toBeNull()
  })
})
