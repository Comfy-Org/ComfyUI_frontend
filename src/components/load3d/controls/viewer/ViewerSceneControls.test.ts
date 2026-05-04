import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import ViewerSceneControls from '@/components/load3d/controls/viewer/ViewerSceneControls.vue'

vi.mock('primevue/checkbox', () => ({
  default: {
    name: 'Checkbox',
    props: ['modelValue', 'inputId', 'binary', 'name'],
    emits: ['update:modelValue'],
    template: `
      <input
        type="checkbox"
        :id="inputId"
        :name="name"
        :checked="modelValue"
        @change="$emit('update:modelValue', $event.target.checked)"
      />
    `
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      load3d: {
        backgroundColor: 'Background color',
        showGrid: 'Show grid',
        uploadBackgroundImage: 'Upload background image',
        tiledMode: 'Tiled',
        panoramaMode: 'Panorama',
        removeBackgroundImage: 'Remove background image'
      }
    }
  }
})

type RenderProps = {
  backgroundColor?: string
  showGrid?: boolean
  backgroundRenderMode?: 'tiled' | 'panorama'
  hasBackgroundImage?: boolean
  disableBackgroundUpload?: boolean
  onUpdateBackgroundImage?: (file: File | null) => void
}

function renderComponent(overrides: RenderProps = {}) {
  const backgroundColor = ref<string>(overrides.backgroundColor ?? '#282828')
  const showGrid = ref<boolean>(overrides.showGrid ?? true)
  const backgroundRenderMode = ref<'tiled' | 'panorama'>(
    overrides.backgroundRenderMode ?? 'tiled'
  )

  const utils = render(ViewerSceneControls, {
    props: {
      backgroundColor: backgroundColor.value,
      'onUpdate:backgroundColor': (v: string | undefined) => {
        if (v !== undefined) backgroundColor.value = v
      },
      showGrid: showGrid.value,
      'onUpdate:showGrid': (v: boolean | undefined) => {
        if (v !== undefined) showGrid.value = v
      },
      backgroundRenderMode: backgroundRenderMode.value,
      'onUpdate:backgroundRenderMode': (
        v: 'tiled' | 'panorama' | undefined
      ) => {
        if (v) backgroundRenderMode.value = v
      },
      hasBackgroundImage: overrides.hasBackgroundImage ?? false,
      disableBackgroundUpload: overrides.disableBackgroundUpload ?? false,
      onUpdateBackgroundImage: overrides.onUpdateBackgroundImage
    },
    global: { plugins: [i18n] }
  })

  return {
    ...utils,
    backgroundColor,
    showGrid,
    backgroundRenderMode,
    user: userEvent.setup()
  }
}

describe('ViewerSceneControls', () => {
  describe('without a background image', () => {
    it('renders the color picker', () => {
      renderComponent({ hasBackgroundImage: false })

      expect(screen.getByText('Background color')).toBeInTheDocument()
    })

    it('renders the upload button when uploads are not disabled', () => {
      renderComponent({
        hasBackgroundImage: false,
        disableBackgroundUpload: false
      })

      expect(
        screen.getByRole('button', { name: /upload background image/i })
      ).toBeInTheDocument()
    })

    it('hides the upload button when uploads are disabled', () => {
      renderComponent({
        hasBackgroundImage: false,
        disableBackgroundUpload: true
      })

      expect(
        screen.queryByRole('button', { name: /upload background image/i })
      ).not.toBeInTheDocument()
    })

    it('does not render the tiled / panorama / remove buttons', () => {
      renderComponent({ hasBackgroundImage: false })

      expect(
        screen.queryByRole('button', { name: 'Tiled' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Panorama' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /remove background image/i })
      ).not.toBeInTheDocument()
    })
  })

  describe('with a background image', () => {
    it('hides the color picker and upload button', () => {
      renderComponent({ hasBackgroundImage: true })

      expect(screen.queryByText('Background color')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /upload background image/i })
      ).not.toBeInTheDocument()
    })

    it('renders the tiled / panorama / remove buttons', () => {
      renderComponent({ hasBackgroundImage: true })

      expect(screen.getByRole('button', { name: 'Tiled' })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Panorama' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /remove background image/i })
      ).toBeInTheDocument()
    })

    it('updates backgroundRenderMode v-model to tiled when the tiled button is clicked', async () => {
      const { user, backgroundRenderMode } = renderComponent({
        hasBackgroundImage: true,
        backgroundRenderMode: 'panorama'
      })

      await user.click(screen.getByRole('button', { name: 'Tiled' }))

      expect(backgroundRenderMode.value).toBe('tiled')
    })

    it('updates backgroundRenderMode v-model to panorama when the panorama button is clicked', async () => {
      const { user, backgroundRenderMode } = renderComponent({
        hasBackgroundImage: true,
        backgroundRenderMode: 'tiled'
      })

      await user.click(screen.getByRole('button', { name: 'Panorama' }))

      expect(backgroundRenderMode.value).toBe('panorama')
    })

    it('emits updateBackgroundImage(null) when the remove button is clicked', async () => {
      const onUpdateBackgroundImage = vi.fn()
      const { user } = renderComponent({
        hasBackgroundImage: true,
        onUpdateBackgroundImage
      })

      await user.click(
        screen.getByRole('button', { name: /remove background image/i })
      )

      expect(onUpdateBackgroundImage).toHaveBeenCalledWith(null)
    })
  })

  describe('show grid', () => {
    it('emits the toggled value via v-model', async () => {
      const { user, showGrid } = renderComponent({ showGrid: true })
      const checkbox = screen.getByRole('checkbox')

      await user.click(checkbox)

      expect(showGrid.value).toBe(false)
    })
  })
})
