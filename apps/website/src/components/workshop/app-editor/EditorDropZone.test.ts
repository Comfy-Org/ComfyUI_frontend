import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import EditorDropZone from './EditorDropZone.vue'

const shirt = new File(['x'], 'shirt.png', { type: 'image/png' })
const notes = new File(['x'], 'notes.txt', { type: 'text/plain' })

function transfer(...files: File[]): DataTransfer {
  const data = new DataTransfer()
  files.forEach((file) => data.items.add(file))
  return data
}

function renderZone(disabled = false) {
  const { emitted } = render(EditorDropZone, {
    props: { disabled },
    attrs: { 'data-testid': 'zone' },
    slots: { default: () => h('span', 'Drop here') }
  })
  return { zone: screen.getByTestId('zone'), emitted }
}

describe('EditorDropZone', () => {
  it('lights up while a file hovers and hands over the dropped image', async () => {
    const { zone, emitted } = renderZone()

    await fireEvent.dragEnter(zone, { dataTransfer: transfer(shirt) })
    expect(zone).toHaveAttribute('data-drop-over', 'true')

    await fireEvent.drop(zone, { dataTransfer: transfer(notes, shirt) })

    expect(zone).not.toHaveAttribute('data-drop-over')
    expect(emitted('file')).toEqual([[shirt]])
  })

  it('lets go of the highlight when the file leaves', async () => {
    const { zone } = renderZone()

    await fireEvent.dragOver(zone, { dataTransfer: transfer(shirt) })
    await fireEvent.dragLeave(zone)

    expect(zone).not.toHaveAttribute('data-drop-over')
  })

  it.for([
    { name: 'a drop without an image', disabled: false, files: [notes] },
    { name: 'any drop while disabled', disabled: true, files: [shirt] }
  ])('ignores $name', async ({ disabled, files }) => {
    const { zone, emitted } = renderZone(disabled)

    await fireEvent.dragEnter(zone, { dataTransfer: transfer(...files) })
    expect(zone.hasAttribute('data-drop-over')).toBe(!disabled)
    await fireEvent.drop(zone, { dataTransfer: transfer(...files) })

    expect(emitted('file')).toBeUndefined()
  })
})
