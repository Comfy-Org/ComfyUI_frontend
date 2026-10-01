import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import type { useErrorHandling } from '@/composables/useErrorHandling'
import type { useExternalLink } from '@/composables/useExternalLink'
import enMessages from '@/locales/en/main.json'

import DeployToComfyApiCard from './DeployToComfyApiCard.vue'

const openPlatformBuild = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock(
  import('@/platform/workflow/deploy/composables/usePlatformBuildHandoff'),
  () => ({ usePlatformBuildHandoff: () => ({ open: openPlatformBuild }) })
)

const buildDocsUrl = vi.hoisted(() =>
  vi.fn(
    (path: string, _options?: { includeLocale?: boolean }) =>
      `https://docs.comfy.org${path}`
  )
)
vi.mock(import('@/composables/useExternalLink'), () => ({
  useExternalLink: () =>
    fromPartial<ReturnType<typeof useExternalLink>>({ buildDocsUrl })
}))

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
  it('links to the platform developer docs', () => {
    renderCard()

    for (const link of screen.getAllByRole('link', {
      name: /read the docs/i
    })) {
      expect(link).toHaveAttribute(
        'href',
        'https://docs.comfy.org/development/overview'
      )
    }
    expect(buildDocsUrl).toHaveBeenCalledWith('/development/overview', {
      includeLocale: true
    })
  })

  it('reports dismiss from the close control', async () => {
    const { onDismiss, onDone, user } = renderCard()

    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onDone).not.toHaveBeenCalled()
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
      videoSrc: 'https://example.test/a.webm',
      videoSrcMp4: 'https://example.test/a.mp4',
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
