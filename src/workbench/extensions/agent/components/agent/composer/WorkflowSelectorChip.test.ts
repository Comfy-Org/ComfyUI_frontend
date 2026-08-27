import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { ComponentProps } from 'vue-component-type-helpers'

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
        selectWorkflowForAgent: 'Select a workflow for agent to work in',
        chooseWorkflowForChat: enMessages.agent.chooseWorkflowForChat,
        dontWorkInWorkflow: enMessages.agent.dontWorkInWorkflow,
        searchWorkflows: enMessages.agent.searchWorkflows
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
  props: Partial<ComponentProps<typeof WorkflowSelectorChip>> = {}
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
    const workflowName = within(trigger()).getByText('portrait')
    expect(trigger()).toHaveClass('flex-1', 'font-normal')
    expect(trigger()).not.toHaveClass('font-medium')
    expect(workflowName).not.toHaveClass('underline', 'decoration-solid')

    await user.hover(trigger())
    expect(
      await screen.findByRole('tooltip', { hidden: true })
    ).toHaveTextContent(enMessages.agent.changeWorkflowForChat)
    await user.unhover(trigger())
    expect(screen.queryByRole('tooltip')).toBeNull()

    await user.hover(trigger())
    await user.click(trigger())

    const items = await screen.findAllByRole('menuitemradio')
    expect(items.map((item) => item.textContent.trim())).toEqual([
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

  it('emits one selected tab path from the controlled radio group', async () => {
    const { user, emitted } = renderChip()
    await user.click(trigger())
    await user.click(await screen.findByText('upscale'))

    expect(emitted('selectTab')).toEqual([['workflows/upscale.json']])

    await user.click(trigger())
    expect(
      await screen.findByRole('menuitemradio', { checked: true })
    ).toHaveTextContent('portrait')
    expect(emitted('selectTab')).toHaveLength(1)
  })

  it('shows the choose-a-workflow placeholder without an active tab', async () => {
    const { user } = renderChip({ activeTab: null })
    const emptyTrigger = trigger()
    expect(emptyTrigger).toHaveTextContent(
      'Select a workflow for agent to work in'
    )
    expect(emptyTrigger).toHaveClass(
      'border',
      'border-white/15',
      'bg-white/4.5',
      'font-normal'
    )
    expect(emptyTrigger).not.toHaveClass('flex-1', 'font-medium')
    expect(
      screen.queryByRole('button', {
        name: enMessages.agent.dontWorkInWorkflow
      })
    ).toBeNull()

    await user.hover(trigger())
    expect(
      await screen.findByRole('tooltip', { hidden: true })
    ).toHaveTextContent(enMessages.agent.chooseWorkflowForChat)
    await user.click(trigger())
    expect(await screen.findAllByRole('menuitemradio')).toHaveLength(2)
  })

  it('detached mode has no current workflow even with an active tab', async () => {
    const { user } = renderChip({ detached: true })
    expect(trigger()).toHaveTextContent(
      'Select a workflow for agent to work in'
    )
    expect(trigger()).not.toHaveTextContent('portrait')
    expect(
      screen.queryByRole('button', {
        name: enMessages.agent.dontWorkInWorkflow
      })
    ).toBeNull()

    await user.click(trigger())
    expect(screen.queryByRole('menuitemradio', { checked: true })).toBeNull()
  })

  it('emits clear from the X button', async () => {
    const { user, emitted } = renderChip()
    const clear = screen.getByRole('button', {
      name: enMessages.agent.dontWorkInWorkflow
    })

    await user.hover(clear)
    expect(
      await screen.findByRole('tooltip', { hidden: true })
    ).toHaveTextContent(enMessages.agent.dontWorkInWorkflow)
    await user.click(clear)

    expect(emitted('clear')).toHaveLength(1)
  })

  it('delays each tooltip when moving between selector controls', async () => {
    const { user } = renderChip()
    const selector = trigger()
    const clear = screen.getByRole('button', {
      name: enMessages.agent.dontWorkInWorkflow
    })

    await user.hover(selector)
    await screen.findByRole('tooltip', { hidden: true })
    await user.unhover(selector)
    await user.hover(clear)

    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(
      await screen.findByRole('tooltip', { hidden: true })
    ).toHaveTextContent(enMessages.agent.dontWorkInWorkflow)
  })

  it('shows unsaved dots on a modified active workflow trigger and row', async () => {
    const modifiedTab = { ...tabs[0], modified: true }
    const { user } = renderChip({
      activeTab: modifiedTab,
      tabs: [modifiedTab, tabs[1]]
    })
    expect(screen.getByTestId('unsaved-dot')).toBeInTheDocument()

    await user.click(trigger())
    const row = await screen.findByRole('menuitemradio', {
      name: /portrait/
    })
    expect(within(row).getByTestId('unsaved-dot')).toBeInTheDocument()
    expect(row).toBeChecked()
  })

  it('does not show an unsaved dot for an unchanged active workflow', () => {
    renderChip()
    expect(screen.queryByTestId('unsaved-dot')).toBeNull()
  })

  it('shows an unsaved dot for an inactive unpersisted workflow', async () => {
    const unsavedTab = { ...tabs[1], isPersisted: false }
    const { user } = renderChip({ tabs: [tabs[0], unsavedTab] })

    expect(screen.queryByTestId('unsaved-dot')).toBeNull()

    await user.click(trigger())
    const row = await screen.findByRole('menuitemradio', { name: /upscale/ })
    expect(within(row).getByTestId('unsaved-dot')).toBeInTheDocument()
    expect(row).not.toBeChecked()
  })

  it('filters the tab list as the search input is typed into', async () => {
    const { user } = renderChip()
    await user.click(trigger())

    const search = await screen.findByPlaceholderText(
      enMessages.agent.searchWorkflows
    )
    await user.type(search, 'ups')

    const items = screen.getAllByRole('menuitemradio')
    expect(items.map((item) => item.textContent.trim())).toEqual(['upscale'])
  })

  it('closes the dropdown on Escape from the focused search input', async () => {
    const { user } = renderChip()
    await user.click(trigger())
    const search = await screen.findByPlaceholderText(
      enMessages.agent.searchWorkflows
    )
    expect(search).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0)
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

  it('keeps the active workflow selector usable while showing its spinner', async () => {
    const activity = useWorkflowTabActivityStore()
    activity.setEditing('workflows/portrait.json')
    const { user } = renderChip()
    const selector = trigger()

    expect(
      within(selector).getByRole('img', {
        name: enMessages.g.agentWorking
      })
    ).toBeInTheDocument()
    expect(within(selector).queryByTestId('workflow-selector-icon')).toBeNull()

    await user.click(selector)
    expect(await screen.findAllByRole('menuitemradio')).toHaveLength(2)
    await user.keyboard('{Escape}')

    activity.setEditing(null)
    expect(
      await within(selector).findByTestId('workflow-selector-icon')
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
