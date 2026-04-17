import { mount } from '@vue/test-utils'
import ColorPicker from 'primevue/colorpicker'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'

import type { MenuOption } from '@/composables/graph/useMoreOptionsMenu'

import ColorPickerMenu from './ColorPickerMenu.vue'

vi.mock('@/composables/graph/useNodeCustomization', () => ({
  useNodeCustomization: () => ({
    getCurrentShape: () => null
  })
}))

describe('ColorPickerMenu', () => {
  it('renders a compact PrimeVue picker panel for custom color submenu entries', async () => {
    const onColorPick = vi.fn()
    const option: MenuOption = {
      label: 'Color',
      hasSubmenu: true,
      action: () => {},
      submenu: [
        {
          label: 'Custom',
          action: () => {},
          pickerValue: '112233',
          onColorPick
        }
      ]
    }

    const wrapper = mount(ColorPickerMenu, {
      props: { option },
      global: {
        plugins: [PrimeVue],
        stubs: {
          Popover: {
            template: '<div><slot /></div>'
          }
        }
      }
    })

    const picker = wrapper.findComponent(ColorPicker)
    expect(picker.exists()).toBe(true)
    expect(picker.props('modelValue')).toBe('112233')
    expect(picker.props('inline')).toBe(true)
    expect(wrapper.text()).toContain('#112233')

    picker.vm.$emit('update:model-value', 'fedcba')
    await wrapper.vm.$nextTick()

    expect(onColorPick).toHaveBeenCalledWith('#fedcba')
  })

  it('shows preset swatches in a compact grid when color presets are available', () => {
    const option: MenuOption = {
      label: 'Color',
      hasSubmenu: true,
      action: () => {},
      submenu: [
        {
          label: 'Custom',
          action: () => {},
          pickerValue: '112233',
          onColorPick: vi.fn()
        },
        {
          label: 'Red',
          action: () => {},
          color: '#ff0000'
        },
        {
          label: 'Green',
          action: () => {},
          color: '#00ff00'
        }
      ]
    }

    const wrapper = mount(ColorPickerMenu, {
      props: { option },
      global: {
        plugins: [PrimeVue],
        stubs: {
          Popover: {
            template: '<div><slot /></div>'
          }
        }
      }
    })

    expect(wrapper.findAll('button[title]').map((node) => node.attributes('title'))).toEqual([
      'Red',
      'Green'
    ])
  })
})
