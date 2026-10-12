import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

import { savedImageUrls } from './savedImageUrls'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))

describe('savedImageUrls', () => {
  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation((path) => `/api${path}`)
    vi.mocked(app.getRandParam).mockReturnValue('&rand=0.5')
  })

  it('builds a /view URL for every saved image, keeping subfolder and type', () => {
    expect(
      savedImageUrls([
        { filename: 'a.png', subfolder: 'sub', type: 'temp' },
        { filename: 'b.png', type: 'output' }
      ])
    ).toEqual([
      '/api/view?filename=a.png&subfolder=sub&type=temp',
      '/api/view?filename=b.png&type=output'
    ])
  })

  it('keeps the content version so a rewritten file gets a new URL', () => {
    expect(
      savedImageUrls([
        { filename: 'a.png', type: 'output', version: '18dd-46' }
      ])
    ).toEqual(['/api/view?filename=a.png&type=output&version=18dd-46'])
  })

  it('appends the preview format param', () => {
    vi.spyOn(app, 'getPreviewFormatParam').mockReturnValue('&preview=webp')

    expect(savedImageUrls([{ filename: 'a.png', type: 'temp' }])).toEqual([
      '/api/view?filename=a.png&type=temp&preview=webp'
    ])
  })

  it.for([
    { name: 'nothing saved', saved: undefined },
    { name: 'a non-array value', saved: { filename: 'a.png' } },
    { name: 'an item that is not a result item', saved: [{ filename: 1 }] }
  ])('returns no URLs for $name', ({ saved }) => {
    expect(savedImageUrls(saved)).toEqual([])
  })
})
