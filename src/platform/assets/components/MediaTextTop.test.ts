import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AssetMeta } from '../schemas/mediaAssetSchema'
import MediaTextTop from './MediaTextTop.vue'

function makeAsset(overrides: Partial<AssetMeta> = {}): AssetMeta {
  return {
    id: 'asset-1',
    name: 'result.txt',
    tags: [],
    kind: 'text',
    src: 'http://example.com/result.txt',
    ...overrides
  } as AssetMeta
}

describe('MediaTextTop', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a snippet of the fetched text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('hello world')
    })
    vi.stubGlobal('fetch', fetchMock)

    render(MediaTextTop, { props: { asset: makeAsset() } })

    expect(await screen.findByText('hello world')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('http://example.com/result.txt')
  })

  it('prefers preview_url over src', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('preview text')
    })
    vi.stubGlobal('fetch', fetchMock)

    render(MediaTextTop, {
      props: {
        asset: makeAsset({ preview_url: 'http://server/preview.txt' })
      }
    })

    expect(await screen.findByText('preview text')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('http://server/preview.txt')
  })
})
