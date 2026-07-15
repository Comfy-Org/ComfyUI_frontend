import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import GizmoMenuGroup from '@/components/load3d/menubar/GizmoMenuGroup.vue'
import type { ModelConfig } from '@/extensions/core/load3d/interfaces'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function makeConfig(enabled: boolean): ModelConfig {
  return {
    upDirection: 'original',
    materialMode: 'original',
    showSkeleton: false,
    gizmo: {
      enabled,
      mode: 'translate',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    }
  }
}

type Props = {
  config: ModelConfig
  onToggleGizmo?: (enabled: boolean) => void
  onSetGizmoMode?: (mode: string) => void
}

function renderGroup(props: Props) {
  const result = render(GizmoMenuGroup, {
    props,
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
  return { ...result, user: userEvent.setup() }
}

describe('GizmoMenuGroup', () => {
  it('enables the gizmo and reveals the mode controls', async () => {
    const config = makeConfig(false)
    const onToggleGizmo = vi.fn()
    const { user } = renderGroup({ config, onToggleGizmo })

    expect(
      screen.queryByRole('button', { name: 'Rotate' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Gizmo' }))

    expect(onToggleGizmo).toHaveBeenCalledWith(true)
    expect(config.gizmo?.enabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Rotate' })).toBeInTheDocument()
  })

  it('sets the transform mode', async () => {
    const config = makeConfig(true)
    const onSetGizmoMode = vi.fn()
    const { user } = renderGroup({ config, onSetGizmoMode })

    await user.click(screen.getByRole('button', { name: 'Rotate' }))

    expect(onSetGizmoMode).toHaveBeenCalledWith('rotate')
    expect(config.gizmo?.mode).toBe('rotate')
  })
})
