import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import type { useErrorHandling } from '@/composables/useErrorHandling'
import type { useExternalLink } from '@/composables/useExternalLink'
import enMessages from '@/locales/en/main.json'
import { useAgentHandoff } from '@/platform/workflow/deploy/composables/useAgentHandoff'
import type { BuildInputs } from '@/platform/workflow/deploy/utils/buildInputs'

import DeployToComfyApiCard from './DeployToComfyApiCard.vue'

const openPlatformBuild = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock(
  import('@/platform/workflow/deploy/composables/usePlatformBuildHandoff'),
  () => ({ usePlatformBuildHandoff: () => ({ open: openPlatformBuild }) })
)

vi.mock(
  import('@/platform/workflow/deploy/composables/useAgentHandoff'),
  () => {
    const copyBrief = vi.fn(() => Promise.resolve(true))
    const inputs = {
      models: ['sd_xl_base_1.0.safetensors'],
      nodeClasses: ['CheckpointLoaderSimple', 'KSampler'],
      nodePacks: [{ id: 'comfy-core', versions: [] }],
      workflowFileName: 'portrait-upscale.json',
      workflowName: 'portrait-upscale'
    } satisfies BuildInputs
    return {
      useAgentHandoff: () => ({ captureInputs: () => inputs, copyBrief })
    }
  }
)

vi.mock(import('@/composables/useExternalLink'), () => {
  const buildDocsUrl = vi.fn(
    (path: string, _options?: { includeLocale?: boolean }) =>
      `https://docs.comfy.org${path}`
  )
  return {
    useExternalLink: () =>
      fromPartial<ReturnType<typeof useExternalLink>>({ buildDocsUrl })
  }
})

const toastErrorHandler = vi.hoisted(() => vi.fn())
vi.mock(import('@/composables/useErrorHandling'), () => ({
  useErrorHandling: () =>
    fromPartial<ReturnType<typeof useErrorHandling>>({ toastErrorHandler })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderCard(
  media: Partial<ComponentProps<typeof DeployToComfyApiCard>> = {}
) {
  const onDone = vi.fn()
  const onDismiss = vi.fn()
  render(DeployToComfyApiCard, {
    props: { onDone, onDismiss, ...media },
    global: { plugins: [i18n] }
  })
  return { onDone, onDismiss, user: userEvent.setup() }
}

describe('DeployToComfyApiCard', () => {
  it('summarises what the graph puts into the Build', () => {
    renderCard()

    expect(
      screen.getByTestId('deploy-to-comfy-api-summary').textContent
    ).toContain('1 node pack · 1 model · 2 node classes')
  })

  it('links to the platform developer docs', () => {
    renderCard()

    const docs = 'https://docs.comfy.org/development/overview'
    expect(
      screen
        .getAllByRole('link', { name: /read the docs/i })
        .map((link) => link.getAttribute('href'))
    ).toEqual([docs, docs])
  })

  it('reports dismiss from the close control', async () => {
    const { onDismiss, onDone, user } = renderCard()

    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('copies the brief, then says so on the button and stays open', async () => {
    const { onDone, user } = renderCard()

    await user.click(screen.getByTestId('deploy-to-comfy-api-agent'))

    expect(useAgentHandoff().copyBrief).toHaveBeenCalledOnce()
    expect(screen.getByTestId('deploy-to-comfy-api-agent')).toHaveTextContent(
      /^Copied/
    )
    expect(onDone).not.toHaveBeenCalled()
  })

  it('keeps the original label when the brief did not reach the clipboard', async () => {
    vi.mocked(useAgentHandoff().copyBrief).mockResolvedValueOnce(false)
    const { user } = renderCard()

    await user.click(screen.getByTestId('deploy-to-comfy-api-agent'))

    expect(screen.getByTestId('deploy-to-comfy-api-agent')).toHaveTextContent(
      'Build with your agent'
    )
  })

  it('drops the copied label when a later copy fails', async () => {
    const { user } = renderCard()
    const button = screen.getByTestId('deploy-to-comfy-api-agent')
    await user.click(button)
    vi.mocked(useAgentHandoff().copyBrief).mockResolvedValueOnce(false)

    await user.click(button)

    expect(button).toHaveTextContent('Build with your agent')
  })

  it('hands the workflow to the platform and reports done', async () => {
    const { onDone, user } = renderCard()

    await user.click(screen.getByTestId('deploy-to-comfy-api-platform'))

    expect(openPlatformBuild).toHaveBeenCalledOnce()
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('stays open, with the button held, while the handoff is in flight', async () => {
    const { onDone, user } = renderCard()
    let finish!: (opened: boolean) => void
    openPlatformBuild.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        finish = resolve
      })
    )
    const button = screen.getByTestId('deploy-to-comfy-api-platform')

    await user.click(button)
    await user.click(button)

    expect(button).toBeDisabled()
    expect(openPlatformBuild).toHaveBeenCalledOnce()
    finish(true)
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(button).toBeEnabled()
  })

  it('stays open and releases the button when opening the platform fails', async () => {
    const { onDone, user } = renderCard()
    openPlatformBuild.mockRejectedValueOnce(new Error('opener unavailable'))
    const button = screen.getByTestId('deploy-to-comfy-api-platform')

    await user.click(button)

    await waitFor(() => expect(button).toBeEnabled())
    expect(onDone).not.toHaveBeenCalled()
    expect(toastErrorHandler).toHaveBeenCalledWith(expect.any(Error))
  })

  it('stays open when no tab could be opened', async () => {
    const { onDone, user } = renderCard()
    openPlatformBuild.mockResolvedValueOnce(false)

    await user.click(screen.getByTestId('deploy-to-comfy-api-platform'))

    expect(onDone).not.toHaveBeenCalled()
  })

  it('shows its media over the poster', () => {
    renderCard({
      videoSources: [
        { src: 'https://example.test/a.webm', type: 'video/webm' },
        { src: 'https://example.test/a.mp4', type: 'video/mp4' }
      ],
      posterSrc: 'https://example.test/a.jpg'
    })

    expect(screen.getByTestId('deploy-to-comfy-api-video')).toHaveAttribute(
      'poster',
      'https://example.test/a.jpg'
    )
    expect(
      screen.queryByTestId('deploy-to-comfy-api-video-placeholder')
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('shows the placeholder when there is no video', () => {
    renderCard()

    expect(
      screen.getByTestId('deploy-to-comfy-api-video-placeholder')
    ).toBeInTheDocument()
  })
})
