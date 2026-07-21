import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import WorkflowSelectorChip from './WorkflowSelectorChip.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      agent: {
        switchWorkflow: enMessages.agent.switchWorkflow,
        changeWorkflowForChat: enMessages.agent.changeWorkflowForChat,
        chooseWorkflow: enMessages.agent.chooseWorkflow,
        dontWorkInWorkflow: enMessages.agent.dontWorkInWorkflow,
        searchWorkflows: enMessages.agent.searchWorkflows,
        selectWorkflowToGenerate: enMessages.agent.selectWorkflowToGenerate
      },
      g: {
        agentWorking: enMessages.g.agentWorking,
        agentModified: enMessages.g.agentModified
      }
    }
  }
})

const tabs = [
  { path: 'workflows/portrait.json', name: 'portrait' },
  { path: 'workflows/upscale.json', name: 'upscale' }
]

let pinia: Pinia

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

function renderChip(
  props: Partial<{
    activeTab: { path: string; name: string; modified?: boolean } | null
    tabs: typeof tabs
    detached: boolean
  }> = {}
) {
  const user = userEvent.setup()
  const emitted = render(WorkflowSelectorChip, {
    props: { activeTab: tabs[0], tabs, ...props },
    global: { plugins: [i18n, pinia] }
  })
  return { user, ...emitted }
}

const trigger = () =>
  screen.getByRole('button', { name: enMessages.agent.switchWorkflow })

describe('WorkflowSelectorChip', () => {
  it('names the active workflow on the trigger and lists every open tab', async () => {
    const { user } = renderChip()
    expect(trigger()).toHaveTextContent('portrait')

    await user.click(trigger())

    const items = await screen.findAllByRole('menuitemradio')
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'portrait',
      'upscale'
    ])
  })

  it('exposes only the active tab as the checked menu item', async () => {
    const { user } = renderChip()
    await user.click(trigger())

    const checked = await screen.findByRole('menuitemradio', { checked: true })
    expect(checked).toHaveTextContent('portrait')
    expect(
      screen.getByRole('menuitemradio', { checked: false })
    ).toHaveTextContent('upscale')
  })

  it('emits the selected tab path', async () => {
    const { user, emitted } = renderChip()
    await user.click(trigger())
    await user.click(await screen.findByText('upscale'))

    expect(emitted('selectTab')).toEqual([['workflows/upscale.json']])
  })

  it('shows the choose-a-workflow placeholder without an active tab', async () => {
    const { user } = renderChip({ activeTab: null })
    expect(trigger()).toHaveTextContent(enMessages.agent.chooseWorkflow)
    expect(
      screen.queryByRole('button', {
        name: enMessages.agent.dontWorkInWorkflow
      })
    ).toBeNull()

    await user.click(trigger())
    expect(await screen.findAllByRole('menuitemradio')).toHaveLength(2)
  })

  it('detached mode shows the placeholder even with an active tab', () => {
    renderChip({ detached: true })
    expect(trigger()).toHaveTextContent(enMessages.agent.chooseWorkflow)
    expect(trigger()).not.toHaveTextContent('portrait')
  })

  it('emits clear from the X button', async () => {
    const { user, emitted } = renderChip()
    await user.click(
      screen.getByRole('button', { name: enMessages.agent.dontWorkInWorkflow })
    )
    expect(emitted('clear')).toHaveLength(1)
  })

  it('shows the unsaved dot only for a modified active workflow', () => {
    renderChip({ activeTab: { ...tabs[0], modified: true } })
    expect(screen.getByTestId('unsaved-dot')).toBeInTheDocument()
  })

  it('filters the tab list as the search input is typed into', async () => {
    const { user } = renderChip()
    await user.click(trigger())

    const search = await screen.findByPlaceholderText(
      enMessages.agent.searchWorkflows
    )
    await user.type(search, 'ups')

    const items = screen.getAllByRole('menuitemradio')
    expect(items.map((item) => item.textContent?.trim())).toEqual(['upscale'])
  })

  it('marks the row the agent is editing with a spinner', async () => {
    useWorkflowTabActivityStore().setEditing('workflows/upscale.json')
    const { user } = renderChip()
    await user.click(trigger())

    const row = await screen.findByRole('menuitemradio', { name: /upscale/ })
    expect(
      within(row).getByRole('img', { name: enMessages.g.agentWorking })
    ).toBeInTheDocument()
  })

  it('marks an unseen agent-modified row with the blue dot', async () => {
    useWorkflowTabActivityStore().markModified('workflows/upscale.json')
    const { user } = renderChip()
    await user.click(trigger())

    const row = await screen.findByRole('menuitemradio', { name: /upscale/ })
    expect(
      within(row).getByRole('img', { name: enMessages.g.agentModified })
    ).toBeInTheDocument()
  })
})
