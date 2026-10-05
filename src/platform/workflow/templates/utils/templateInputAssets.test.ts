import type {
  ComfyDesktop2Bridge,
  ComfyTemplateInputAsset,
  ComfyTemplateInputAssetDownloadResult
} from '@comfyorg/comfyui-desktop-bridge-types'
import { describe, expect, it, vi } from 'vitest'

import {
  resolveTemplateInputAssets,
  startMissingTemplateInputDownloads
} from '@/platform/workflow/templates/utils/templateInputAssets'

function asset(
  assetId: string,
  availability: ComfyTemplateInputAsset['availability']
): ComfyTemplateInputAsset {
  return {
    assetId,
    filename: `${assetId}.png`,
    mediaType: 'image',
    previewUrl: `/previews/${assetId}.png`,
    availability
  }
}

function bridge(overrides: Partial<ComfyDesktop2Bridge>): ComfyDesktop2Bridge {
  return overrides
}

type DownloadInput = NonNullable<
  ComfyDesktop2Bridge['downloadTemplateInputAsset']
>

const accepted: ComfyTemplateInputAssetDownloadResult = {
  status: 'accepted',
  download: {
    downloadId: 'd1',
    filename: 'a.png',
    progress: 0,
    status: 'pending'
  }
}

function downloadStub(
  impl?: Parameters<typeof vi.fn<DownloadInput>>[0]
): ReturnType<typeof vi.fn<DownloadInput>> {
  return vi.fn<DownloadInput>(impl ?? (async () => accepted))
}

describe('resolveTemplateInputAssets', () => {
  it.for([
    { name: 'no bridge', getBridge: () => undefined },
    { name: 'a bridge without the method', getBridge: () => bridge({}) },
    {
      name: 'a remote bridge',
      getBridge: () =>
        bridge({
          getTemplateInputAssets: vi.fn(async () => [asset('a', 'missing')]),
          isRemote: () => true
        })
    }
  ])('answers nothing for $name', async ({ getBridge }) => {
    await expect(resolveTemplateInputAssets('t1', getBridge)).resolves.toEqual(
      []
    )
  })

  it('answers nothing when the bridge rejects', async () => {
    const getTemplateInputAssets = vi.fn(async () => {
      throw new Error('bridge down')
    })
    await expect(
      resolveTemplateInputAssets('t1', () => bridge({ getTemplateInputAssets }))
    ).resolves.toEqual([])
    expect(getTemplateInputAssets).toHaveBeenCalledWith('t1')
  })

  it('answers nothing when the bridge resolves nullish', async () => {
    await expect(
      resolveTemplateInputAssets('t1', () =>
        bridge({
          getTemplateInputAssets: vi.fn(async () => null)
        })
      )
    ).resolves.toEqual([])
  })

  it('passes the assets through', async () => {
    const assets = [asset('a', 'missing'), asset('b', 'present')]
    await expect(
      resolveTemplateInputAssets('t1', () =>
        bridge({ getTemplateInputAssets: vi.fn(async () => assets) })
      )
    ).resolves.toEqual(assets)
  })
})

describe('startMissingTemplateInputDownloads', () => {
  it('downloads only the missing assets', () => {
    const downloadTemplateInputAsset = downloadStub()
    const reportError = vi.fn()
    startMissingTemplateInputDownloads(
      't1',
      [asset('a', 'missing'), asset('b', 'present'), asset('c', 'missing')],
      { getBridge: () => bridge({ downloadTemplateInputAsset }), reportError }
    )

    expect(downloadTemplateInputAsset.mock.calls).toEqual([
      ['t1', 'a'],
      ['t1', 'c']
    ])
    expect(reportError).not.toHaveBeenCalled()
  })

  it.for([
    { name: 'nothing is missing', assets: [asset('b', 'present')] },
    { name: 'there are no assets', assets: [] }
  ])('does nothing when $name', ({ assets }) => {
    const downloadTemplateInputAsset = downloadStub()
    const reportError = vi.fn()
    startMissingTemplateInputDownloads('t1', assets, {
      getBridge: () => bridge({ downloadTemplateInputAsset }),
      reportError
    })

    expect(downloadTemplateInputAsset).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
  })

  it.for([
    { name: 'the bridge cannot download', getBridge: () => bridge({}) },
    {
      name: 'the bridge is remote',
      getBridge: () =>
        bridge({
          downloadTemplateInputAsset: downloadStub(),
          isRemote: () => true
        })
    }
  ])('reports when $name', ({ getBridge }) => {
    const reportError = vi.fn()
    startMissingTemplateInputDownloads('t1', [asset('a', 'missing')], {
      getBridge,
      reportError
    })

    expect(reportError).toHaveBeenCalledOnce()
    expect(reportError.mock.calls[0][0]).toBeInstanceOf(Error)
  })

  it('reports the first failure once, after every attempt settles', async () => {
    const downloadTemplateInputAsset = downloadStub()
      .mockResolvedValueOnce({
        status: 'not-started',
        reason: 'unavailable'
      })
      .mockRejectedValueOnce(new Error('second failed'))
    const reportError = vi.fn()

    startMissingTemplateInputDownloads(
      't1',
      [asset('a', 'missing'), asset('b', 'missing')],
      { getBridge: () => bridge({ downloadTemplateInputAsset }), reportError }
    )

    await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce())
    expect(downloadTemplateInputAsset).toHaveBeenCalledTimes(2)
    expect(String(reportError.mock.calls[0][0])).toContain('unavailable')
  })
})
