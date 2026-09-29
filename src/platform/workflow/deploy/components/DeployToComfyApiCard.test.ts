import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { useExternalLink } from '@/composables/useExternalLink'
import enMessages from '@/locales/en/main.json'

import DeployToComfyApiCard from './DeployToComfyApiCard.vue'

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderCard(
  media: { videoSrc?: string; videoSrcMp4?: string; posterSrc?: string } = {}
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

  it('links to the developer platform in a new tab without a referrer, and reports done', async () => {
    const { onDone, user } = renderCard()
    const link = screen.getByRole('link', { name: 'Deploy on Platform' })

    expect(link).toHaveAttribute('href', 'https://platform.comfy.org')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    await user.click(link)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('plays the video over its poster', () => {
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
  })

  it('falls back to the placeholder when the video fails to load', async () => {
    renderCard({ videoSrc: 'https://example.test/a.webm' })

    await fireEvent.error(screen.getByTestId('deploy-to-comfy-api-video'))

    expect(
      screen.getByTestId('deploy-to-comfy-api-video-placeholder')
    ).toBeInTheDocument()
  })
})
