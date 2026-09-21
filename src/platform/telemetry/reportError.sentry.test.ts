import type { ErrorEvent } from '@sentry/vue'
import { init } from '@sentry/vue'
import { expect, it, vi } from 'vitest'
import { createApp } from 'vue'

import { reportError } from './reportError'

it('suppresses a report raised by real Sentry payload normalization', async () => {
  const beforeSend = vi.fn((event: ErrorEvent) => event)
  const client = init({
    app: createApp({}),
    dsn: 'https://public@example.invalid/1',
    normalizeDepth: 8,
    beforeSend,
    transport: () => ({
      send: async () => ({ statusCode: 200 }),
      flush: async () => true
    })
  })
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  const nested = new Error('Graph serialization state mismatch')
  const toJSON = vi
    .fn(() => ({}))
    .mockImplementationOnce(() => {
      reportError(nested, { errorType: 'graph_serialization_state_mismatch' })
      return {}
    })

  try {
    reportError(new Error('bad subgraph'), {
      errorType: 'subgraph_load_failure',
      context: { graph: { toJSON } }
    })
    reportError(new Error('later'), { errorType: 'http_error' })
    await client?.flush()

    expect(toJSON).toHaveBeenCalled()
    expect(
      beforeSend.mock.calls.map(([event]) => event.tags?.error_type)
    ).toEqual(['subgraph_load_failure', 'http_error'])
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('suppressed: raised while reporting'),
      nested
    )
  } finally {
    await client?.close()
  }
})
