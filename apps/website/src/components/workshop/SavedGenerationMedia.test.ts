import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, expect, it, vi } from 'vitest'

import {
  accessWorkshopAsset,
  GenerationAccessError
} from '../../config/workshop-generation-assets'
import SavedGenerationMedia from './SavedGenerationMedia.vue'

vi.mock(import('../../config/workshop-generation-assets'), { spy: true })

const assetId = '932cad6b-c94f-4e83-bffa-84be407b0440'
const token = vi.fn<() => Promise<string>>()
const output = {
  index: 0,
  asset_id: assetId,
  kind: 'image',
  status: 'saved'
} as const

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-20T12:00:00Z'))
  token.mockResolvedValue('current-token')
})

function access(path: string, minutes = 15) {
  return {
    content_url: `https://assets.example/${path}`,
    expires_at: new Date(Date.now() + minutes * 60_000).toISOString()
  }
}

it('renews access with a fresh credential and aborts pending access when the page closes', async () => {
  vi.mocked(accessWorkshopAsset)
    .mockResolvedValueOnce(access('first'))
    .mockImplementation(async () => access('renewed'))
  const { unmount } = render(SavedGenerationMedia, {
    props: { output, token, locale: 'en' }
  })
  expect(await screen.findByRole('img')).toHaveAttribute(
    'src',
    'https://assets.example/first'
  )
  token.mockResolvedValue('renewed-token')
  await vi.advanceTimersByTimeAsync(14.5 * 60_000)
  await waitFor(() =>
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://assets.example/renewed'
    )
  )
  expect(accessWorkshopAsset).toHaveBeenLastCalledWith(
    assetId,
    'renewed-token',
    expect.any(AbortSignal)
  )
  const signal = vi.mocked(accessWorkshopAsset).mock.calls.at(-1)?.[2]
  unmount()
  expect(signal?.aborted).toBe(true)
  await vi.advanceTimersByTimeAsync(30 * 60_000)
  expect(accessWorkshopAsset).toHaveBeenCalledTimes(2)
})

it('shows a deleted asset as unavailable without retrying or re-importing it', async () => {
  vi.mocked(accessWorkshopAsset).mockRejectedValue(
    new GenerationAccessError(404)
  )
  render(SavedGenerationMedia, { props: { output, token, locale: 'en' } })
  await screen.findByText('This output is no longer available.')
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  await vi.advanceTimersByTimeAsync(30 * 60_000)
  expect(accessWorkshopAsset).toHaveBeenCalledTimes(1)
})

it('bounds automatic retries when the signed media itself cannot load', async () => {
  vi.mocked(accessWorkshopAsset).mockImplementation(async () =>
    access(`attempt-${vi.mocked(accessWorkshopAsset).mock.calls.length}`)
  )
  render(SavedGenerationMedia, { props: { output, token, locale: 'en' } })
  await fireEvent.error(await screen.findByRole('img'))
  await waitFor(() => expect(accessWorkshopAsset).toHaveBeenCalledTimes(2))
  await fireEvent.error(screen.getByRole('img'))
  await screen.findByRole('button', { name: 'Try again' })
  await vi.advanceTimersByTimeAsync(30 * 60_000)
  expect(accessWorkshopAsset).toHaveBeenCalledTimes(2)
})
