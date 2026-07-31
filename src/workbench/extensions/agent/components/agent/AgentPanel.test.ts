import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import AgentPanel from './AgentPanel.vue'

const historyGroups = {
  current: [],
  today: [],
  yesterday: [],
  earlier: []
}

function mount(isMaximized = false) {
  return render(AgentPanel, {
    props: { entries: [], historyGroups, isMaximized },
    global: {
      plugins: [i18n],
      stubs: {
        Composer: true,
        EmptyState: true,
        PanelHeader: true
      }
    }
  })
}

describe('AgentPanel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the minimized run notice and disclaimer by default', () => {
    mount()

    expect(
      screen.getByText(
        "The agent can modify the graph. You'll need to click run to execute the workflow."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('The AI agent can make mistakes')
    ).toBeInTheDocument()
  })

  it('shows the expanded run notice and disclaimer when maximized', () => {
    mount(true)

    expect(
      screen.getByText(
        "The agent can modify your workflow. You'll need to click run to execute."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'The AI agent can make mistakes. Double check your response.'
      )
    ).toBeInTheDocument()
  })
})
