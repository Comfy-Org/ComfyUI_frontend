import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import CameraControls from '@/components/load3d/controls/CameraControls.vue'
import type { CameraType } from '@/extensions/core/load3d/interfaces'

vi.mock('@/components/load3d/controls/PopupSlider.vue', () => ({
  default: {
    name: 'PopupSlider',
    props: ['tooltipText', 'modelValue'],
    template: '<div data-testid="popup-slider">{{ tooltipText }}</div>'
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { load3d: { switchCamera: 'Switch camera', fov: 'FOV' } }
  }
})

function renderComponent(initial: { type?: CameraType; fov?: number } = {}) {
  const cameraType = ref<CameraType>(initial.type ?? 'perspective')
  const fov = ref<number>(initial.fov ?? 75)

  const utils = render(CameraControls, {
    props: {
      cameraType: cameraType.value,
      'onUpdate:cameraType': (v: CameraType | undefined) => {
        if (v) cameraType.value = v
      },
      fov: fov.value,
      'onUpdate:fov': (v: number | undefined) => {
        if (v !== undefined) fov.value = v
      }
    },
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })

  return { ...utils, cameraType, fov, user: userEvent.setup() }
}

describe('CameraControls', () => {
  it('renders the switch-camera button', () => {
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Switch camera' })
    ).toBeInTheDocument()
  })

  it('shows the FOV PopupSlider only for the perspective camera', () => {
    renderComponent({ type: 'perspective' })
    expect(screen.getByTestId('popup-slider')).toBeInTheDocument()
  })

  it('hides the FOV PopupSlider for the orthographic camera', () => {
    renderComponent({ type: 'orthographic' })
    expect(screen.queryByTestId('popup-slider')).not.toBeInTheDocument()
  })

  it('toggles cameraType from perspective to orthographic when the button is clicked', async () => {
    const { user, cameraType } = renderComponent({ type: 'perspective' })

    await user.click(screen.getByRole('button', { name: 'Switch camera' }))

    expect(cameraType.value).toBe('orthographic')
  })

  it('toggles cameraType from orthographic to perspective when the button is clicked', async () => {
    const { user, cameraType } = renderComponent({ type: 'orthographic' })

    await user.click(screen.getByRole('button', { name: 'Switch camera' }))

    expect(cameraType.value).toBe('perspective')
  })
})
