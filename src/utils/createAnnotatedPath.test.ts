import { describe, expect, it } from 'vitest'

import { createAnnotatedPath } from './createAnnotatedPath'

describe('createAnnotatedPath', () => {
  it('returns bare input paths for string items by default', () => {
    expect(createAnnotatedPath('image.png')).toBe('image.png')
  })

  it('prepends the supplied subfolder for string items', () => {
    expect(createAnnotatedPath('image.png', { subfolder: 'uploads' })).toBe(
      'uploads/image.png'
    )
  })

  it('annotates string items when the root folder is not input', () => {
    expect(createAnnotatedPath('image.png', { rootFolder: 'output' })).toBe(
      'image.png [output]'
    )
  })

  it('does not duplicate an existing annotation', () => {
    expect(
      createAnnotatedPath('image.png [temp]', { rootFolder: 'temp' })
    ).toBe('image.png [temp]')
  })

  it('formats result items with their own subfolder', () => {
    expect(
      createAnnotatedPath({
        filename: 'render.png',
        subfolder: 'final',
        type: 'output'
      })
    ).toBe('final/render.png [output]')
  })

  it('omits the result-item annotation when type matches the root folder', () => {
    expect(
      createAnnotatedPath(
        {
          filename: 'render.png',
          subfolder: '',
          type: 'output'
        },
        { rootFolder: 'output' }
      )
    ).toBe('render.png')
  })

  it('handles missing result-item filenames', () => {
    expect(createAnnotatedPath({ subfolder: 'folder', type: 'temp' })).toBe(
      'folder/ [temp]'
    )
  })
})
