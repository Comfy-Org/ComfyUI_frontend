import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, expect, it, vi } from 'vitest'

import {
  accessWorkshopAsset,
  cancelWorkshopGeneration,
  getWorkshopGeneration,
  listWorkshopGenerations
} from '../../config/workshop-generation-assets'
import type { SavedGeneration } from '../../config/workshop-generation-assets'
import GenerationHistory from './GenerationHistory.vue'

vi.mock(import('../../config/workshop-generation-assets'), { spy: true })

const request: SavedGeneration = {
  request_id: '18655193-3f73-4abf-b49c-1c6a058355bc',
  provider: 'bfl',
  model: 'flux-2-pro',
  created_at: '2026-09-20T12:00:00Z',
  status: 'IN_PROGRESS',
  asset_save_status: 'pending',
  asset_outputs: []
}
const saved: SavedGeneration = {
  ...request,
  status: 'COMPLETED',
  asset_save_status: 'saved',
  asset_outputs: [
    {
      index: 0,
      kind: 'image',
      status: 'saved',
      asset_id: '932cad6b-c94f-4e83-bffa-84be407b0440'
    }
  ]
}
const props = {
  modelId: 'bfl/flux-2-pro',
  activeRequestId: null,
  token: async () => 'current-owner-token',
  locale: 'en'
} as const

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(accessWorkshopAsset).mockResolvedValue({
    content_url: 'https://assets.example/saved.png',
    expires_at: new Date(Date.now() + 900_000).toISOString()
  })
})

it('recovers the completed generation after closing and returning without cancelling it', async () => {
  vi.mocked(listWorkshopGenerations)
    .mockResolvedValueOnce({ requests: [request] })
    .mockResolvedValue({ requests: [saved] })
  const first = render(GenerationHistory, { props })
  await screen.findByText('Generating…')
  const signal = vi.mocked(listWorkshopGenerations).mock.calls[0][1]
  first.unmount()
  expect(signal.aborted).toBe(true)
  expect(cancelWorkshopGeneration).not.toHaveBeenCalled()
  render(GenerationHistory, { props })
  expect(await screen.findByRole('img')).toHaveAttribute(
    'src',
    'https://assets.example/saved.png'
  )
  expect(
    screen.getByText(`Asset ID: ${saved.asset_outputs[0].asset_id}`)
  ).toBeVisible()
})

it('keeps older loaded generations visible while polling a newer one', async () => {
  const older = {
    ...saved,
    request_id: '7369b0fd-31d9-461b-a75f-4a84c4f3f314',
    created_at: '2026-09-19T12:00:00Z'
  }
  vi.mocked(listWorkshopGenerations)
    .mockResolvedValueOnce({ requests: [request], next_cursor: 'page-two' })
    .mockResolvedValueOnce({ requests: [older] })
    .mockResolvedValue({ requests: [saved], next_cursor: 'page-two' })
  render(GenerationHistory, { props })
  await userEvent
    .setup({ advanceTimers: vi.advanceTimersByTime })
    .click(await screen.findByRole('button', { name: 'Load more' }))
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2))
  await vi.advanceTimersByTimeAsync(3000)
  await waitFor(() => expect(screen.getAllByText('Saved')).toHaveLength(2))
  expect(screen.getAllByRole('article')).toHaveLength(2)
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
})

it('fetches a directly linked request even when it is outside the first history page', async () => {
  vi.mocked(listWorkshopGenerations).mockResolvedValue({ requests: [] })
  vi.mocked(getWorkshopGeneration).mockResolvedValue(saved)
  render(GenerationHistory, {
    props: { ...props, activeRequestId: saved.request_id }
  })
  await screen.findByText('Saved')
  expect(getWorkshopGeneration).toHaveBeenCalledWith(
    props.modelId,
    saved.request_id,
    'current-owner-token',
    expect.any(AbortSignal)
  )
})

it('shows partial saving and a failed output alongside the saved media', async () => {
  vi.mocked(listWorkshopGenerations).mockResolvedValue({
    requests: [
      {
        ...saved,
        asset_save_status: 'partial',
        asset_outputs: [
          ...saved.asset_outputs,
          {
            index: 1,
            asset_id: '7369b0fd-31d9-461b-a75f-4a84c4f3f314',
            kind: 'image',
            status: 'failed',
            error_code: 'source_unavailable'
          }
        ]
      }
    ]
  })
  render(GenerationHistory, { props })
  await screen.findByText('Some outputs saved')
  await screen.findByRole('img')
  expect(screen.getByText('Could not save this output.')).toBeVisible()
})

it('surfaces a failed explicit cancellation and keeps the generation visible', async () => {
  vi.mocked(listWorkshopGenerations).mockResolvedValue({ requests: [request] })
  vi.mocked(cancelWorkshopGeneration).mockRejectedValue(new Error('offline'))
  render(GenerationHistory, { props })
  await userEvent
    .setup({ advanceTimers: vi.advanceTimersByTime })
    .click(await screen.findByRole('button', { name: 'Cancel' }))
  await screen.findByText(
    'Could not request cancellation. Your generation may still be running.'
  )
  expect(screen.getByText('Generating…')).toBeVisible()
})
