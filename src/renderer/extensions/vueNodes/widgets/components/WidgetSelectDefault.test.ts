import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'

import SelectPlus from '@/components/primevueOverride/SelectPlus.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetSelectDefault from './WidgetSelectDefault.vue'

describe('WidgetSelectDefault', () => {
  const createWidget = (
    values: unknown
  ): SimplifiedWidget<string | undefined> => ({
    name: 'test_combo',
    type: 'combo',
    value: undefined,
    options: { values } as SimplifiedWidget['options']
  })

  const mountComponent = (widget: SimplifiedWidget<string | undefined>) =>
    mount(WidgetSelectDefault, {
      props: { widget },
      global: {
        plugins: [PrimeVue],
        components: { SelectPlus }
      }
    })

  describe('function-valued options', () => {
    it('resolves options from a function', () => {
      const widget = createWidget(() => ['a', 'b', 'c'])
      const wrapper = mountComponent(widget)

      expect(wrapper.findComponent(SelectPlus).props('options')).toEqual([
        'a',
        'b',
        'c'
      ])
    })

    it('re-evaluates function on show event', async () => {
      let items = ['x', 'y']
      const widget = createWidget(() => items)
      const wrapper = mountComponent(widget)

      items = ['x', 'y', 'z']
      wrapper.findComponent(SelectPlus).vm.$emit('show')
      await nextTick()

      expect(wrapper.findComponent(SelectPlus).props('options')).toEqual([
        'x',
        'y',
        'z'
      ])
    })

    it('re-evaluates function on filter event', async () => {
      let items = ['a']
      const widget = createWidget(() => items)
      const wrapper = mountComponent(widget)

      items = ['a', 'b']
      wrapper.findComponent(SelectPlus).vm.$emit('filter')
      await nextTick()

      expect(wrapper.findComponent(SelectPlus).props('options')).toEqual([
        'a',
        'b'
      ])
    })
  })
})
