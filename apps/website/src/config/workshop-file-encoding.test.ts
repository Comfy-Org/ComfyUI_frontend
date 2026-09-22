import { describe, expect, it, vi } from 'vitest'

import { workshopFileBase64 } from './workshop-file-encoding'

describe('Workshop file reading', () => {
  it.for(['NotReadableError', 'NotFoundError', 'SecurityError'])(
    'identifies the unreadable field and preserves %s',
    async (name) => {
      const file = new File(['pixels'], 'private.png', { type: 'image/png' })
      const cause = new DOMException('Private file detail', name)
      vi.spyOn(file, 'arrayBuffer').mockRejectedValue(cause)

      await expect(
        workshopFileBase64(file, new AbortController().signal, 'source_images')
      ).rejects.toMatchObject({
        reason: 'client',
        stage: 'file_read',
        fieldErrors: { source_images: 'fileUnreadable' },
        cause
      })
    }
  )

  it.for(['resolve', 'reject'] as const)(
    'preserves cancellation while reading a file that later %ss',
    async (outcome) => {
      const file = new File(['pixels'], 'image.png', { type: 'image/png' })
      const read = Promise.withResolvers<ArrayBuffer>()
      vi.spyOn(file, 'arrayBuffer').mockReturnValue(read.promise)
      const controller = new AbortController()
      const pending = workshopFileBase64(
        file,
        controller.signal,
        'source_images'
      )
      controller.abort()
      if (outcome === 'resolve') read.resolve(new ArrayBuffer(1))
      else read.reject(new DOMException('File gone', 'NotFoundError'))

      await expect(pending).rejects.toBe(controller.signal.reason)
    }
  )

  it('encodes readable binary files across chunk boundaries', async () => {
    const bytes = Uint8Array.from({ length: 9000 }, (_, i) => i % 256)
    const file = new File([bytes], 'image.png', { type: 'image/png' })
    expect(
      await workshopFileBase64(
        file,
        new AbortController().signal,
        'source_images'
      )
    ).toBe(Buffer.from(bytes).toString('base64'))
  })
})
