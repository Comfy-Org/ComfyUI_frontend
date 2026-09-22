import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  accessWorkshopAsset,
  cancelWorkshopGeneration,
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

  it('reports a listing it could not load instead of looking empty', async () => {
    vi.mocked(listWorkshopGenerations).mockRejectedValue(new Error('offline'))
    render(SavedAssetsStrip, { props })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load your assets.'
    )
  })
})
