import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { useExternalLink } from '@/composables/useExternalLink'
import enMessages from '@/locales/en/main.json'

import DeploySetupCard from './DeploySetupCard.vue'

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock(import('@/composables/useExternalLink'), () => ({
  useExternalLink: () =>
    fromPartial<ReturnType<typeof useExternalLink>>({
      buildDocsUrl: (path: string) => `https://docs.comfy.org${path}`
    })
}))

describe('DeploySetupCard', () => {
  it('opens the Deploy page on the platform, set for custom nodes on Comfy Cloud, in a new tab that sends no referrer from a local build', () => {
    render(DeploySetupCard, {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: enMessages }
          })
        ],
        stubs: { DeploySetupAgentMenu: true }
      }
    })

    const link = screen.getByRole('link', { name: 'Deploy on Platform' })

    expect(link).toHaveAttribute(
      'href',
      'https://platform.comfy.org/profile/deploy?onboarding=custom_comfy_cloud&utm_source=comfyui&utm_medium=app&utm_content=deploy-setup-card'
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
