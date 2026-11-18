import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { useExternalLink } from '@/composables/useExternalLink'
import enMessages from '@/locales/en/main.json'
import type { CustomDeploymentPitch } from '@/platform/workspace/customDeploymentPitch'

import CustomDeploymentCard from './CustomDeploymentCard.vue'

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

function renderCard(
  pitch: Partial<CustomDeploymentPitch> = {},
  videoSources: { src: string; type: string }[] = []
) {
  const user = userEvent.setup()
  const onDone = vi.fn()
  const onDismiss = vi.fn()
  render(CustomDeploymentCard, {
    props: {
      pitch: {
        title: 'Deploy Custom Nodes on Comfy Cloud',
        body: 'Create a custom deployment that runs your custom nodes.',
        points: ['Deploy your node packs', 'Work on the GPU you choose'],
        platformLabel: 'Deploy on Platform',
        brief: '# The brief for an agent',
        ...pitch
      },
      videoSources,
      onDone,
      onDismiss
    },
    global: { plugins: [i18n] }
  })
  return { onDone, onDismiss, user }
}

function linkFollowedOnNextClick(): () => boolean {
  const clicks: MouseEvent[] = []
  document.addEventListener('click', (event) => clicks.push(event), {
    once: true
  })
  return () => clicks.length === 1 && !clicks[0].defaultPrevented
}

describe('CustomDeploymentCard', () => {
  it('shows the pitch it is given', () => {
    renderCard()

    expect(
      screen.getByRole('heading', {
        name: 'Deploy Custom Nodes on Comfy Cloud'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Create a custom deployment that runs your custom nodes.'
      )
    ).toBeVisible()
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent.trim())
    ).toEqual(['Deploy your node packs', 'Work on the GPU you choose'])
  })

  it('opens the platform wizard from a click with this tab as its opener, keeps a plain link that has none, and reports done', async () => {
    const open = vi
      .spyOn(window, 'open')
      .mockReturnValue(fromPartial<Window>({ closed: true }))
    const { onDone, user } = renderCard()
    const link = screen.getByRole('link', { name: 'Deploy on Platform' })
    const href = link.getAttribute('href')

    expect(href).toMatch(
      /^https:\/\/platform\.comfy\.org\/profile\/builds\/new\?step=import&handoff=[A-Za-z0-9_-]{16,64}&utm_source=comfyui&utm_medium=app&utm_content=custom-deployment-card$/
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    const followsLink = linkFollowedOnNextClick()
    await user.click(link)
    expect(open).toHaveBeenCalledExactlyOnceWith(href, '_blank')
    expect(followsLink()).toBe(false)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('leaves the click to the plain link when the browser blocks the new tab', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    const { onDone, user } = renderCard()
    const link = screen.getByRole('link', { name: 'Deploy on Platform' })

    const followsLink = linkFollowedOnNextClick()
    await user.click(link)

    expect(followsLink()).toBe(true)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it.for([
    {
      video: 'has sources',
      sources: [{ src: 'deploy.mp4', type: 'video/mp4' }],
      shows: true
    },
    { video: 'has none', sources: [], shows: false }
  ])('shows the video only when it $video', ({ sources, shows }) => {
    renderCard({}, sources)

    expect(screen.queryByTestId('custom-deployment-video') !== null).toBe(shows)
  })

  it('lists what the workflow lacks when the pitch names it', () => {
    renderCard({
      missing: [
        {
          label: '2 missing node packs',
          names: 'comfyui-birefnet, comfyui-rmbg'
        },
        { label: '1 missing model', names: 'BiRefNet-general.safetensors' }
      ]
    })

    const missing = screen.getByTestId('custom-deployment-missing')
    expect(missing).toHaveTextContent(
      '2 missing node packscomfyui-birefnet, comfyui-rmbg1 missing modelBiRefNet-general.safetensors'
    )
  })

  it('copies the brief for an agent, then says so and stays open', async () => {
    const { onDone, user } = renderCard()

    await user.click(screen.getByTestId('custom-deployment-agent'))

    expect(await navigator.clipboard.readText()).toBe(
      '# The brief for an agent'
    )
    expect(screen.getByTestId('custom-deployment-agent')).toHaveTextContent(
      /^Copied/
    )
    expect(onDone).not.toHaveBeenCalled()
  })

  it('keeps the original label when the brief did not reach the clipboard', async () => {
    const { user } = renderCard()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(
      new Error('Clipboard permission denied')
    )

    await user.click(screen.getByTestId('custom-deployment-agent'))

    expect(screen.getByTestId('custom-deployment-agent')).toHaveTextContent(
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
