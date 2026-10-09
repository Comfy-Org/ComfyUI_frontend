import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

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
  it('shows a snippet of the fetched text', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('hello world'))

    render(MediaTextTop, { props: { asset: makeAsset() } })

    expect(await screen.findByText('hello world')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('http://example.com/result.txt')
  })

  it('prefers preview_url over src', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('preview text'))

    render(MediaTextTop, {
      props: {
        asset: makeAsset({ preview_url: 'http://server/preview.txt' })
      }
    })

    expect(await screen.findByText('preview text')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('http://server/preview.txt')
  })
})
