import { describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/app', () => ({
  app: {
    getRandParam: () => '&rand=12345'
  }
}))

import { getResourceURL, splitFilePath } from './resourceUrl'

describe('splitFilePath', () => {
  it('returns empty subfolder for filename without path', () => {
    expect(splitFilePath('image.png')).toEqual(['', 'image.png'])
  })

  it('splits path into subfolder and filename', () => {
    expect(splitFilePath('models/checkpoints/model.safetensors')).toEqual([
      'models/checkpoints',
      'model.safetensors'
    ])
  })

  it('handles single directory level', () => {
    expect(splitFilePath('subfolder/file.txt')).toEqual([
      'subfolder',
      'file.txt'
    ])
  })

  it('handles empty string', () => {
    expect(splitFilePath('')).toEqual(['', ''])
  })
})

describe('getResourceURL', () => {
  it('builds URL with default type', () => {
    const url = getResourceURL('models', 'model.safetensors')
    expect(url).toContain('/view?')
    expect(url).toContain('filename=model.safetensors')
    expect(url).toContain('type=input')
    expect(url).toContain('subfolder=models')
  })

  it('builds URL with custom type', () => {
    const url = getResourceURL('outputs', 'result.png', 'output')
    expect(url).toContain('type=output')
  })

  it('encodes special characters in filename', () => {
    const url = getResourceURL('', 'file with spaces.png')
    expect(url).toContain('filename=file%20with%20spaces.png')
  })
})
