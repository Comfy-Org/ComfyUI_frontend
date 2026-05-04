import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import ViewerGizmoControls from '@/components/load3d/controls/viewer/ViewerGizmoControls.vue'
import type { GizmoMode } from '@/extensions/core/load3d/interfaces'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { on: 'On', off: 'Off' },
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

function renderComponent(
  initial: { enabled?: boolean; mode?: GizmoMode } = {}
) {
  const enabled = ref<boolean>(initial.enabled ?? false)
  const mode = ref<GizmoMode>(initial.mode ?? 'translate')

  const utils = render(ViewerGizmoControls, {
    props: {
      gizmoEnabled: enabled.value,
      'onUpdate:gizmoEnabled': (v: boolean | undefined) => {
        if (v !== undefined) enabled.value = v
      },
      gizmoMode: mode.value,
      'onUpdate:gizmoMode': (v: GizmoMode | undefined) => {
        if (v) mode.value = v
      }
    },
    global: {
      plugins: [i18n]
    }
  })

  return { ...utils, enabled, mode, user: userEvent.setup() }
}

describe('ViewerGizmoControls', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders only the on/off toggle when gizmo is disabled', () => {
    renderComponent({ enabled: false })

    expect(screen.getByText('Gizmo')).toBeTruthy()
    expect(screen.getByText('Off')).toBeTruthy()
    expect(screen.getByText('On')).toBeTruthy()

    expect(screen.queryByText('Translate')).toBeNull()
    expect(screen.queryByText('Rotate')).toBeNull()
    expect(screen.queryByText('Scale')).toBeNull()
    expect(screen.queryByText('Reset Transform')).toBeNull()
  })

  it('renders mode toggles and reset button when gizmo is enabled', () => {
    renderComponent({ enabled: true })

    expect(screen.getByText('Translate')).toBeTruthy()
    expect(screen.getByText('Rotate')).toBeTruthy()
    expect(screen.getByText('Scale')).toBeTruthy()
    expect(screen.getByText('Reset Transform')).toBeTruthy()
  })

  it('enables gizmo when the On item is clicked', async () => {
    const { user, enabled } = renderComponent({ enabled: false })

    await user.click(screen.getByText('On'))

    expect(enabled.value).toBe(true)
  })

  it('disables gizmo when the Off item is clicked from an enabled state', async () => {
    const { user, enabled } = renderComponent({ enabled: true })

    await user.click(screen.getByText('Off'))

    expect(enabled.value).toBe(false)
  })

  it.each([
    ['Translate', 'translate'],
    ['Rotate', 'rotate'],
    ['Scale', 'scale']
  ] as const)(
    'updates mode to %s when its toggle item is clicked',
    async (label, expected) => {
      const { user, mode } = renderComponent({
        enabled: true,
        mode: 'translate'
      })

      await user.click(screen.getByText(label))

      expect(mode.value).toBe(expected)
    }
  )

  it('emits reset-transform when the reset button is clicked', async () => {
    const { user, emitted } = renderComponent({
      enabled: true,
      mode: 'rotate'
    })

    await user.click(screen.getByRole('button', { name: /reset transform/i }))

    expect(emitted()['reset-transform']).toEqual([[]])
  })

  it('leaves mode unchanged when deselecting the active mode', async () => {
    const { user, mode } = renderComponent({ enabled: true, mode: 'scale' })

    await user.click(screen.getByText('Scale'))

    expect(mode.value).toBe('scale')
  })
})
