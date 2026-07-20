import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import WorkflowSelectorChip from './WorkflowSelectorChip.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { agent: { switchWorkflow: enMessages.agent.switchWorkflow } }
  }
})

const tabs = [
  { path: 'workflows/portrait.json', name: 'portrait' },
  { path: 'workflows/upscale.json', name: 'upscale' }
]

function renderChip(
  activeTab: { path: string; name: string } | null = tabs[0]
) {
  const user = userEvent.setup()
  const emitted = render(WorkflowSelectorChip, {
    props: { activeTab, tabs },
    global: { plugins: [i18n] }
  })
  return { user, ...emitted }
}

describe('WorkflowSelectorChip', () => {
  it('renders nothing without an active tab', () => {
    renderChip(null)
    expect(
      screen.queryByRole('button', {
        name: enMessages.agent.switchWorkflow
      })
    ).toBeNull()
  })

  it('names the active workflow on the trigger and lists every open tab', async () => {
    const { user } = renderChip()
    const trigger = screen.getByRole('button', {
      name: enMessages.agent.switchWorkflow
    })
    expect(trigger).toHaveTextContent('portrait')

    await user.click(trigger)

    const items = await screen.findAllByRole('menuitemradio')
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'portrait',
      'upscale'
    ])
  })

  it('exposes only the active tab as the checked menu item', async () => {
    const { user } = renderChip()
    await user.click(
      screen.getByRole('button', { name: enMessages.agent.switchWorkflow })
    )

    const checked = await screen.findByRole('menuitemradio', { checked: true })
    expect(checked).toHaveTextContent('portrait')
    expect(
      screen.getByRole('menuitemradio', { checked: false })
    ).toHaveTextContent('upscale')
  })

  it('emits the selected tab path', async () => {
    const { user, emitted } = renderChip()
    await user.click(
      screen.getByRole('button', { name: enMessages.agent.switchWorkflow })
    )
    await user.click(await screen.findByText('upscale'))

    expect(emitted('selectTab')).toEqual([['workflows/upscale.json']])
  })
})
