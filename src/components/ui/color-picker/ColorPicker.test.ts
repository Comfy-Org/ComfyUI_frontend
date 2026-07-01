import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import ColorPicker from './ColorPicker.vue'

describe('ColorPicker', () => {
  it('does not echo a write back when the model is changed externally', async () => {
    const onUpdate = vi.fn()
    const { rerender } = render(ColorPicker, {
      props: { modelValue: '#823182', 'onUpdate:modelValue': onUpdate }
    })

    await rerender({ modelValue: '' })
    await nextTick()
    await nextTick()

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('shows the latest external color without writing back', async () => {
    const onUpdate = vi.fn()
    const { rerender } = render(ColorPicker, {
      props: { modelValue: '#823182', 'onUpdate:modelValue': onUpdate }
    })

    await rerender({ modelValue: '#222222' })
    await nextTick()
    await nextTick()

    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByText('#222222')).toBeTruthy()
  })
})
