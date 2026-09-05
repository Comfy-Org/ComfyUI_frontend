import { beforeEach, describe, expect, it, vi } from 'vitest'

import generatedModels from './generated-models.json'
import { MODEL_DIRECTORIES, isModelDirectory } from './models'

const hoisted = vi.hoisted(() => ({
  generatedModelsOverride: null as unknown
}))

vi.mock('./generated-models.json', async (importOriginal) => {
  const actual = await importOriginal<{ default: unknown }>()
  return {
    get default() {
      return hoisted.generatedModelsOverride ?? actual.default
    }
  }
})

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

describe('loading models with an undeclared directory', () => {
  beforeEach(() => {
    hoisted.generatedModelsOverride = null
    vi.resetModules()
  })

  async function importModelsWith(directory: string): Promise<Error> {
    hoisted.generatedModelsOverride = [
      {
        slug: 'some-model',
        name: 'Some Model',
        displayName: 'Some Model',
        directory,
        huggingFaceUrl: 'https://huggingface.co/comfyanonymous/some-model',
        workflowCount: 0
      }
    ]
    vi.resetModules()

    try {
      await import('./models')
    } catch (error) {
      if (error instanceof Error) return error
      throw new TypeError(`Expected an Error, received ${String(error)}`, {
        cause: error
      })
    }
    throw new Error(
      `Expected directory ${JSON.stringify(directory)} to be rejected`
    )
  }

  it('throws naming both the directory and the model slug', async () => {
    const error = await importModelsWith('not_a_real_directory')

    expect(error.message).toContain('"not_a_real_directory"')
    expect(error.message).toContain('some-model')
  })

  it('rejects a missing directory, which the generator emits as an empty string', async () => {
    const error = await importModelsWith('')

    expect(error.message).toContain('Unknown model directory ""')
    expect(error.message).toContain('some-model')
  })
})
