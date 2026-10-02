import { describe, expect, it } from 'vitest'

import { firstImage } from './files'

const file = (name: string, type: string) => new File(['x'], name, { type })

describe('firstImage', () => {
  it.for([
    { name: 'nothing', files: undefined, picked: undefined },
    {
      name: 'no image',
      files: [file('a.txt', 'text/plain')],
      picked: undefined
    },
    {
      name: 'the first image after other files',
      files: [
        file('a.txt', 'text/plain'),
        file('b.png', 'image/png'),
        file('c.jpg', 'image/jpeg')
      ],
      picked: 'b.png'
    }
  ])('picks $name', ({ files, picked }) => {
    expect(firstImage(files)?.name).toBe(picked)
  })
})
