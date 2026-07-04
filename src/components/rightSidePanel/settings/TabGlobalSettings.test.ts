import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import type { VNodeChild } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import TabGlobalSettings from './TabGlobalSettings.vue'

type StubProps = Record<string, unknown>
type StubEmit = (event: string, ...args: unknown[]) => void
interface StubContext {
  emit: StubEmit
  slots: { default?: () => VNodeChild[] }
}

const store = vi.hoisted(() => ({ values: {} as Record<string, unknown> }))
const settingsDialogShow = vi.hoisted(() => vi.fn())
const reg = vi.hoisted(() => ({
  items: [] as { name: string; props: StubProps; emit: StubEmit }[]
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => store.values[key],
    set: vi.fn((key: string, value: unknown) => {
      store.values[key] = value
    })
  })
}))

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: () => ({ show: settingsDialogShow })
}))

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: () => ({
    completedActivePalette: {
      colors: { litegraph_base: { CLEAR_BACKGROUND_COLOR: '#222222' } }
    }
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function modelStub(name: string) {
  return {
    name,
    props: ['modelValue', 'disabled', 'options', 'label'],
    emits: ['update:modelValue'],
    setup(props: StubProps, { emit, slots }: StubContext) {
      reg.items.push({ name, props, emit })
      return () => h('div', {}, slots.default ? slots.default() : [])
    }
  }
}

const passthroughStub = (name: string) => ({
  name,
  setup(_: StubProps, { slots }: StubContext) {
    return () => h('div', {}, slots.default ? slots.default() : [])
  }
})

const ButtonStub = {
  name: 'Button',
  props: ['ariaLabel'],
  emits: ['click'],
  setup(props: StubProps, { emit, slots }: StubContext) {
    return () =>
      h(
        'button',
        {
          'aria-label': props.ariaLabel as string,
          onClick: () => emit('click')
        },
        slots.default ? slots.default() : []
      )
  }
}

function renderTab() {
  reg.items = []
  return render(TabGlobalSettings, {
    global: {
      plugins: [i18n],
      stubs: {
        PropertiesAccordionItem: passthroughStub('PropertiesAccordionItem'),
        LayoutField: passthroughStub('LayoutField'),
        FieldSwitch: modelStub('FieldSwitch'),
        Select: modelStub('Select'),
        ColorPicker: modelStub('ColorPicker'),
        BackgroundImageUpload: modelStub('BackgroundImageUpload'),
        Slider: modelStub('Slider'),
        InputNumber: modelStub('InputNumber'),
        Button: ButtonStub
      }
    }
  })
}

const find = (name: string) => reg.items.find((i) => i.name === name)
const backgroundSelect = () =>
  reg.items.find(
    (i) => i.name === 'Select' && typeof i.props.modelValue === 'string'
  )!

describe('TabGlobalSettings canvas background', () => {
  beforeEach(() => {
    store.values = {
      'Comfy.Node.AlwaysShowAdvancedWidgets': false,
      'Comfy.Canvas.SelectionToolbox': true,
      'Comfy.VueNodes.Enabled': true,
      'Comfy.Canvas.BackgroundImage': '',
      'Comfy.Canvas.BackgroundPattern': 'dots',
      'Comfy.Canvas.BackgroundColor': '',
      'Comfy.SnapToGrid.GridSize': 20,
      'pysssss.SnapToGrid': false,
      'Comfy.Graph.LinkMarkers': 0,
      'Comfy.LinkRenderMode': 2
    }
    settingsDialogShow.mockClear()
  })

  it('shows the color picker (not the image upload) in pattern mode', () => {
    renderTab()
    expect(find('ColorPicker')).toBeTruthy()
    expect(find('BackgroundImageUpload')).toBeUndefined()
  })

  it('shows the image upload (not the color picker) when an image is set', () => {
    store.values['Comfy.Canvas.BackgroundImage'] = '/api/view?filename=x.png'
    renderTab()
    expect(find('BackgroundImageUpload')).toBeTruthy()
    expect(find('ColorPicker')).toBeUndefined()
  })

  it('keeps the selector on image when image mode is chosen without an image', async () => {
    renderTab()
    backgroundSelect().emit('update:modelValue', 'image')
    expect(store.values['Comfy.Canvas.BackgroundPattern']).toBe('dots')
  })

  it('selecting a pattern clears any existing image and stores the pattern', () => {
    store.values['Comfy.Canvas.BackgroundImage'] = '/api/view?filename=x.png'
    renderTab()
    backgroundSelect().emit('update:modelValue', 'grid')
    expect(store.values['Comfy.Canvas.BackgroundImage']).toBe('')
    expect(store.values['Comfy.Canvas.BackgroundPattern']).toBe('grid')
  })

  it('writes the background color without the leading hash', () => {
    renderTab()
    find('ColorPicker')!.emit('update:modelValue', '#aabbcc')
    expect(store.values['Comfy.Canvas.BackgroundColor']).toBe('aabbcc')
  })

  it('clearing the background image keeps the selector in image mode', async () => {
    store.values['Comfy.Canvas.BackgroundImage'] = '/api/view?filename=x.png'
    renderTab()
    find('BackgroundImageUpload')!.emit('update:modelValue', '')
    await nextTick()

    expect(store.values['Comfy.Canvas.BackgroundImage']).toBe('')
    // The selector stays on image mode (upload shown, color picker hidden)
    expect(backgroundSelect().props.modelValue).toBe('image')
    expect(find('BackgroundImageUpload')).toBeTruthy()
    expect(find('ColorPicker')).toBeUndefined()
  })

  it('resets the custom color from the reset button', async () => {
    store.values['Comfy.Canvas.BackgroundColor'] = 'aabbcc'
    renderTab()
    const reset = screen.getByLabelText(
      'Reset background color to theme default'
    )
    await userEvent.click(reset)
    expect(store.values['Comfy.Canvas.BackgroundColor']).toBe('')
  })

  it('updates grid spacing from the slider and clamps the number input', () => {
    renderTab()
    const slider = reg.items.find((i) => i.name === 'Slider')!
    slider.emit('update:modelValue', [35])
    expect(store.values['Comfy.SnapToGrid.GridSize']).toBe(35)

    const input = reg.items.find((i) => i.name === 'InputNumber')!
    input.emit('update:modelValue', 9999)
    expect(store.values['Comfy.SnapToGrid.GridSize']).toBe(100)
  })

  it('toggles boolean settings through the field switches', () => {
    renderTab()
    const switches = reg.items.filter((i) => i.name === 'FieldSwitch')
    for (const s of switches) s.emit('update:modelValue', true)
    expect(store.values['Comfy.VueNodes.Enabled']).toBe(true)
  })

  it('opens the full settings dialog from the footer button', async () => {
    renderTab()
    await userEvent.click(screen.getByText('View all settings'))
    expect(settingsDialogShow).toHaveBeenCalled()
  })
})
