import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { useImagePaste } from './useImagePaste'

const shirt = new File(['x'], 'shirt.png', { type: 'image/png' })
const notes = new File(['x'], 'notes.txt', { type: 'text/plain' })

function paste(...files: File[]): Event {
  const data = new DataTransfer()
  files.forEach((file) => data.items.add(file))
  const event = new Event('paste', { cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: data })
  document.dispatchEvent(event)
  return event
}

function mount(ready?: () => boolean) {
  const take = vi.fn()
  render(
    defineComponent({
      setup() {
        useImagePaste(take, ready)
        return () => null
      }
    })
  )
  return take
}

describe('useImagePaste', () => {
  it('takes a pasted image and keeps the browser from pasting it', () => {
    const take = mount()

    const event = paste(notes, shirt)

    expect(take).toHaveBeenCalledWith(shirt)
    expect(event.defaultPrevented).toBe(true)
  })

  it.for([
    { name: 'a paste without an image', ready: true, files: [notes] },
    { name: 'an image while not ready', ready: false, files: [shirt] }
  ])('leaves $name alone', ({ ready, files }) => {
    const take = mount(() => ready)

    const event = paste(...files)

    expect(take).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })
})
