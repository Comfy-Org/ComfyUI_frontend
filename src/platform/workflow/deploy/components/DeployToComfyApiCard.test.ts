import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import DeployToComfyApiCard from './DeployToComfyApiCard.vue'

const openPlatformBuild = vi.hoisted(() => vi.fn(() => Promise.resolve()))
vi.mock(
  import('@/platform/workflow/deploy/composables/usePlatformBuildHandoff'),
  () => ({ usePlatformBuildHandoff: () => ({ open: openPlatformBuild }) })
)

vi.mock<unknown>(import('@/composables/useExternalLink'), () => ({
  useExternalLink: () => ({
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
  render(DeployToComfyApiCard, {
    props: { onDone },
    global: { plugins: [i18n] }
  })
  return { onDone, user: userEvent.setup() }
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

  it('hands the workflow to the platform and reports done', async () => {
    const { onDone, user } = renderCard()

    await user.click(screen.getByTestId('deploy-to-comfy-api-platform'))

    expect(openPlatformBuild).toHaveBeenCalledOnce()
    expect(onDone).toHaveBeenCalledOnce()
  })
})
