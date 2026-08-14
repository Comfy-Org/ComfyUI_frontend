import { describe, expect, it } from 'vitest'

import generatedModels from './generated-models.json'
import { MODEL_DIRECTORIES, isModelDirectory } from './models'

describe('isModelDirectory', () => {
  it('accepts every declared directory', () => {
    for (const directory of MODEL_DIRECTORIES) {
      expect(isModelDirectory(directory)).toBe(true)
    }
  })

  it.for([
    { label: 'an undeclared directory', value: 'not_a_real_directory' },
    { label: 'an empty string', value: '' },
    { label: 'a near-miss', value: 'diffusion_model' },
    { label: 'an inherited Object property', value: 'toString' }
  ])('rejects $label', ({ value }) => {
    expect(isModelDirectory(value)).toBe(false)
  })
})

describe('generated model data', () => {
  it('only uses directories declared in MODEL_DIRECTORIES', () => {
    const undeclared = [
      ...new Set(generatedModels.map((model) => model.directory))
    ]
      .filter((directory) => !isModelDirectory(directory))
      .sort()

    expect(undeclared).toEqual([])
  })
})
