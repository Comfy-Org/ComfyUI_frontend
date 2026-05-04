import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ViewerModelControls from '@/components/load3d/controls/viewer/ViewerModelControls.vue'
import type {
  MaterialMode,
  UpDirection
} from '@/extensions/core/load3d/interfaces'

vi.mock('primevue/select', () => ({
  default: {
    name: 'Select',
    props: ['modelValue', 'options', 'optionLabel', 'optionValue'],
    emits: ['update:modelValue'],
    template: `
      <select
        :value="modelValue"
        @change="$emit('update:modelValue', $event.target.value)"
      >
        <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    `
  }
}))

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

function getOptions(select: HTMLElement) {
  return Array.from(select.querySelectorAll('option'))
}

describe('ViewerModelControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
    it('exposes the seven supported directions', () => {
      renderControls()
      const [upDirectionSelect] = screen.getAllByRole('combobox')
      const options = getOptions(upDirectionSelect)

      expect(options.map((o) => o.getAttribute('value'))).toEqual([
        'original',
        '-x',
        '+x',
        '-y',
        '+y',
        '-z',
        '+z'
      ])
    })

    it('localizes the "original" option label and uses raw axis labels for the rest', () => {
      renderControls()
      const [upDirectionSelect] = screen.getAllByRole('combobox')
      const options = getOptions(upDirectionSelect)

      expect(options.map((o) => o.textContent?.trim())).toEqual([
        'Original',
        '-X',
        '+X',
        '-Y',
        '+Y',
        '-Z',
        '+Z'
      ])
    })
  })

  describe('material mode options', () => {
    it('emits one option per materialModes entry with localized labels', () => {
      renderControls({ materialModes: ['original', 'normal', 'wireframe'] })
      const [, materialModeSelect] = screen.getAllByRole('combobox')
      const options = getOptions(materialModeSelect)

      expect(options.map((o) => o.getAttribute('value'))).toEqual([
        'original',
        'normal',
        'wireframe'
      ])
      expect(options.map((o) => o.textContent?.trim())).toEqual([
        'Original',
        'Normal',
        'Wireframe'
      ])
    })

    it('includes pointCloud when the adapter exposes it (PLY)', () => {
      renderControls({
        materialModes: ['original', 'pointCloud', 'normal', 'wireframe']
      })
      const [, materialModeSelect] = screen.getAllByRole('combobox')
      const options = getOptions(materialModeSelect)

      expect(options).toHaveLength(4)
      expect(options[1].textContent?.trim()).toBe('Point Cloud')
      expect(options[1].getAttribute('value')).toBe('pointCloud')
    })
  })

  describe('v-model binding', () => {
    it('renders the initial upDirection as the selected option', () => {
      renderControls({ upDirection: '-z' })
      const [upDirectionSelect] = screen.getAllByRole('combobox')
      expect((upDirectionSelect as HTMLSelectElement).value).toBe('-z')
    })

    it('renders the initial materialMode as the selected option', () => {
      renderControls({ materialMode: 'normal' })
      const [, materialModeSelect] = screen.getAllByRole('combobox')
      expect((materialModeSelect as HTMLSelectElement).value).toBe('normal')
    })

    it('emits update:upDirection when a new direction is chosen', async () => {
      const listener = vi.fn()
      const { user } = renderControls({ 'onUpdate:upDirection': listener })
      const [upDirectionSelect] = screen.getAllByRole('combobox')

      await user.selectOptions(upDirectionSelect, '+x')

      expect(listener).toHaveBeenCalledWith('+x')
    })

    it('emits update:materialMode when a new mode is chosen', async () => {
      const listener = vi.fn()
      const { user } = renderControls({ 'onUpdate:materialMode': listener })
      const [, materialModeSelect] = screen.getAllByRole('combobox')

      await user.selectOptions(materialModeSelect, 'wireframe')

      expect(listener).toHaveBeenCalledWith('wireframe')
    })
  })
})
