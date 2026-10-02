import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import EditorUploadSlot from './EditorUploadSlot.vue'

const shirt = new File(['x'], 'shirt.png', { type: 'image/png' })
const notes = new File(['x'], 'notes.txt', { type: 'text/plain' })

function renderSlot(disabled = false) {
  const { emitted } = render(EditorUploadSlot, {
    props: {
      label: 'Upload a garment',
      inputTestId: 'garment-input',
      disabled
    },
    slots: { default: '+' }
  })
  return {
    emitted,
    button: screen.getByRole('button', { name: 'Upload a garment' }),
    input: screen.getByTestId<HTMLInputElement>('garment-input')
  }
}

describe('EditorUploadSlot', () => {
  it('opens the file picker and hands over the chosen image', async () => {
    const { emitted, button, input } = renderSlot()
    let opened = false
    input.addEventListener('click', () => (opened = true))

    await userEvent.click(button)
    expect(opened).toBe(true)

    await userEvent.upload(input, shirt)

    expect(emitted('file')).toEqual([[shirt]])
    expect(input.value).toBe('')
  })

  it('takes an image dropped on it', async () => {
    const { emitted, button } = renderSlot()
    const data = new DataTransfer()
    data.items.add(notes)
    data.items.add(shirt)

    await fireEvent.drop(button, { dataTransfer: data })

    expect(emitted('file')).toEqual([[shirt]])
  })

  it('locks while disabled', async () => {
    const { emitted, button, input } = renderSlot(true)

    expect(button).toBeDisabled()
    await userEvent.upload(input, shirt)

    expect(emitted('file')).toBeUndefined()
  })
})
