import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import AgentSidebar from './AgentSidebar.vue'

const groups: HistoryGroups = {
  current: [],
  today: [
    {
      id: 'astronaut',
      title: 'Astronaut Character',
      updatedAt: 1,
      titleSource: 'server',
      workflowId: 'wf-astronaut'
    }
  ],
  yesterday: [],
  earlier: []
}

describe('AgentSidebar chat rows', () => {
  it('opens a chat from the workflow name under its title', async () => {
    const view = render(AgentSidebar, {
      props: {
        mode: 'expanded',
        groups,
        workflowNames: new Map([['wf-astronaut', 'Unsaved Workflow']])
      },
      global: { plugins: [i18n], directives: { tooltip: {} } }
    })

    await userEvent.click(screen.getByText('Unsaved Workflow'))

    expect(view.emitted().select).toEqual([['astronaut']])
  })
})
