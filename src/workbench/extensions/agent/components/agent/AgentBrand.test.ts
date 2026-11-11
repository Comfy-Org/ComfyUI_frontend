import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import type { AgentExperience } from '@/workbench/extensions/agent/experiments/chatRedesign'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import AgentBrand from './AgentBrand.vue'

function mount(experience: AgentExperience) {
  useAgentPanelStore().experience = experience
  return render(AgentBrand, {
    global: { plugins: [i18n], directives: { tooltip: {} } }
  })
}

describe('AgentBrand', () => {
  it('names the heading Comfy Agent in plain text in the classic experience', () => {
    mount('classic')

    expect(screen.getByRole('heading', { name: 'Comfy Agent' })).toBeVisible()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('shows the Comfy wordmark before the word Agent in the redesign', () => {
    mount('redesign')

    const heading = screen.getByRole('heading', { name: 'Comfy Agent' })
    const wordmark = screen.getByRole('img', { name: 'Comfy' })

    expect(heading).toHaveAttribute('id', 'agent-panel-title')
    expect(heading).toContainElement(wordmark)
    expect(heading).toHaveTextContent(/^Agent$/)
    expect(wordmark).toHaveAttribute(
      'src',
      '/assets/images/comfy-logo-wordmark.svg'
    )
  })

  it.for(['classic', 'redesign'] as const)(
    'asks to start the tour from the info button in the %s experience',
    async (experience) => {
      const { emitted } = mount(experience)

      await userEvent.click(
        screen.getByRole('button', { name: 'Take the tour' })
      )

      expect(emitted('startTour')).toHaveLength(1)
    }
  )
})
