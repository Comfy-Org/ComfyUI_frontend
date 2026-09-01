import { render, screen } from '@testing-library/vue'
import type * as VueUseCore from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetMeta } from '../schemas/mediaAssetSchema'
import Media3DTop from './Media3DTop.vue'

const {
  mockUseIntersectionObserver,
  mockFindServerPreviewUrl,
  mockIsAssetPreviewSupported
} = vi.hoisted(() => ({
  mockUseIntersectionObserver: vi.fn(),
  mockFindServerPreviewUrl: vi.fn(),
  mockIsAssetPreviewSupported: vi.fn(() => true)
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof VueUseCore>()
  return {
    ...actual,
    useIntersectionObserver: mockUseIntersectionObserver
  }
})

vi.mock('../utils/assetPreviewUtil', () => ({
  findServerPreviewUrl: mockFindServerPreviewUrl,
  isAssetPreviewSupported: mockIsAssetPreviewSupported
}))

function makeAsset(overrides: Partial<AssetMeta> = {}): AssetMeta {
  return {
    id: 'asset-1',
    name: 'mesh.glb',
    asset_hash: null,
    mime_type: 'model/gltf-binary',
    tags: [],
    kind: '3D',
    src: 'http://example.com/mesh.glb',
    ...overrides
  } as AssetMeta
}

function fireObserverIntersecting() {
  mockUseIntersectionObserver.mockImplementation(
    (
      _target: unknown,
      callback: (entries: { isIntersecting: boolean }[]) => void
    ) => {
      callback([{ isIntersecting: true }])
      return { stop: vi.fn() }
    }
  )
}

function noopObserver() {
  mockUseIntersectionObserver.mockImplementation(() => ({ stop: vi.fn() }))
}

async function flush() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

const globalConfig = { mocks: { $t: (key: string) => key } }

describe('Media3DTop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAssetPreviewSupported.mockReturnValue(true)
  })

  it('renders the placeholder when no thumbnail has loaded', () => {
    noopObserver()
    const { container } = render(Media3DTop, {
      props: { asset: makeAsset() },
      global: globalConfig
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <img> has no role until src is set
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(
      screen.getByText('assetBrowser.media.threeDModelPlaceholder')
    ).toBeInTheDocument()
  })

  it('uses asset.preview_url directly when preview_id is already on the prop', async () => {
    fireObserverIntersecting()
    const { container } = render(Media3DTop, {
      props: {
        asset: makeAsset({
          preview_id: 'p1',
          preview_url: 'http://server/preview.png'
        })
      },
      global: globalConfig
    })
    await flush()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'http://server/preview.png')
    expect(mockFindServerPreviewUrl).not.toHaveBeenCalled()
  })

  it('queries the server for a preview when preview_id is missing on the prop', async () => {
    fireObserverIntersecting()
    mockFindServerPreviewUrl.mockResolvedValue('http://server/from-name.png')
    const { container } = render(Media3DTop, {
      props: { asset: makeAsset() },
      global: globalConfig
    })
    await flush()

    expect(mockFindServerPreviewUrl).toHaveBeenCalledWith('mesh.glb')
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'http://server/from-name.png')
  })

  it('skips the server query when isAssetPreviewSupported is false', async () => {
    fireObserverIntersecting()
    mockIsAssetPreviewSupported.mockReturnValue(false)
    render(Media3DTop, {
      props: { asset: makeAsset() },
      global: globalConfig
    })
    await flush()

    expect(mockFindServerPreviewUrl).not.toHaveBeenCalled()
  })

  it('picks up a patched preview_url after the IntersectionObserver gate has closed', async () => {
    // Initial render: observer fires, server has no preview yet — hasAttempted=true
    fireObserverIntersecting()
    mockFindServerPreviewUrl.mockResolvedValue(null)

    const { container, rerender } = render(Media3DTop, {
      props: {
        asset: makeAsset({
          preview_id: null,
          preview_url: undefined
        })
      },
      global: globalConfig
    })
    await flush()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('img')).not.toBeInTheDocument()

    // Simulate persistThumbnail patching the store: the prop arrives with the
    // new preview. The watch on [preview_id, preview_url] should apply it
    // directly even though the observer won't refire.
    await rerender({
      asset: makeAsset({
        preview_id: 'p-new',
        preview_url: 'http://server/patched.png'
      })
    })
    await flush()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'http://server/patched.png')
  })

  it('does not overwrite a thumbnail that is already showing', async () => {
    fireObserverIntersecting()
    const { container, rerender } = render(Media3DTop, {
      props: {
        asset: makeAsset({
          preview_id: 'p1',
          preview_url: 'http://server/first.png'
        })
      },
      global: globalConfig
    })
    await flush()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'http://server/first.png'
    )

    await rerender({
      asset: makeAsset({
        preview_id: 'p2',
        preview_url: 'http://server/second.png'
      })
    })
    await flush()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'http://server/first.png'
    )
  })

  it('does not apply a patch with no preview_id', async () => {
    fireObserverIntersecting()
    mockFindServerPreviewUrl.mockResolvedValue(null)

    const { container, rerender } = render(Media3DTop, {
      props: { asset: makeAsset({ preview_id: null, preview_url: undefined }) },
      global: globalConfig
    })
    await flush()

    await rerender({
      asset: makeAsset({
        preview_id: null,
        preview_url: 'http://server/no-id.png'
      })
    })
    await flush()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })
})
