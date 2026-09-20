import { describe, expect, it } from 'vitest'

import { modelSearchText } from './_search'

describe('modelSearchText', () => {
  it.for([
    {
      case: 'maps a known directory to its label',
      model: {
        displayName: 'Flux 2',
        name: 'flux2',
        slug: 'flux-2',
        directory: 'loras'
      },
      expected: 'flux 2 flux2 flux-2 lora'
    },
    {
      case: 'falls back to the raw directory when unmapped',
      model: {
        displayName: 'DepthAnything',
        name: 'depth_anything',
        slug: 'depth-anything',
        directory: 'geometry_estimation'
      },
      expected:
        'depthanything depth_anything depth-anything geometry_estimation'
    },
    {
      case: 'keeps the directory label when name fields are empty',
      model: { displayName: '', name: '', slug: '', directory: 'vae' },
      expected: '   vae'
    }
  ] as const)('$case', ({ model, expected }) => {
    expect(modelSearchText(model)).toBe(expected)
  })
})
