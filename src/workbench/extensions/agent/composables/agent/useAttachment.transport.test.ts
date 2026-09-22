import { assert, expect, it, onTestFinished, vi } from 'vitest'

import { createAgentRestClient } from '../../services/agent/agentRestClient'
import { useAttachment } from './useAttachment'
import type { ComposerAttachment } from './useComposer'

it('keeps a 4 MiB upload alive past 60 seconds and aborts it at 94 seconds', async () => {
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  let signal: AbortSignal | null | undefined
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>((_input, init) => {
      signal = init?.signal
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal?.reason), {
          once: true
        })
      })
    })
  )
  const client = createAgentRestClient()
  const chips = new Map<string, ComposerAttachment>()
  const onError = vi.fn()
  const { addFiles } = useAttachment({
    upload: async (file, uploadSignal) => {
      const result = await client.uploadImage(file, file.name, uploadSignal)
      return { ref: result.name ?? file.name }
    },
    stage: (chip) => chips.set(chip.id, chip),
    update: (id, patch) => {
      const chip = chips.get(id)
      assert.exists(chip)
      Object.assign(chip, patch)
    },
    remove: (id) => chips.delete(id),
    onError
  })
  const file = new File(['image'], 'slow.png', { type: 'image/png' })
  Object.defineProperty(file, 'size', { value: 4 * 1024 * 1024 })
  const pending = addFiles([file])

  await vi.advanceTimersByTimeAsync(93_999)
  assert.exists(signal)
  expect(signal.aborted).toBe(false)
  expect([...chips.values()]).toMatchObject([
    { name: 'slow.png', uploading: true }
  ])
  expect(onError).not.toHaveBeenCalled()

  await vi.advanceTimersByTimeAsync(1)
  await pending
  expect(signal.aborted).toBe(true)
  expect(chips.size).toBe(0)
  expect(onError).toHaveBeenCalledWith('slow.png could not be uploaded')
})
