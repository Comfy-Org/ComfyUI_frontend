/* eslint-disable testing-library/no-container, testing-library/no-node-access -- hidden color/file inputs have no role/label, queried by selector */
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SceneControls from '@/components/load3d/controls/SceneControls.vue'

vi.mock('@/components/load3d/controls/PopupSlider.vue', () => ({
  default: {
    name: 'PopupSliderStub',
    props: ['tooltipText', 'modelValue'],
    template: '<div data-testid="fov-popup-slider">{{ tooltipText }}</div>'
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      load3d: {
        showGrid: 'Show grid',
        backgroundColor: 'Background color',
        uploadBackgroundImage: 'Upload background image',
        panoramaMode: 'Panorama mode',
        removeBackgroundImage: 'Remove background image',
        fov: 'FOV'
      }
    }
  }
})

type RenderOpts = {
  showGrid?: boolean
  backgroundColor?: string
  backgroundImage?: string
  backgroundRenderMode?: 'tiled' | 'panorama'
  fov?: number
  hdriActive?: boolean
  onUpdateBackgroundImage?: (file: File | null) => void
}

function renderComponent(opts: RenderOpts = {}) {
  const showGrid = ref<boolean>(opts.showGrid ?? true)
  const backgroundColor = ref<string>(opts.backgroundColor ?? '#000000')
  const backgroundImage = ref<string>(opts.backgroundImage ?? '')
  const backgroundRenderMode = ref<'tiled' | 'panorama'>(
    opts.backgroundRenderMode ?? 'tiled'
  )
  const fov = ref<number>(opts.fov ?? 75)

  const utils = render(SceneControls, {
    props: {
      showGrid: showGrid.value,
      'onUpdate:showGrid': (v: boolean | undefined) => {
        if (v !== undefined) showGrid.value = v
      },
      backgroundColor: backgroundColor.value,
      'onUpdate:backgroundColor': (v: string | undefined) => {
        if (v !== undefined) backgroundColor.value = v
      },
      backgroundImage: backgroundImage.value,
      'onUpdate:backgroundImage': (v: string | undefined) => {
        if (v !== undefined) backgroundImage.value = v
      },
      backgroundRenderMode: backgroundRenderMode.value,
      'onUpdate:backgroundRenderMode': (
        v: 'tiled' | 'panorama' | undefined
      ) => {
        if (v) backgroundRenderMode.value = v
      },
      fov: fov.value,
      'onUpdate:fov': (v: number | undefined) => {
        if (v !== undefined) fov.value = v
      },
      hdriActive: opts.hdriActive ?? false,
      onUpdateBackgroundImage: opts.onUpdateBackgroundImage
    },
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })

  return {
    ...utils,
    showGrid,
    backgroundColor,
    backgroundRenderMode,
    user: userEvent.setup()
  }
}

describe('SceneControls', () => {
  describe('grid', () => {
    it('flips showGrid via v-model when the grid button is clicked', async () => {
      const { user, showGrid } = renderComponent({ showGrid: false })

      await user.click(screen.getByRole('button', { name: 'Show grid' }))

      expect(showGrid.value).toBe(true)
    })
  })

  describe('hdriActive=true', () => {
    it('hides the background-color and upload buttons when HDRI is active', () => {
      renderComponent({ hdriActive: true, backgroundImage: '' })

      expect(
        screen.queryByRole('button', { name: 'Background color' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Upload background image' })
      ).not.toBeInTheDocument()
    })
  })

  describe('without a background image', () => {
    it('renders the background-color and upload buttons', () => {
      renderComponent({ backgroundImage: '' })

      expect(
        screen.getByRole('button', { name: 'Background color' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Upload background image' })
      ).toBeInTheDocument()
    })

    it('does not render the panorama / remove / FOV controls', () => {
      renderComponent({ backgroundImage: '' })

      expect(
        screen.queryByRole('button', { name: 'Panorama mode' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Remove background image' })
      ).not.toBeInTheDocument()
      expect(screen.queryByTestId('fov-popup-slider')).not.toBeInTheDocument()
    })

    it('updates backgroundColor v-model from the hidden color picker', async () => {
      const { backgroundColor, container } = renderComponent({
        backgroundImage: '',
        backgroundColor: '#000000'
      })

      const colorInput = container.querySelector(
        'input[type="color"]'
      ) as HTMLInputElement
      colorInput.value = '#ff0000'
      colorInput.dispatchEvent(new Event('input', { bubbles: true }))

      expect(backgroundColor.value).toBe('#ff0000')
    })

    it('emits updateBackgroundImage with the picked file', async () => {
      const onUpdateBackgroundImage = vi.fn()
      const { container } = renderComponent({
        backgroundImage: '',
        onUpdateBackgroundImage
      })

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      const file = new File(['data'], 'bg.png', { type: 'image/png' })
      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change'))

      expect(onUpdateBackgroundImage).toHaveBeenCalledWith(file)
    })
  })

  describe('with a background image', () => {
    it('renders the panorama and remove buttons', () => {
      renderComponent({ backgroundImage: 'bg.png' })

      expect(
        screen.getByRole('button', { name: 'Panorama mode' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Remove background image' })
      ).toBeInTheDocument()
    })

    it('toggles backgroundRenderMode between tiled and panorama on the panorama button', async () => {
      const { user, backgroundRenderMode } = renderComponent({
        backgroundImage: 'bg.png',
        backgroundRenderMode: 'tiled'
      })

      await user.click(screen.getByRole('button', { name: 'Panorama mode' }))
      expect(backgroundRenderMode.value).toBe('panorama')
    })

    it('hides the FOV PopupSlider in tiled mode', () => {
      renderComponent({
        backgroundImage: 'bg.png',
        backgroundRenderMode: 'tiled'
      })

      expect(screen.queryByTestId('fov-popup-slider')).not.toBeInTheDocument()
    })

    it('shows the FOV PopupSlider in panorama mode', () => {
      renderComponent({
        backgroundImage: 'bg.png',
        backgroundRenderMode: 'panorama'
      })

      expect(screen.getByTestId('fov-popup-slider')).toBeInTheDocument()
    })

    it('emits updateBackgroundImage(null) when the remove button is clicked', async () => {
      const onUpdateBackgroundImage = vi.fn()
      const { user } = renderComponent({
        backgroundImage: 'bg.png',
        onUpdateBackgroundImage
      })

      await user.click(
        screen.getByRole('button', { name: 'Remove background image' })
      )

      expect(onUpdateBackgroundImage).toHaveBeenCalledWith(null)
    })
  })
})
