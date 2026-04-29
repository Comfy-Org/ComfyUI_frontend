import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import GizmoControls from '@/components/load3d/controls/GizmoControls.vue'
import type { GizmoConfig } from '@/extensions/core/load3d/interfaces'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      load3d: {
        gizmo: {
          toggle: 'Gizmo',
          translate: 'Translate',
          rotate: 'Rotate',
          scale: 'Scale',
          reset: 'Reset Transform'
        }
      }
    }
  }
})

function makeConfig(overrides: Partial<GizmoConfig> = {}): GizmoConfig {
  return {
    enabled: false,
    mode: 'translate',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    ...overrides
  }
}

function renderComponent(initial: Partial<GizmoConfig> = {}) {
  const gizmoConfig = ref<GizmoConfig>(makeConfig(initial))

  const utils = render(GizmoControls, {
    props: {
      gizmoConfig: gizmoConfig.value,
      'onUpdate:gizmoConfig': (v: GizmoConfig | undefined) => {
        if (v) gizmoConfig.value = v
      }
    },
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })

  return { ...utils, gizmoConfig, user: userEvent.setup() }
}

describe('GizmoControls', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders only the toggle button when gizmo is disabled', () => {
    renderComponent({ enabled: false })

    expect(screen.getByRole('button', { name: 'Gizmo' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Translate' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rotate' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Scale' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reset Transform' })).toBeNull()
  })

  it('renders mode and reset buttons when gizmo is enabled', () => {
    renderComponent({ enabled: true })

    expect(screen.getByRole('button', { name: 'Translate' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rotate' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Scale' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reset Transform' })).toBeTruthy()
  })

  it('flips enabled and emits toggleGizmo when the toggle is clicked', async () => {
    const { user, gizmoConfig, emitted } = renderComponent({ enabled: false })

    await user.click(screen.getByRole('button', { name: 'Gizmo' }))

    expect(gizmoConfig.value.enabled).toBe(true)
    expect(emitted().toggleGizmo).toEqual([[true]])
  })

  it('turns off gizmo and emits false when toggled from enabled state', async () => {
    const { user, gizmoConfig, emitted } = renderComponent({ enabled: true })

    await user.click(screen.getByRole('button', { name: 'Gizmo' }))

    expect(gizmoConfig.value.enabled).toBe(false)
    expect(emitted().toggleGizmo).toEqual([[false]])
  })

  it.each([
    ['Translate', 'translate'],
    ['Rotate', 'rotate'],
    ['Scale', 'scale']
  ] as const)(
    'sets mode to %s and emits setGizmoMode when clicked',
    async (label, mode) => {
      const { user, gizmoConfig, emitted } = renderComponent({ enabled: true })

      await user.click(screen.getByRole('button', { name: label }))

      expect(gizmoConfig.value.mode).toBe(mode)
      expect(emitted().setGizmoMode).toEqual([[mode]])
    }
  )

  it('emits resetGizmoTransform without mutating config on reset click', async () => {
    const { user, gizmoConfig, emitted } = renderComponent({
      enabled: true,
      mode: 'rotate'
    })

    await user.click(screen.getByRole('button', { name: 'Reset Transform' }))

    expect(emitted().resetGizmoTransform).toEqual([[]])
    expect(gizmoConfig.value.mode).toBe('rotate')
    expect(gizmoConfig.value.enabled).toBe(true)
  })

  it('highlights the active mode button with a ring', () => {
    renderComponent({ enabled: true, mode: 'rotate' })

    const translate = screen.getByRole('button', { name: 'Translate' })
    const rotate = screen.getByRole('button', { name: 'Rotate' })
    const scale = screen.getByRole('button', { name: 'Scale' })

    expect(rotate.className).toContain('ring-2')
    expect(translate.className).not.toContain('ring-2')
    expect(scale.className).not.toContain('ring-2')
  })

  it('does nothing when clicked with no model value bound', async () => {
    const user = userEvent.setup()
    const { emitted } = render(GizmoControls, {
      props: { gizmoConfig: undefined },
      global: {
        plugins: [i18n],
        directives: { tooltip: () => {} }
      }
    })

    await user.click(screen.getByRole('button', { name: 'Gizmo' }))

    expect(emitted().toggleGizmo).toBeUndefined()
  })
})
