import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { useExternalLink } from '@/composables/useExternalLink'
import enMessages from '@/locales/en/main.json'

import DeployToComfyApiCard from './DeployToComfyApiCard.vue'

const openPlatformBuild = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock(
  import('@/platform/workflow/deploy/composables/usePlatformBuildHandoff'),
  () => ({ usePlatformBuildHandoff: () => ({ open: openPlatformBuild }) })
)

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
  render(DeployToComfyApiCard, {
    props: { onDone, onDismiss },
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

  it('stays open when no tab could be opened', async () => {
    const { onDone, user } = renderCard()
    openPlatformBuild.mockResolvedValueOnce(false)

    await user.click(screen.getByTestId('deploy-to-comfy-api-platform'))

    expect(onDone).not.toHaveBeenCalled()
  })
})
