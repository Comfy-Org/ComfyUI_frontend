import { expect, it, vi } from 'vitest'

vi.mock(import('@comfyorg/telemetry/reportError'), () => {
  throw new Error('Reporter chunk unavailable')
})
vi.mock(import('./main'), async () => {
  await import('@comfyorg/telemetry/reportError')
  return {}
})

it('logs the initialization failure when the reporter cannot load', async () => {
  await import('./bootstrap')

  expect(console.error).toHaveBeenCalledExactlyOnceWith(
    '[bootstrap] failed to report app initialization failure',
    expect.objectContaining({
      cause: expect.objectContaining({
        cause: expect.objectContaining({
          message: 'Reporter chunk unavailable'
        })
      })
    }),
    expect.objectContaining({
      cause: expect.objectContaining({ message: 'Reporter chunk unavailable' })
    })
  )
})
