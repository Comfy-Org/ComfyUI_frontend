import { describe, expect, it } from 'vitest'

import { nameWithoutTask } from './task-label'

describe('a card name beside its task pill', () => {
  it.for([
    ['Seedream 5.0 Pro Text-to-Image', 'Text to Image', 'Seedream 5.0 Pro'],
    ['LTX-2.5 Image-to-Video', 'Image to Video', 'LTX-2.5'],
    ['Seedance 2.0 Image to Video', 'Image to Video', 'Seedance 2.0'],
    ['Kling Lip Sync Audio-to-Video', 'Audio to Video', 'Kling Lip Sync']
  ] as const)('drops the tail of %s', ([name, task, shortened]) => {
    expect(nameWithoutTask(name, task)).toBe(shortened)
  })

  it.for([
    ['the tail names another task', 'FLUX 3 Text-to-Video', 'Image to Video'],
    ['the name says nothing of it', 'Nano Banana Pro', 'Text to Image'],
    ['the name is only the task', 'Image to Video', 'Image to Video'],
    ['there is no pill to repeat', 'LTX-2.5 Image-to-Video', '']
  ] as const)('keeps the whole name when %s', ([, name, task]) => {
    expect(nameWithoutTask(name, task)).toBe(name)
  })

  it('reads the pill in the reader’s own language', () => {
    expect(nameWithoutTask('Seedream 5.0 文生图', '文生图')).toBe(
      'Seedream 5.0'
    )
  })
})
