import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import GizmoMenuGroup from '@/components/load3d/menubar/GizmoMenuGroup.vue'
import type {
  GizmoMode,
  ModelConfig
} from '@/extensions/core/load3d/interfaces'
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
  compact?: boolean
  onToggleGizmo?: (enabled: boolean) => void
  onSetGizmoMode?: (mode: GizmoMode) => void
  onResetGizmoTransform?: () => void
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

  it('collapses the mode controls into a dropdown when compact', async () => {
    const config = makeConfig(true)
    const onSetGizmoMode = vi.fn()
    const { user } = renderGroup({ config, compact: true, onSetGizmoMode })

    expect(
      screen.queryByRole('button', { name: 'Rotate' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByTestId('gizmo-mode-menu'))

    expect(
      screen.getByRole('button', { name: 'Translate', pressed: true })
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Rotate', pressed: false })
    )

    expect(onSetGizmoMode).toHaveBeenCalledWith('rotate')
    expect(config.gizmo?.mode).toBe('rotate')
    expect(
      screen.queryByRole('button', { name: 'Scale' })
    ).not.toBeInTheDocument()
  })

  it('labels the compact dropdown trigger with the active mode', () => {
    const config = makeConfig(true)
    config.gizmo!.mode = 'scale'
    renderGroup({ config, compact: true })

    expect(screen.getByTestId('gizmo-mode-menu')).toHaveAccessibleName('Scale')
  })

  it('does not reopen the mode menu after the gizmo is disabled and re-enabled', async () => {
    const { user, rerender } = renderGroup({
      config: makeConfig(true),
      compact: true
    })

    await user.click(screen.getByTestId('gizmo-mode-menu'))
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()

    await rerender({ config: makeConfig(false), compact: true })
    await rerender({ config: makeConfig(true), compact: true })

    expect(
      screen.queryByRole('button', { name: 'Reset' })
    ).not.toBeInTheDocument()
  })

  it('forwards resetGizmoTransform from the compact dropdown', async () => {
    const config = makeConfig(true)
    const onResetGizmoTransform = vi.fn()
    const { user } = renderGroup({
      config,
      compact: true,
      onResetGizmoTransform
    })

    await user.click(screen.getByTestId('gizmo-mode-menu'))
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    expect(onResetGizmoTransform).toHaveBeenCalledOnce()
  })
})
