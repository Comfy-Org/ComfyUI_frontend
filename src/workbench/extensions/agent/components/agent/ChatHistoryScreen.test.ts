import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { DirectiveBinding } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { i18n } from '@/i18n'
import type { HistoryGroups } from '../../stores/agent/agentChatHistoryStore'

import ChatHistoryScreen from './ChatHistoryScreen.vue'

const emptyGroups: HistoryGroups = {
  current: [],
  today: [],
  yesterday: [],
  earlier: []
}

const tooltipMounted = vi.fn(
  (_element: HTMLElement, _binding: DirectiveBinding) => {}
)

function renderScreen() {
  return render(ChatHistoryScreen, {
    props: { groups: emptyGroups },
    global: {
      plugins: [i18n],
      directives: { tooltip: { mounted: tooltipMounted } }
    }
  })
}

describe('ChatHistoryScreen', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
    tooltipMounted.mockClear()
  })

  it('renders the 16px left chevron from the design', () => {
    renderScreen()

    const back = screen.getByRole('button', { name: 'Chat History' })
    // eslint-disable-next-line testing-library/no-node-access -- Iconify icons have no accessible role
    const icon = back.querySelector('.icon-\\[lucide--chevron-left\\]')

    expect(icon).toHaveClass('size-4')
  })

  it('uses the shared tooltip config with the exact back copy', () => {
    renderScreen()

    const binding = tooltipMounted.mock.calls[0][1]
    expect(binding.value).toEqual(buildTooltipConfig('Back to previous chat'))
    expect(binding.modifiers).toEqual({ bottom: true })
  })

  it('emits back when the back control is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen()

    await user.click(screen.getByRole('button', { name: 'Chat History' }))

    expect(emitted().back).toEqual([[]])
  })
})
