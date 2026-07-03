import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ColorPaletteMessage from './ColorPaletteMessage.vue'

import type * as Pinia from 'pinia'

const testI18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

const mockSettingStore = vi.hoisted(() => ({
  set: vi.fn()
}))

const mockColorPaletteService = vi.hoisted(() => ({
  exportColorPalette: vi.fn(),
  importColorPalette: vi.fn(),
  deleteCustomColorPalette: vi.fn()
}))

const mockColorPaletteState = vi.hoisted(() => ({
  refs: null as null | {
    palettes: {
      value: Array<{ id: string; name: string }>
    }
    activePaletteId: {
      value: string
    }
  },
  customPaletteIds: new Set<string>()
}))

vi.mock('pinia', async (importOriginal: () => Promise<typeof Pinia>) => {
  const actual = await importOriginal()
  return {
    ...actual,
    storeToRefs: (store: object) => store
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => mockSettingStore
}))

vi.mock('@/services/colorPaletteService', () => ({
  useColorPaletteService: () => mockColorPaletteService
}))

vi.mock('@/stores/workspace/colorPaletteStore', async () => {
  const { ref } = await import('vue')

  const palettes = ref([
    { id: 'builtin', name: 'Builtin' },
    { id: 'custom', name: 'Custom' }
  ])
  const activePaletteId = ref('builtin')

  mockColorPaletteState.refs = {
    palettes,
    activePaletteId
  }

  return {
    useColorPaletteStore: () => ({
      palettes,
      activePaletteId,
      isCustomPalette: (paletteId: string) =>
        mockColorPaletteState.customPaletteIds.has(paletteId)
    })
  }
})

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    props: ['title', 'disabled'],
    emits: ['click'],
    template: `
      <button
        type="button"
        :title="title"
        :disabled="disabled"
        @click="$emit('click')"
      >
        <slot />
      </button>
    `
  }
}))

vi.mock('primevue/message', () => ({
  default: {
    template: '<section><slot /></section>'
  }
}))

vi.mock('primevue/select', () => ({
  default: {
    props: ['modelValue', 'options'],
    emits: ['update:modelValue'],
    template: `
      <select
        data-testid="palette-select"
        :value="modelValue"
        @change="$emit('update:modelValue', $event.target.value)"
      >
        <option v-for="option in options" :key="option.id" :value="option.id">
          {{ option.name }}
        </option>
      </select>
    `
  }
}))

function renderMessage() {
  return render(ColorPaletteMessage, {
    global: {
      plugins: [testI18n]
    }
  })
}

describe('ColorPaletteMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingStore.set.mockResolvedValue(undefined)
    mockColorPaletteService.importColorPalette.mockResolvedValue(null)
    mockColorPaletteState.customPaletteIds = new Set(['custom'])
    if (mockColorPaletteState.refs) {
      mockColorPaletteState.refs.activePaletteId.value = 'builtin'
      mockColorPaletteState.refs.palettes.value = [
        { id: 'builtin', name: 'Builtin' },
        { id: 'custom', name: 'Custom' }
      ]
    }
  })

  it('exports and deletes the active custom palette', async () => {
    renderMessage()

    await userEvent.click(screen.getByTitle('g.export'))
    expect(mockColorPaletteService.exportColorPalette).toHaveBeenCalledWith(
      'builtin'
    )
    expect(screen.getByTitle('g.delete')).toBeDisabled()

    await fireEvent.update(screen.getByTestId('palette-select'), 'custom')
    await userEvent.click(screen.getByTitle('g.delete'))

    expect(
      mockColorPaletteService.deleteCustomColorPalette
    ).toHaveBeenCalledWith('custom')
  })

  it('persists imported palettes only when import returns a palette', async () => {
    renderMessage()

    await userEvent.click(screen.getByTitle('g.import'))
    expect(mockSettingStore.set).not.toHaveBeenCalled()

    mockColorPaletteService.importColorPalette.mockResolvedValue({
      id: 'imported',
      name: 'Imported'
    })

    await userEvent.click(screen.getByTitle('g.import'))
    expect(mockSettingStore.set).toHaveBeenCalledWith(
      'Comfy.ColorPalette',
      'imported'
    )
  })
})
