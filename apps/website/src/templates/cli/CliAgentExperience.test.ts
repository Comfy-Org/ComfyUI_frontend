import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import CliAgentExperience from './CliAgentExperience.vue'
import { translationsFor } from '@/i18n/translations'
import { externalLinks } from '@/config/routes'
import {
  captureCliClientTabClick,
  captureCliConnectionTabClick
} from '@/scripts/posthog'

vi.mock(import('@/scripts/posthog'))
const install = 'pip install comfy-cli'
const cloudPrompt =
  "Set up the Comfy CLI for me: pip install comfy-cli,\nthen comfy setup --where cloud,\nthen comfy skills install.\nFollow the guide at https://docs.comfy.org/agent-tools/cli.md and tell me when it's ready."
const localPrompt =
  "Set up the Comfy CLI for me: pip install comfy-cli,\nthen comfy setup --where local,\nthen comfy skills install.\nFollow the guide at https://docs.comfy.org/agent-tools/cli.md and tell me when it's ready."
const cases = [
  {
    client: 'Claude Code',
    connection: 'cloud',
    connectionLabel: 'Comfy Cloud',
    expectedPayloads: [cloudPrompt]
  },
  {
    client: 'Codex',
    connection: 'cloud',
    connectionLabel: 'Comfy Cloud',
    expectedPayloads: [cloudPrompt]
  },
  {
    client: 'Cursor',
    connection: 'cloud',
    connectionLabel: 'Comfy Cloud',
    expectedPayloads: [cloudPrompt]
  },
  {
    client: 'Gemini CLI',
    connection: 'cloud',
    connectionLabel: 'Comfy Cloud',
    expectedPayloads: [cloudPrompt]
  },
  {
    client: 'OpenClaw',
    connection: 'cloud',
    connectionLabel: 'Comfy Cloud',
    expectedPayloads: [cloudPrompt]
  },
  {
    client: 'Hermes',
    connection: 'cloud',
    connectionLabel: 'Comfy Cloud',
    expectedPayloads: [cloudPrompt]
  },
  {
    client: 'Terminal',
    connection: 'cloud',
    connectionLabel: 'Comfy Cloud',
    expectedPayloads: [
      install,
      'comfy setup --where cloud\ncomfy skills install',
      'comfy generate nano-banana --prompt "a watercolor of a sleeping fox" --download fox.png'
    ]
  },
  {
    client: 'CI / Headless',
    connection: 'cloud',
    connectionLabel: 'Comfy Cloud',
    expectedPayloads: [
      install,
      'comfy setup --where cloud --api-key comfyui-... --non-interactive',
      'comfy run --workflow my_workflow.json --wait | comfy download'
    ]
  },
  {
    client: 'Claude Code',
    connection: 'local',
    connectionLabel: 'Local',
    expectedPayloads: [localPrompt]
  },
  {
    client: 'Terminal',
    connection: 'local',
    connectionLabel: 'Local',
    expectedPayloads: [
      install,
      'comfy setup --where local\ncomfy skills install',
      'comfy launch'
    ]
  },
  {
    client: 'CI / Headless',
    connection: 'local',
    connectionLabel: 'Local',
    expectedPayloads: [install, 'comfy setup --where local --non-interactive']
  }
] as const

async function openClientSetup(client: string, connectionLabel: string) {
  const user = userEvent.setup()
  render(CliAgentExperience)
  await user.click(screen.getByRole('tab', { name: client }))
  await user.click(screen.getByRole('button', { name: `SET UP ${client}` }))
  const dialog = within(screen.getByRole('dialog'))
  await user.click(dialog.getByRole('button', { name: connectionLabel }))
  return { user, dialog }
}

it.for(cases.filter((row) => row.expectedPayloads.length === 1))(
  '$client / $connection copies all expected payloads',
  async ({ client, connectionLabel, expectedPayloads }) => {
    const { user, dialog } = await openClientSetup(client, connectionLabel)
    const buttons = dialog.getAllByRole('button', { name: 'Copy' })
    expect(buttons).toHaveLength(1)
    await user.click(buttons[0])
    const payload0 = await navigator.clipboard.readText()
    expect([payload0]).toEqual(expectedPayloads)
    const selected = within(
      dialog.getByRole('tablist', { name: 'Choose your setup client' })
    ).getByRole('tab', { selected: true })
    expect(dialog.getByRole('tabpanel', { name: client })).toHaveAttribute(
      'id',
      selected.getAttribute('aria-controls')
    )
  }
)

it.for(cases.filter((row) => row.expectedPayloads.length === 2))(
  '$client / $connection copies all expected payloads',
  async ({ client, connectionLabel, expectedPayloads }) => {
    const { user, dialog } = await openClientSetup(client, connectionLabel)
    const buttons = dialog.getAllByRole('button', { name: 'Copy' })
    expect(buttons).toHaveLength(2)
    await user.click(buttons[0])
    const payload0 = await navigator.clipboard.readText()
    await user.click(buttons[1])
    const payload1 = await navigator.clipboard.readText()
    expect([payload0, payload1]).toEqual(expectedPayloads)
    const selected = within(
      dialog.getByRole('tablist', { name: 'Choose your setup client' })
    ).getByRole('tab', { selected: true })
    expect(dialog.getByRole('tabpanel', { name: client })).toHaveAttribute(
      'id',
      selected.getAttribute('aria-controls')
    )
  }
)

it.for(cases.filter((row) => row.expectedPayloads.length === 3))(
  '$client / $connection copies all expected payloads',
  async ({ client, connectionLabel, expectedPayloads }) => {
    const { user, dialog } = await openClientSetup(client, connectionLabel)
    const buttons = dialog.getAllByRole('button', { name: 'Copy' })
    expect(buttons).toHaveLength(3)
    await user.click(buttons[0])
    const payload0 = await navigator.clipboard.readText()
    await user.click(buttons[1])
    const payload1 = await navigator.clipboard.readText()
    await user.click(buttons[2])
    const payload2 = await navigator.clipboard.readText()
    expect([payload0, payload1, payload2]).toEqual(expectedPayloads)
    const selected = within(
      dialog.getByRole('tablist', { name: 'Choose your setup client' })
    ).getByRole('tab', { selected: true })
    expect(dialog.getByRole('tabpanel', { name: client })).toHaveAttribute(
      'id',
      selected.getAttribute('aria-controls')
    )
  }
)

it('omits a run step for local CI setup', async () => {
  const user = userEvent.setup()
  render(CliAgentExperience)
  await user.click(screen.getByRole('tab', { name: 'CI / Headless' }))
  await user.click(screen.getByRole('button', { name: 'SET UP CI / Headless' }))
  const dialog = within(screen.getByRole('dialog'))
  await user.click(dialog.getByRole('button', { name: 'Local' }))
  expect(
    dialog.getByText('comfy setup --where local --non-interactive')
  ).toBeVisible()
  expect(dialog.queryByText('2. Run a command')).toBeNull()
})

describe('approved setup flow corrections', () => {
  it.for(['Terminal', 'CI / Headless'])(
    '%s exposes one setup action',
    async (name) => {
      const user = userEvent.setup()
      render(CliAgentExperience)
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
    render(CliAgentExperience)
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
    render(CliAgentExperience)
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
  render(CliAgentExperience)
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
  await user.click(close)
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('preserves the same client across Cloud and Local changes', async () => {
  const user = userEvent.setup()
  render(CliAgentExperience)
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

it('captures client and connection changes once without tracking initialization or repeated selections', async () => {
  const user = userEvent.setup()
  render(CliAgentExperience)
  expect(captureCliClientTabClick).not.toHaveBeenCalled()
  expect(captureCliConnectionTabClick).not.toHaveBeenCalled()
  await user.click(screen.getByRole('tab', { name: 'Codex' }))
  await user.click(screen.getByRole('tab', { name: 'Codex' }))
  await user.click(screen.getByRole('button', { name: 'SET UP Codex' }))
  const dialog = within(screen.getByRole('dialog'))
  await user.click(dialog.getByRole('tab', { name: 'Hermes' }))
  await user.click(dialog.getByRole('button', { name: 'Local' }))
  await user.click(dialog.getByRole('button', { name: 'Local' }))
  expect(vi.mocked(captureCliClientTabClick).mock.calls).toEqual([
    ['codex'],
    ['hermes']
  ])
  expect(vi.mocked(captureCliConnectionTabClick).mock.calls).toEqual([
    ['local']
  ])
})

it('uses Chinese setup copy and local agent commands', async () => {
  const user = userEvent.setup()
  const { t } = translationsFor('zh-CN')
  render(CliAgentExperience, { props: { locale: 'zh-CN' } })
  expect(screen.getByRole('tab', { name: 'CI / 无头模式' })).toBeVisible()
  await user.click(
    screen.getByRole('button', {
      name: t('cli.experience.setup', { client: 'Claude Code' })
    })
  )
  const dialog = within(
    screen.getByRole('dialog', {
      name: t('cli.experience.dialogAgent', { client: 'Claude Code' })
    })
  )
  await user.click(
    dialog.getByRole('button', { name: t('cli.experience.localLabel') })
  )
  expect(
    dialog.getByText(
      t('cli.setup.agent.commandLocal', { url: externalLinks.docsCliMd })
    )
  ).toBeVisible()
  expect(
    dialog.getByText(
      t('cli.experience.runAgentLocal', { client: 'Claude Code' })
    )
  ).toBeVisible()
  await user.click(
    dialog.getByRole('tab', { name: t('cli.experience.manualMode') })
  )
  expect(dialog.getByText(t('cli.experience.localHelp'))).toBeVisible()
})

it.for(['Terminal', 'CI / Headless'])(
  'restores focus after the manual opener disappears for %s',
  async (name) => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(CliAgentExperience)
    await user.click(screen.getByRole('button', { name: 'INSTALL MANUALLY' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('tab', { name })
    )
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: `SET UP ${name}` })).toHaveFocus()
  }
)
