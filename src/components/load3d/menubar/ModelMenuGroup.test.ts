import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import ModelMenuGroup from '@/components/load3d/menubar/ModelMenuGroup.vue'
import type { ModelConfig } from '@/extensions/core/load3d/interfaces'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function makeConfig(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    upDirection: 'original',
    materialMode: 'original',
    showSkeleton: false,
    ...overrides
  }
}

function renderGroup(
  props: { config?: ModelConfig; hasSkeleton?: boolean } = {}
) {
  const result = render(ModelMenuGroup, {
    props: { config: makeConfig(), ...props },
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
  return { ...result, user: userEvent.setup() }
}

describe('ModelMenuGroup', () => {
  it('sets the up direction from the popover', async () => {
    const config = makeConfig()
    const { user } = renderGroup({ config })

    await user.click(screen.getByRole('button', { name: 'Up Direction' }))
    await user.click(screen.getByRole('button', { name: '+Y' }))

    expect(config.upDirection).toBe('+y')
  })

  it('sets the material mode from the popover', async () => {
    const config = makeConfig()
    const { user } = renderGroup({ config })

    await user.click(screen.getByRole('button', { name: 'Material' }))
    await user.click(screen.getByRole('button', { name: 'Wireframe' }))

    expect(config.materialMode).toBe('wireframe')
  })

  it('toggles the skeleton only when supported', async () => {
    const config = makeConfig({ showSkeleton: false })
    const { user, rerender } = renderGroup({ config, hasSkeleton: false })

    expect(
      screen.queryByRole('button', { name: 'Skeleton' })
    ).not.toBeInTheDocument()

    await rerender({ config, hasSkeleton: true })
    await user.click(screen.getByRole('button', { name: 'Skeleton' }))

    expect(config.showSkeleton).toBe(true)
  })
})
