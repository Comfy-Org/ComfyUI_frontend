import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SegmentedControl from './SegmentedControl.vue'

describe('SegmentedControl', () => {
  it('renders all provided options as buttons', () => {
    const wrapper = mount(SegmentedControl, {
      props: { options: ['Small', 'Medium', 'Large'] }
    })
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[0].text()).toBe('Small')
    expect(buttons[1].text()).toBe('Medium')
    expect(buttons[2].text()).toBe('Large')
  })

  it('marks the selected option with data-state on', () => {
    const wrapper = mount(SegmentedControl, {
      props: { options: ['A', 'B', 'C'], modelValue: 'B' }
    })
    const buttons = wrapper.findAll('button')
    expect(buttons[0].attributes('data-state')).toBe('off')
    expect(buttons[1].attributes('data-state')).toBe('on')
    expect(buttons[2].attributes('data-state')).toBe('off')
  })

  it('emits update:modelValue on click', async () => {
    const wrapper = mount(SegmentedControl, {
      props: { options: ['A', 'B'], modelValue: 'A' }
    })
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['B'])
  })

  it('supports any count of options', () => {
    const options = ['One', 'Two', 'Three', 'Four', 'Five']
    const wrapper = mount(SegmentedControl, {
      props: { options }
    })
    expect(wrapper.findAll('button')).toHaveLength(5)
  })
})
