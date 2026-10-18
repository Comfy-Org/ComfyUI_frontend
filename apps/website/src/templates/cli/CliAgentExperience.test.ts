import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import CliAgentConcept from './CliAgentExperience.vue'
const names = [
  'Claude Code',
  'Codex',
  'Cursor',
  'Gemini CLI',
  'OpenClaw',
  'Hermes',
  'Terminal',
  'CI / Headless'
]
describe.for(['cloud', 'local'])('CLI concept %s', (connection) => {
  it.for(names)('%s has matching commands and copy payloads', async (name) => {
    const user = userEvent.setup()
    render(CliAgentConcept)
    await user.click(screen.getByRole('tab', { name }))
    await user.click(screen.getByRole('button', { name: `SET UP ${name}` }))
    const dialog = within(screen.getByRole('dialog'))
    if (connection === 'local') {
      await user.click(dialog.getByRole('button', { name: 'Local' }))
      await user.click(dialog.getByRole('tab', { name }))
    }
    const copy = dialog.getAllByRole('button', { name: 'Copy' })
    // Field text is the actual payload; copy feedback must not alter it.
    for (let i = 0; i < copy.length; i++) {
      await user.click(copy[i])
      const value = await navigator.clipboard.readText()
      expect(value).toBeTruthy()
      if (i === 0 && !['Terminal', 'CI / Headless'].includes(name)) {
        expect(value).toContain(`comfy setup --where ${connection}`)
        expect(value).toContain('comfy skills install')
      }
    }
    expect(copy.length).toBeGreaterThan(0)
    if (name === 'CI / Headless') {
      expect(
        dialog.getByText(
          `comfy setup --where ${connection}${connection === 'cloud' ? ' --api-key comfyui-... --non-interactive' : ' --non-interactive'}`
        )
      ).toBeVisible()
      if (connection === 'local')
        expect(dialog.queryByText('2. Run a command')).toBeNull()
    }
    const selected = within(
      dialog.getByRole('tablist', { name: 'Choose your setup client' })
    ).getByRole('tab', { selected: true })
    expect(dialog.getByRole('tabpanel', { name })).toHaveAttribute(
      'id',
      selected.getAttribute('aria-controls')
    )
  })
})

describe('approved setup flow corrections', () => {
  it.for(['Terminal', 'CI / Headless'])(
    '%s exposes one setup action',
    async (name) => {
      const user = userEvent.setup()
      render(CliAgentConcept)
      await user.click(screen.getByRole('tab', { name }))
      expect(
        screen.queryByRole('button', { name: 'INSTALL MANUALLY' })
      ).toBeNull()
      await user.click(screen.getByRole('button', { name: `SET UP ${name}` }))
      expect(
        screen.getByRole('dialog', {
          name: 'Set up Comfy CLI in your terminal'
        })
      ).toBeVisible()
      expect(screen.getByText('2. Run a command')).toBeVisible()
    }
  )
  it('keeps manual Cloud and Local instructions terminal-oriented and can return to agent setup', async () => {
    const user = userEvent.setup()
    render(CliAgentConcept)
    await user.click(screen.getByRole('tab', { name: 'Codex' }))
    await user.click(screen.getByRole('button', { name: 'INSTALL MANUALLY' }))
    const dialog = within(
      screen.getByRole('dialog', { name: 'Set up Comfy CLI in your terminal' })
    )
    expect(
      dialog.getByText(
        'Complete browser sign-in if prompted, then run Comfy CLI commands in your terminal.'
      )
    ).toBeVisible()
    expect(dialog.queryByText(/then ask Codex/)).toBeNull()
    await user.click(dialog.getByRole('button', { name: 'Local' }))
    await user.click(dialog.getByRole('tab', { name: 'Codex' }))
    expect(
      dialog.getByText(
        'Run Comfy CLI commands against your local ComfyUI installation.'
      )
    ).toBeVisible()
    await user.click(dialog.getByRole('tab', { name: 'Use agent' }))
    expect(screen.getByRole('dialog', { name: 'Set up Codex' })).toBeVisible()
    expect(
      dialog.getByText(
        'Ask Codex to run a workflow on your local ComfyUI installation.'
      )
    ).toBeVisible()
  })
  it('places the CI API-key prerequisite before the command that needs it', async () => {
    const user = userEvent.setup()
    render(CliAgentConcept)
    await user.click(screen.getByRole('tab', { name: 'CI / Headless' }))
    await user.click(
      screen.getByRole('button', { name: 'SET UP CI / Headless' })
    )
    const dialog = within(screen.getByRole('dialog'))
    const key = dialog.getByRole('link', { name: 'Get your API key' })
    const command = dialog.getByText(
      'comfy setup --where cloud --api-key comfyui-... --non-interactive'
    )
    expect(key).toAppearBefore(command)
  })
})

it('offers keyboard-accessible setup method tabs with matching panels', async () => {
  const user = userEvent.setup()
  render(CliAgentConcept)
  await user.click(screen.getByRole('button', { name: 'SET UP Claude Code' }))
  const dialog = within(screen.getByRole('dialog'))
  const agent = dialog.getByRole('tab', { name: 'Use agent' })
  await user.click(agent)
  await user.keyboard('{ArrowRight}{Enter}')
  const manual = dialog.getByRole('tab', { name: 'Manual' })
  expect(manual).toHaveAttribute('aria-selected', 'true')
  expect(dialog.getByRole('tabpanel', { name: 'Manual' })).toBeVisible()
  expect(
    screen.getByRole('dialog', { name: 'Set up Comfy CLI in your terminal' })
  ).toBeVisible()
  await user.click(agent)
  expect(
    screen.getByRole('dialog', { name: 'Set up Claude Code' })
  ).toBeVisible()
  const close = dialog.getByRole('button', { name: 'Close setup' })
  expect(close).toHaveAttribute('data-variant', 'outline')
  await user.click(close)
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('preserves the same client across Cloud and Local changes', async () => {
  const user = userEvent.setup()
  render(CliAgentConcept)
  await user.click(screen.getByRole('button', { name: 'SET UP Claude Code' }))
  const dialog = within(screen.getByRole('dialog'))
  await user.click(dialog.getByRole('button', { name: 'Local' }))
  await user.click(dialog.getByRole('tab', { name: 'Hermes' }))
  await user.click(dialog.getByRole('button', { name: 'Comfy Cloud' }))
  expect(dialog.getByRole('tab', { name: 'Hermes' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await user.click(dialog.getByRole('button', { name: 'Local' }))
  expect(dialog.getByRole('tab', { name: 'Hermes' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
})
