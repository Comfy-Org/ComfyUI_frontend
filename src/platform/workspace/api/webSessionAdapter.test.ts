import axios, { AxiosError } from 'axios'
import { expect, it, vi } from 'vitest'

import type { WebSessionSend } from '@/platform/auth/session/webSessionFetch'

import { createWebSessionAdapter } from './webSessionAdapter'

it('reports a web-session timeout as a timeout instead of a cancellation', async () => {
  const timeoutError = new DOMException('Timed out', 'TimeoutError')
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(
    AbortSignal.abort(timeoutError)
  )
  const send = vi.fn<WebSessionSend>((_, { signal }) => {
    throw signal?.reason
  })
  const client = axios.create({ adapter: createWebSessionAdapter(send) })

  await expect(
    client.get('/workspaces', { timeout: 10 })
  ).rejects.toMatchObject({ code: AxiosError.ETIMEDOUT })
})
