import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ViewerModelControls from '@/components/load3d/controls/viewer/ViewerModelControls.vue'
import type {
  MaterialMode,
  UpDirection
} from '@/extensions/core/load3d/interfaces'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      load3d: {
        upDirection: 'Up direction',
        materialMode: 'Material mode',
        upDirections: { original: 'Original' },
        materialModes: {
          original: 'Original',
          normal: 'Normal',
          wireframe: 'Wireframe',
          pointCloud: 'Point Cloud',
          depth: 'Depth'
        }
      }
    }
  }
})

type RenderProps = {
  upDirection?: UpDirection
  materialMode?: MaterialMode
  materialModes?: readonly MaterialMode[]
  'onUpdate:upDirection'?: (value: UpDirection | undefined) => void
  'onUpdate:materialMode'?: (value: MaterialMode | undefined) => void
}

function renderControls(overrides: RenderProps = {}) {
  const result = render(ViewerModelControls, {
    props: {
      upDirection: 'original',
      materialMode: 'original',
      materialModes: ['original', 'normal', 'wireframe'],
      ...overrides
    },
    global: {
      plugins: [i18n]
    }
  })
  return { ...result, user: userEvent.setup() }
}

describe('ViewerModelControls', () => {
  describe('rendering', () => {
    it('renders both up direction and material mode selects by default', () => {
      renderControls()
      expect(screen.getAllByRole('combobox')).toHaveLength(2)
      expect(screen.getByText('Up direction')).toBeInTheDocument()
      expect(screen.getByText('Material mode')).toBeInTheDocument()
    })

    it('hides the material mode select when materialModes is empty', () => {
      renderControls({ materialModes: [] })
      expect(screen.getAllByRole('combobox')).toHaveLength(1)
      expect(screen.queryByText('Material mode')).not.toBeInTheDocument()
    })
  })

  describe('up direction options', () => {
    it('exposes the seven supported directions', async () => {
      const { user } = renderControls()
      const [upDirectionSelect] = screen.getAllByRole('combobox')
      await user.click(upDirectionSelect)
      const options = await screen.findAllByRole('option')

      expect(options.map((o) => o.textContent.trim())).toEqual([
        'Original',
        '-X',
        '+X',
        '-Y',
        '+Y',
        '-Z',
        '+Z'
      ])
    })

    it.for([
      ['Original', 'original'],
      ['-X', '-x'],
      ['+X', '+x'],
      ['-Y', '-y'],
      ['+Y', '+y'],
      ['-Z', '-z'],
      ['+Z', '+z']
    ])('selects %s as %s', async ([label, value]) => {
      const listener = vi.fn()
      const { user } = renderControls({
        upDirection: undefined,
        'onUpdate:upDirection': listener
      })
      const [upDirectionSelect] = screen.getAllByRole('combobox')
      await user.click(upDirectionSelect)
      await user.click(await screen.findByRole('option', { name: label }))
      expect(listener).toHaveBeenCalledWith(value)
    })
  })

  describe('material mode options', () => {
    it('emits one option per materialModes entry with localized labels', async () => {
      const { user } = renderControls({
        materialModes: ['original', 'normal', 'wireframe']
      })
      const [, materialModeSelect] = screen.getAllByRole('combobox')
      await user.click(materialModeSelect)
      const options = await screen.findAllByRole('option')

      expect(options).toHaveLength(3)
      expect(options.map((o) => o.textContent.trim())).toEqual([
        'Original',
        'Normal',
        'Wireframe'
      ])
    })

    it('includes pointCloud when the adapter exposes it (PLY)', async () => {
      const listener = vi.fn()
      const { user } = renderControls({
        materialModes: ['original', 'pointCloud', 'normal', 'wireframe'],
        'onUpdate:materialMode': listener
      })
      const [, materialModeSelect] = screen.getAllByRole('combobox')
      await user.click(materialModeSelect)
      const options = await screen.findAllByRole('option')

      expect(options).toHaveLength(4)
      expect(options[1].textContent.trim()).toBe('Point Cloud')
      await user.click(screen.getByRole('option', { name: 'Point Cloud' }))
      expect(listener).toHaveBeenCalledWith('pointCloud')
    })
  })

  describe('v-model binding', () => {
    it('renders the initial upDirection as the selected option', async () => {
      renderControls({ upDirection: '-z' })
      const [upDirectionSelect] = screen.getAllByRole('combobox')
      await waitFor(() => expect(upDirectionSelect).toHaveTextContent('-Z'))
    })

    it('renders the initial materialMode as the selected option', async () => {
      renderControls({ materialMode: 'normal' })
      const [, materialModeSelect] = screen.getAllByRole('combobox')
      await waitFor(() =>
        expect(materialModeSelect).toHaveTextContent('Normal')
      )
    })

    it('emits update:upDirection when a new direction is chosen', async () => {
      const listener = vi.fn()
      const { user } = renderControls({ 'onUpdate:upDirection': listener })
      const [upDirectionSelect] = screen.getAllByRole('combobox')

      await user.click(upDirectionSelect)
      await user.click(await screen.findByRole('option', { name: '+X' }))

      expect(listener).toHaveBeenCalledWith('+x')
    })

    it('emits update:materialMode when a new mode is chosen', async () => {
      const listener = vi.fn()
      const { user } = renderControls({ 'onUpdate:materialMode': listener })
      const [, materialModeSelect] = screen.getAllByRole('combobox')

      await user.click(materialModeSelect)
      await user.click(await screen.findByRole('option', { name: 'Wireframe' }))

      expect(listener).toHaveBeenCalledWith('wireframe')
    })
  })
})
