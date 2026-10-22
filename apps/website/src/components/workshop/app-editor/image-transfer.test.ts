import { describe, expect, it } from 'vitest'

import { imageFileOf } from './image-transfer'

function transfer(...files: File[]): DataTransfer {
  const data = new DataTransfer()
  files.forEach((file) => data.items.add(file))
  return data
}

const notes = new File(['x'], 'notes.txt', { type: 'text/plain' })
const shirt = new File(['x'], 'shirt.png', { type: 'image/png' })

describe('imageFileOf', () => {
  it.for([
    { name: 'nothing', data: null, expected: undefined },
    { name: 'no image', data: transfer(notes), expected: undefined },
    {
      name: 'an image after other files',
      data: transfer(notes, shirt),
      expected: shirt
    }
  ])('reads $name', ({ data, expected }) => {
    expect(imageFileOf(data)).toBe(expected)
  })
})
