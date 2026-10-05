import { expect, it, vi } from 'vitest'

import { resolveUnifiedWebSession } from './webSessionFlag.js'

vi.mock(import('./requestAuth.js'), () => {
  throw new Error('chunk failed to load')
})

it('is off, without sending the credentialed read, when the client header fails to load', async () => {
  const fetchImpl = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify({ unified_web_session: true }))
  )

  await expect(
    resolveUnifiedWebSession({
      cloudBaseUrl: 'https://cloud.example',
      fetchImpl,
      probe: async () => true
    })
  ).resolves.toBe(false)
  expect(fetchImpl).not.toHaveBeenCalled()
})
