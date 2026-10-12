import { describe, expect, it } from 'vitest'

import { imageRefViewQuery } from './compositorPaths'

describe('imageRefViewQuery', () => {
  it('builds a view query and omits empty subfolders', () => {
    expect(
      imageRefViewQuery({ filename: 'a.png', subfolder: '', type: 'temp' })
    ).toBe('filename=a.png&type=temp')
    expect(
      imageRefViewQuery({ filename: 'a.png', subfolder: 'sub', type: 'input' })
    ).toBe('filename=a.png&subfolder=sub&type=input')
  })
})
