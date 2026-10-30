import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { useExternalLink } from '@/composables/useExternalLink'
import enMessages from '@/locales/en/main.json'
import { useAgentHandoff } from '@/platform/workflow/deploy/composables/useAgentHandoff'
import { api } from '@/scripts/api'

import DeploySetupCard from './DeploySetupCard.vue'

vi.mock(
  import('@/platform/workflow/deploy/composables/useAgentHandoff'),
  () => {
    const copyBrief = vi.fn(() => Promise.resolve(true))
    const openBriefIn = vi.fn()
    return { useAgentHandoff: () => fromPartial({ copyBrief, openBriefIn }) }
  }
)

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock(import('@/composables/useExternalLink'), () => ({
  useExternalLink: () =>
    fromPartial<ReturnType<typeof useExternalLink>>({
      buildDocsUrl: (path: string) => `https://docs.comfy.org${path}`
    })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderCard({ localAgentReady = true } = {}) {
  api.serverFeatureFlags.value = localAgentReady
    ? { agent: { state: 'ready' } }
    : {}
  const onDone = vi.fn()
  const onDismiss = vi.fn()
  render(DeploySetupCard, {
    props: { onDone, onDismiss },
    global: { plugins: [i18n] }
  })
  return {
    onDone,
    onDismiss,
    user: userEvent.setup({ pointerEventsCheck: 0 })
  }
}

async function pickAgentRow(
  user: ReturnType<typeof userEvent.setup>,
  name: string
) {
  await user.click(screen.getByTestId('deploy-setup-agent'))
  await user.click(await screen.findByRole('menuitem', { name }))
}

describe('DeploySetupCard', () => {
  it('says what deploying the setup gives you', () => {
    renderCard()

    expect(
      screen.getByRole('heading', { name: 'Deploy your setup to Comfy Cloud' })
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent.trim())
    ).toEqual([
      'Work in ComfyUI on the GPU you choose',
      'Call it from your product as an autoscaling API',
      'Bring your custom nodes and models'
    ])
  })

  it('links to the developer platform in a new tab without a referrer, and reports done', async () => {
    const { onDone, user } = renderCard()
    const link = screen.getByRole('link', { name: 'Deploy on Platform' })

    expect(link).toHaveAttribute('href', 'https://platform.comfy.org')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    await user.click(link)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it.for([
    {
      localAgent: 'ready',
      localAgentReady: true,
      marks: 'agent-marks-localAgent',
      rows: [
        'Use local agent',
        'Open in Claude desktop',
        'Open in ChatGPT desktop',
        'Copy prompt'
      ]
    },
    {
      localAgent: 'not ready',
      localAgentReady: false,
      marks: 'agent-marks-desktopAgents',
      rows: ['Open in Claude desktop', 'Open in ChatGPT desktop', 'Copy prompt']
    }
  ])(
    'offers the local agent in its marks and its menu only while it is $localAgent',
    async ({ localAgentReady, marks, rows }) => {
      const { user } = renderCard({ localAgentReady })
      const button = screen.getByTestId('deploy-setup-agent')

      expect(within(button).getByTestId(marks)).toBeInTheDocument()
      await user.click(button)
      expect(
        (await screen.findAllByRole('menuitem')).map((row) =>
          row.textContent.trim()
        )
      ).toEqual(rows)
    }
  )

  it.for([
    { row: 'Open in Claude desktop', app: 'claude' },
    { row: 'Open in ChatGPT desktop', app: 'chatGpt' }
  ])(
    '$row opens the brief in that app and keeps the card open',
    async ({ row, app }) => {
      const { onDone, user } = renderCard()

      await pickAgentRow(user, row)

      expect(useAgentHandoff().openBriefIn).toHaveBeenCalledExactlyOnceWith(app)
      expect(onDone).not.toHaveBeenCalled()
    }
  )

  it('Copy prompt copies the brief, then says so on the button and stays open', async () => {
    const { onDone, user } = renderCard()

    await pickAgentRow(user, 'Copy prompt')

    expect(useAgentHandoff().copyBrief).toHaveBeenCalledOnce()
    expect(screen.getByTestId('deploy-setup-agent')).toHaveTextContent(
      /^Copied/
    )
    expect(onDone).not.toHaveBeenCalled()
  })

  it('shows the agent label again when the menu reopens after Copy prompt', async () => {
    const { user } = renderCard()

    await pickAgentRow(user, 'Copy prompt')
    await user.click(screen.getByTestId('deploy-setup-agent'))

    expect(screen.getByTestId('deploy-setup-agent')).toHaveTextContent(
      'Build with your agent'
    )
  })

  it('keeps the original label when the brief did not reach the clipboard', async () => {
    vi.mocked(useAgentHandoff().copyBrief).mockResolvedValueOnce(false)
    const { user } = renderCard()

    await pickAgentRow(user, 'Copy prompt')

    expect(screen.getByTestId('deploy-setup-agent')).toHaveTextContent(
      'Build with your agent'
    )
  })

  it('reports dismiss from the close control', async () => {
    const { onDismiss, onDone, user } = renderCard()

    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onDone).not.toHaveBeenCalled()
  })
})
