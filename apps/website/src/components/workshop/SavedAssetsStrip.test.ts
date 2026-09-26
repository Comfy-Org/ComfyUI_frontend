import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  accessWorkshopAsset,
  cancelWorkshopGeneration,
  GenerationAccessError,
  getWorkshopGeneration,
  listWorkshopGenerations
} from '../../config/workshop-generation-assets'
import type { SavedGeneration } from '../../config/workshop-generation-assets'
import { WORKSHOP_ASSETS_URL } from '../../config/workshop-env'
import { downloadOutput } from '../../config/workshop-output-download'
import SavedAssetsStrip from './SavedAssetsStrip.vue'

vi.mock(import('../../config/workshop-generation-assets'), { spy: true })
vi.mock(import('../../config/workshop-output-download'), { spy: true })

const assetId = '932cad6b-c94f-4e83-bffa-84be407b0440'
const running: SavedGeneration = {
  request_id: '18655193-3f73-4abf-b49c-1c6a058355bc',
  provider: 'bfl',
  model: 'flux-2-pro',
  created_at: '2026-09-20T12:00:00Z',
  status: 'IN_PROGRESS',
  asset_save_status: 'pending',
  asset_outputs: []
}
const saved: SavedGeneration = {
  ...running,
  status: 'COMPLETED',
  asset_save_status: 'saved',
  asset_outputs: [
    { index: 0, kind: 'image', status: 'saved', asset_id: assetId }
  ]
}
const savedPair: SavedGeneration[] = [
  saved,
  {
    ...saved,
    request_id: '28655193-3f73-4abf-b49c-1c6a058355bd',
    created_at: '2026-09-20T11:00:00Z',
    asset_outputs: [
      {
        index: 0,
        kind: 'image',
        status: 'saved',
        asset_id: 'b1c2d3e4-c94f-4e83-bffa-84be407b0441'
      }
    ]
  }
]

const unkept: SavedGeneration = {
  ...saved,
  asset_save_status: 'failed',
  asset_outputs: [
    { index: 0, kind: 'image', status: 'failed', asset_id: assetId }
  ]
}

const props = {
  modelId: 'bfl/flux-2-pro',
  activeRequestId: null,
  token: async () => 'workspace-token',
  locale: 'en'
} as const

beforeEach(() => {
  vi.mocked(accessWorkshopAsset).mockResolvedValue({
    content_url: 'https://assets.example/saved.png',
    expires_at: new Date(Date.now() + 900_000).toISOString()
  })
  vi.mocked(downloadOutput).mockResolvedValue(true)
})

async function openFirstTile() {
  await userEvent.click(await screen.findByTestId('saved-asset-0'))
  await screen.findByTestId('saved-asset-preview')
}

describe('SavedAssetsStrip', () => {
  it('shows the saved asset as a thumbnail that opens full size to download', async () => {
    vi.mocked(listWorkshopGenerations).mockResolvedValue({ requests: [saved] })
    render(SavedAssetsStrip, { props })

    await openFirstTile()

    expect(
      (await screen.findByAltText('Your assets')).getAttribute('src'),
      'the reader opened the thumbnail to see the asset itself, not a second thumbnail'
    ).toBe('https://assets.example/saved.png')
    await userEvent.click(screen.getByTestId('saved-asset-download'))
    expect(downloadOutput).toHaveBeenCalledWith(
      'https://assets.example/saved.png',
      'saved.png'
    )
  })

  it('says a generation was not kept instead of emptying the strip', async () => {
    vi.mocked(listWorkshopGenerations).mockResolvedValue({ requests: [unkept] })
    const { emitted } = render(SavedAssetsStrip, {
      props: { ...props, activeRequestId: unkept.request_id }
    })

    await openFirstTile()
    expect(screen.getByTestId('saved-asset-not-saved')).toBeVisible()
    await waitFor(() => expect(emitted().saveFailed).toContainEqual([true]))
  })

  it('follows a generation the reader is watching into the asset it becomes', async () => {
    vi.mocked(listWorkshopGenerations)
      .mockResolvedValueOnce({ requests: [running] })
      .mockResolvedValue({ requests: [saved] })
    const { rerender } = render(SavedAssetsStrip, { props })

    await openFirstTile()
    expect(screen.getByText('Generating…')).toBeVisible()
    await rerender({ ...props, activeRequestId: running.request_id })

    expect(
      await screen.findByAltText('Your assets'),
      'closing the preview under the reader the moment their work lands hides the thing they were waiting for'
    ).toBeVisible()
  })

  it('leaves a generation running when the strip goes away', async () => {
    vi.mocked(listWorkshopGenerations).mockResolvedValue({
      requests: [running]
    })
    const { unmount } = render(SavedAssetsStrip, { props })
    await screen.findByTestId('saved-asset-0')

    unmount()

    expect(vi.mocked(listWorkshopGenerations).mock.calls[0][1].aborted).toBe(
      true
    )
    expect(
      cancelWorkshopGeneration,
      'navigating away is not a request to throw away a paid run'
    ).not.toHaveBeenCalled()
  })

  it('sends a reader with more than the strip holds to their library in Cloud', async () => {
    vi.mocked(listWorkshopGenerations).mockResolvedValue({ requests: [saved] })
    render(SavedAssetsStrip, { props })

    expect(
      (await screen.findByTestId('saved-assets-see-all')).getAttribute('href')
    ).toBe(WORKSHOP_ASSETS_URL)
  })

  it('drops an asset the account can no longer reach instead of a broken tile', async () => {
    vi.mocked(listWorkshopGenerations).mockResolvedValue({ requests: [saved] })
    vi.mocked(accessWorkshopAsset).mockRejectedValue(
      new GenerationAccessError(410)
    )
    render(SavedAssetsStrip, { props })

    await waitFor(() => expect(accessWorkshopAsset).toHaveBeenCalled())

    await waitFor(() =>
      expect(
        screen.queryByTestId('saved-asset-0'),
        'a tile whose asset is gone is a dead thumbnail the reader cannot open'
      ).toBeNull()
    )
  })

  it('asks for a fresh URL once when the browser rejects the one it has', async () => {
    vi.mocked(listWorkshopGenerations).mockResolvedValue({ requests: [saved] })
    render(SavedAssetsStrip, { props })
    const image = await screen.findByTestId('saved-asset-media')

    await fireEvent.error(image)
    await fireEvent.error(image)

    await waitFor(() =>
      expect(
        vi.mocked(accessWorkshopAsset),
        'a signed URL the browser refuses is worth one retry, not a loop'
      ).toHaveBeenCalledTimes(2)
    )
  })

  it('cancels a running generation from its preview', async () => {
    vi.mocked(listWorkshopGenerations).mockResolvedValue({
      requests: [running]
    })
    vi.mocked(cancelWorkshopGeneration).mockResolvedValue(undefined)
    render(SavedAssetsStrip, { props })

    await openFirstTile()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(cancelWorkshopGeneration).toHaveBeenCalledWith(
      running,
      'workspace-token',
      expect.anything()
    )
  })

  it('says a cancellation did not go through, because the run keeps spending', async () => {
    vi.mocked(listWorkshopGenerations).mockResolvedValue({
      requests: [running]
    })
    vi.mocked(cancelWorkshopGeneration).mockRejectedValue(new Error('offline'))
    render(SavedAssetsStrip, { props })

    await openFirstTile()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not request cancellation.'
    )
  })

  it('renews a signed URL before it lapses under the reader', async () => {
    vi.useFakeTimers()
    vi.mocked(listWorkshopGenerations).mockResolvedValue({ requests: [saved] })
    vi.mocked(accessWorkshopAsset).mockResolvedValue({
      content_url: 'https://assets.example/saved.png',
      expires_at: new Date(Date.now() + 60_000).toISOString()
    })
    render(SavedAssetsStrip, { props })
    await vi.waitFor(() => expect(accessWorkshopAsset).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(31_000)

    expect(
      vi.mocked(accessWorkshopAsset),
      'an expired URL turns the strip into broken images while the reader is looking at it'
    ).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('asks again after a transient access failure instead of waiting forever', async () => {
    vi.useFakeTimers()
    vi.mocked(listWorkshopGenerations).mockResolvedValue({ requests: [saved] })
    vi.mocked(accessWorkshopAsset)
      .mockRejectedValueOnce(new GenerationAccessError(503))
      .mockResolvedValue({
        content_url: 'https://assets.example/saved.png',
        expires_at: new Date(Date.now() + 900_000).toISOString()
      })
    render(SavedAssetsStrip, { props })
    await vi.waitFor(() => expect(accessWorkshopAsset).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(16_000)

    expect(
      vi.mocked(accessWorkshopAsset),
      'list polling has stopped once the run is complete, so nothing else would ever ask'
    ).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it.for([
    [31_000, 'https://assets.example/saved.png'],
    [62_000, undefined]
  ] as const)(
    'holds a still-valid URL through a failed renewal, %sms in',
    async ([elapsed, src]) => {
      vi.useFakeTimers()
      vi.mocked(listWorkshopGenerations).mockResolvedValue({
        requests: [saved]
      })
      vi.mocked(accessWorkshopAsset)
        .mockResolvedValueOnce({
          content_url: 'https://assets.example/saved.png',
          expires_at: new Date(Date.now() + 60_000).toISOString()
        })
        .mockRejectedValue(new GenerationAccessError(503))
      render(SavedAssetsStrip, { props })
      await vi.waitFor(() =>
        expect(accessWorkshopAsset).toHaveBeenCalledTimes(1)
      )

      await vi.advanceTimersByTimeAsync(elapsed)

      expect(
        screen.queryByTestId('saved-asset-media')?.getAttribute('src') ??
          undefined,
        'the grant outlives the attempt to replace it, and no longer'
      ).toBe(src)
      vi.useRealTimers()
    }
  )

  it('grants access to the asset a gone one uncovers', async () => {
    const shown = 8
    const older = Array.from({ length: shown + 1 }, (_, index) => ({
      ...saved,
      request_id: `3${index}655193-3f73-4abf-b49c-1c6a058355bc`,
      created_at: `2026-09-${20 - index}T12:00:00Z`,
      asset_outputs: [
        {
          ...saved.asset_outputs[0],
          asset_id: `c${index}c2d3e4-c94f-4e83-bffa-84be407b0441`
        }
      ]
    }))
    const survivor = older[shown].asset_outputs[0].asset_id
    vi.mocked(listWorkshopGenerations).mockResolvedValue({ requests: older })
    vi.mocked(accessWorkshopAsset).mockImplementation(async (id) =>
      id === survivor
        ? {
            content_url: 'https://assets.example/survivor.png',
            expires_at: new Date(Date.now() + 900_000).toISOString()
          }
        : Promise.reject(new GenerationAccessError(404))
    )
    render(SavedAssetsStrip, { props })

    expect(
      await screen.findByTestId('saved-asset-media'),
      'the strip drops what is gone, so the asset behind it becomes the one on screen'
    ).toHaveAttribute('src', 'https://assets.example/survivor.png')
  })

  it('keeps polling while a generation is still running', async () => {
    vi.useFakeTimers()
    vi.mocked(listWorkshopGenerations).mockResolvedValue({
      requests: [running]
    })
    render(SavedAssetsStrip, { props })
    await vi.waitFor(() =>
      expect(listWorkshopGenerations).toHaveBeenCalledTimes(1)
    )

    await vi.advanceTimersByTimeAsync(3_100)

    expect(
      vi.mocked(listWorkshopGenerations),
      'a run that finishes while the reader waits must appear without a reload'
    ).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('shows the run just started before the listing has caught up with it', async () => {
    vi.mocked(listWorkshopGenerations).mockResolvedValue({ requests: [] })
    vi.mocked(getWorkshopGeneration).mockResolvedValue(running)
    render(SavedAssetsStrip, {
      props: { ...props, activeRequestId: running.request_id }
    })

    expect(
      await screen.findByTestId('saved-asset-0'),
      'the run the reader is waiting on must not vanish while the listing lags'
    ).toBeVisible()
  })

  it('pages from one saved asset to the next without going back to the strip', async () => {
    vi.mocked(listWorkshopGenerations).mockResolvedValue({
      requests: savedPair
    })
    vi.mocked(accessWorkshopAsset)
      .mockResolvedValueOnce({
        content_url: 'https://assets.example/first.png',
        expires_at: new Date(Date.now() + 900_000).toISOString()
      })
      .mockResolvedValue({
        content_url: 'https://assets.example/second.png',
        expires_at: new Date(Date.now() + 900_000).toISOString()
      })
    render(SavedAssetsStrip, { props })

    await openFirstTile()
    await userEvent.click(screen.getByTestId('saved-asset-next'))

    expect(
      (await screen.findByAltText('Your assets')).getAttribute('src'),
      'the reader opened one asset to browse them, not to reopen the strip for each'
    ).toBe('https://assets.example/second.png')
  })

  it('stops the pager at the ends of the strip', async () => {
    vi.mocked(listWorkshopGenerations).mockResolvedValue({
      requests: savedPair
    })
    render(SavedAssetsStrip, { props })

    await openFirstTile()

    expect(screen.getByTestId('saved-asset-previous')).toBeDisabled()
    expect(screen.getByTestId('saved-asset-next')).toBeEnabled()
  })

  it('jumps straight to an asset from its dot', async () => {
    vi.mocked(listWorkshopGenerations).mockResolvedValue({
      requests: savedPair
    })
    vi.mocked(accessWorkshopAsset)
      .mockResolvedValueOnce({
        content_url: 'https://assets.example/first.png',
        expires_at: new Date(Date.now() + 900_000).toISOString()
      })
      .mockResolvedValue({
        content_url: 'https://assets.example/second.png',
        expires_at: new Date(Date.now() + 900_000).toISOString()
      })
    render(SavedAssetsStrip, { props })

    await openFirstTile()
    await userEvent.click(screen.getByRole('button', { name: 'Show asset 2' }))

    expect(
      (await screen.findByAltText('Your assets')).getAttribute('src')
    ).toBe('https://assets.example/second.png')
  })

  it('pages on a swipe, the way the strip is read on a phone', async () => {
    vi.mocked(listWorkshopGenerations).mockResolvedValue({
      requests: savedPair
    })
    render(SavedAssetsStrip, { props })
    await openFirstTile()
    const preview = screen.getByTestId('saved-asset-preview')

    await fireEvent.touchStart(preview, {
      changedTouches: [{ clientX: 240 }]
    })
    await fireEvent.touchEnd(preview, { changedTouches: [{ clientX: 100 }] })

    expect(
      screen.getByTestId('saved-asset-previous'),
      'a swipe that lands on the second asset must leave the reader able to go back'
    ).toBeEnabled()
  })

  it('ignores a touch too short to be a swipe', async () => {
    vi.mocked(listWorkshopGenerations).mockResolvedValue({
      requests: savedPair
    })
    render(SavedAssetsStrip, { props })
    await openFirstTile()
    const preview = screen.getByTestId('saved-asset-preview')

    await fireEvent.touchStart(preview, {
      changedTouches: [{ clientX: 240 }]
    })
    await fireEvent.touchEnd(preview, { changedTouches: [{ clientX: 220 }] })

    expect(
      screen.getByTestId('saved-asset-previous'),
      'a tap on the picture is not a request to move off it'
    ).toBeDisabled()
  })

  it('reports a listing it could not load instead of looking empty', async () => {
    vi.mocked(listWorkshopGenerations).mockRejectedValue(new Error('offline'))
    render(SavedAssetsStrip, { props })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load your assets.'
    )
  })
})
