import { expect, it, vi } from 'vitest'

import { reportError } from '@comfyorg/telemetry/reportError'

vi.mock(import('@comfyorg/telemetry/reportError'))

vi.mock(import('./main'), () => {
  throw new Error('Main module initialization failed')
})

it('reports a main module initialization failure during boot', async () => {
  await import('./bootstrap')

  expect(reportError).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      cause: expect.objectContaining({
        message: 'Main module initialization failed'
      })
    }),
    {
      errorType: 'failure_initializing_app',
      surface: 'platform'
    }
  )
})
