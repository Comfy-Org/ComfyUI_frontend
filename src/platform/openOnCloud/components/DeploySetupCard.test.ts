import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import type { useExternalLink } from '@/composables/useExternalLink'
import enMessages from '@/locales/en/main.json'
import { useLocalAgentStore } from '@/platform/openOnCloud/stores/localAgentStore'
import { useAgentHandoff } from '@/platform/workflow/deploy/composables/useAgentHandoff'

import DeploySetupCard from './DeploySetupCard.vue'

vi.mock(
  import('@/platform/workflow/deploy/composables/useAgentHandoff'),
  () => {
    const copyBrief = vi.fn(() => Promise.resolve(true))
    return { useAgentHandoff: () => fromPartial({ copyBrief }) }
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

function renderCard() {
  const onDone = vi.fn()
  const onDismiss = vi.fn()
  render(DeploySetupCard, {
    props: { onDone, onDismiss },
    global: { plugins: [i18n] }
  })
  return { onDone, onDismiss, user: userEvent.setup({ pointerEventsCheck: 0 }) }
}

async function pickAgentRow(
  user: ReturnType<typeof userEvent.setup>,
  name: string
) {
  await user.click(screen.getByTestId('deploy-setup-agent'))
  await user.click(await screen.findByRole('menuitem', { name }))
}

function toastTexts() {
  return useToast().toasts.map(
    (toast) => `${toast.title}: ${toast.description}`
  )
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

  it('offers four ways to hand the setup to an agent', async () => {
    const { user } = renderCard()

    await user.click(screen.getByTestId('deploy-setup-agent'))

    expect(
      (await screen.findAllByRole('menuitem')).map((row) =>
        row.textContent.trim()
      )
    ).toEqual([
      'Use local agent',
      'Open in Claude desktop',
      'Open in ChatGPT desktop',
      'Copy prompt'
    ])
  })

  it('copies the brief, then says so on the button and stays open', async () => {
    const { onDone, user } = renderCard()

    await pickAgentRow(user, 'Copy prompt')

    expect(useAgentHandoff().copyBrief).toHaveBeenCalledOnce()
    expect(screen.getByTestId('deploy-setup-agent')).toHaveTextContent(
      /^Copied/
    )
    expect(onDone).not.toHaveBeenCalled()
  })

  it('keeps the original label when the brief did not reach the clipboard', async () => {
    vi.mocked(useAgentHandoff().copyBrief).mockResolvedValueOnce(false)
    const { user } = renderCard()

    await pickAgentRow(user, 'Copy prompt')

    expect(screen.getByTestId('deploy-setup-agent')).toHaveTextContent(
      'Build with your agent'
    )
  })

  it('Use local agent starts the local agent and closes the card', async () => {
    const { onDone, user } = renderCard()

    await pickAgentRow(user, 'Use local agent')

    expect(useLocalAgentStore().isConverting).toBe(true)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('Use local agent without a local agent copies the brief and says so', async () => {
    useLocalAgentStore().prototypeAgent = 'notFound'
    const { onDone, user } = renderCard()

    await pickAgentRow(user, 'Use local agent')

    expect(useAgentHandoff().copyBrief).toHaveBeenCalledOnce()
    expect(useLocalAgentStore().isConverting).toBe(false)
    expect(toastTexts()).toEqual([
      "ComfyUI couldn't find your local agent: The prompt is copied. Paste it into Claude Code or Codex, or deploy on Platform."
    ])
    expect(onDone).not.toHaveBeenCalled()
  })

  it.for([
    {
      row: 'Open in Claude desktop',
      toast:
        'Prompt copied: A real build would open Claude desktop with this prompt.'
    },
    {
      row: 'Open in ChatGPT desktop',
      toast:
        'Prompt copied: A real build would open ChatGPT desktop with this prompt.'
    }
  ])(
    '$row copies the brief and says what a real build would do',
    async ({ row, toast }) => {
      const { user } = renderCard()

      await pickAgentRow(user, row)

      expect(useAgentHandoff().copyBrief).toHaveBeenCalledOnce()
      expect(toastTexts()).toEqual([toast])
    }
  )

  it('reports dismiss from the close control', async () => {
    const { onDismiss, onDone, user } = renderCard()

    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onDone).not.toHaveBeenCalled()
  })
})
