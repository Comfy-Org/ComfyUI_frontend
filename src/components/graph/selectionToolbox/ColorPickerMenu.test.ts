import { mount } from '@vue/test-utils'
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
  it('renders a PrimeVue picker for custom color submenu entries', async () => {
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

    const picker = wrapper.findComponent({ name: 'ColorPicker' })
    expect(picker.exists()).toBe(true)
    expect(picker.props('modelValue')).toBe('112233')

    picker.vm.$emit('update:model-value', 'fedcba')
    await wrapper.vm.$nextTick()

    expect(onColorPick).toHaveBeenCalledWith('#fedcba')
  })
})
