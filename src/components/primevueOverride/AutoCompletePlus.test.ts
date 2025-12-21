import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'

import AutoCompletePlus from '@/components/primevueOverride/AutoCompletePlus.vue'

describe('AutoCompletePlus', () => {
  it('does not clear selection on change after option select when blurOnOptionSelect is enabled', () => {
    const option = { userId: '1', username: 'jim' }
    const wrapper = mount(AutoCompletePlus, {
      attachTo: document.body,
      global: {
        plugins: [PrimeVue]
      },
      props: {
        modelValue: 'ji',
        suggestions: [option],
        optionLabel: 'username',
        forceSelection: true,
        blurOnOptionSelect: true,
        appendTo: 'self'
      }
    })

    type AutoCompletePlusVm = {
      onOptionSelect: (event: Event, option: unknown) => void
      onChange: (event: Event) => void
    }
    const vm = wrapper.vm as unknown as AutoCompletePlusVm

    vm.onOptionSelect(new Event('keydown'), option)
    vm.onChange(new Event('change'))

    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(updates.some((args) => args[0] === null)).toBe(false)
  })

  it('blurs input after selecting an option when blurOnOptionSelect is enabled', async () => {
    const wrapper = mount(AutoCompletePlus, {
      attachTo: document.body,
      global: {
        plugins: [PrimeVue]
      },
      props: {
        modelValue: null,
        suggestions: [{ userId: '1', username: 'alice' }],
        optionLabel: 'username',
        blurOnOptionSelect: true,
        appendTo: 'self'
      }
    })

    const input = wrapper.find('input')
    const blurSpy = vi.spyOn(input.element as HTMLInputElement, 'blur')

    type AutoCompletePlusVm = {
      onOptionSelect: (event: Event, option: unknown) => void
    }
    const vm = wrapper.vm as unknown as AutoCompletePlusVm

    vm.onOptionSelect(new Event('click'), {
      userId: '1',
      username: 'alice'
    })

    expect(blurSpy).toHaveBeenCalled()
  })

  it('emits complete with empty query when keepOpenOnEmptyInput is enabled', async () => {
    const wrapper = mount(AutoCompletePlus, {
      attachTo: document.body,
      global: {
        plugins: [PrimeVue]
      },
      props: {
        modelValue: '',
        suggestions: [],
        keepOpenOnEmptyInput: true,
        appendTo: 'self'
      }
    })

    await wrapper.find('input').setValue('')

    const completeEmits = wrapper.emitted('complete')
    expect(completeEmits).toBeTruthy()
    expect(completeEmits?.at(-1)?.[0]).toMatchObject({ query: '' })

    expect(wrapper.emitted('clear')).toBeTruthy()
  })

  it('does not emit complete with empty query when keepOpenOnEmptyInput is disabled', async () => {
    const wrapper = mount(AutoCompletePlus, {
      attachTo: document.body,
      global: {
        plugins: [PrimeVue]
      },
      props: {
        modelValue: '',
        suggestions: [],
        keepOpenOnEmptyInput: false,
        appendTo: 'self'
      }
    })

    await wrapper.find('input').setValue('')

    const completeEmits = (wrapper.emitted('complete') ?? []) as unknown[][]
    const emittedEmptyQuery = completeEmits.some((args) => {
      const payload = args[0]
      if (payload && typeof payload === 'object' && 'query' in payload) {
        return (payload as Record<string, unknown>).query === ''
      }
      return false
    })
    expect(emittedEmptyQuery).toBe(false)
    expect(wrapper.emitted('clear')).toBeTruthy()
  })
})
