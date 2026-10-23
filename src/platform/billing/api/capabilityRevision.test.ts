import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios'
import axios, { AxiosError, AxiosHeaders } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  attachCapabilityRevisionInterceptor,
  onCapabilityRevision
} from './capabilityRevision'

const unsubscribes: Array<() => void> = []

function subscribe() {
  const listener = vi.fn()
  unsubscribes.push(onCapabilityRevision(listener))
  return listener
}

function clientRespondingWith(
  status: number,
  headers: Record<string, string>
): AxiosInstance {
  const client = axios.create()
  client.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    const response: AxiosResponse = {
      data: {},
      status,
      statusText: '',
      headers: new AxiosHeaders(headers),
      config
    }
    return status >= 400
      ? Promise.reject(
          new AxiosError(
            'Request failed',
            'ERR_BAD_REQUEST',
            config,
            {},
            response
          )
        )
      : Promise.resolve(response)
  }
  attachCapabilityRevisionInterceptor(client)
  return client
}

afterEach(() => {
  while (unsubscribes.length) unsubscribes.pop()!()
})

describe('capabilityRevision', () => {
  it('publishes the revision reported by a successful mutation', async () => {
    const listener = subscribe()

    await clientRespondingWith(200, { 'X-Capability-Revision': '42' }).post(
      '/api/billing/subscribe'
    )

    expect(listener).toHaveBeenCalledExactlyOnceWith(42)
  })

  it('publishes the revision reported by a failed mutation', async () => {
    const listener = subscribe()

    await expect(
      clientRespondingWith(402, { 'X-Capability-Revision': '43' }).post(
        '/api/billing/subscribe'
      )
    ).rejects.toBeInstanceOf(AxiosError)

    expect(listener).toHaveBeenCalledExactlyOnceWith(43)
  })

  it.for(['put', 'patch', 'delete'])(
    'publishes the revision reported by a %s mutation',
    async (method) => {
      const listener = subscribe()

      await clientRespondingWith(200, {
        'X-Capability-Revision': '11'
      }).request({ method, url: '/api/workspaces/workspace-1' })

      expect(listener).toHaveBeenCalledExactlyOnceWith(11)
    }
  )

  it('publishes nothing for a read that reports its own revision', async () => {
    const listener = subscribe()

    await clientRespondingWith(200, { 'X-Capability-Revision': '44' }).get(
      '/api/billing/capabilities'
    )

    expect(listener).not.toHaveBeenCalled()
  })

  it('reads the revision header case-insensitively', async () => {
    const listener = subscribe()

    await clientRespondingWith(200, { 'x-capability-revision': '7' }).post(
      '/api/billing/topup'
    )

    expect(listener).toHaveBeenCalledExactlyOnceWith(7)
  })

  it('publishes nothing when the response omits the revision header', async () => {
    const listener = subscribe()

    await clientRespondingWith(200, {}).post('/api/billing/subscribe')

    expect(listener).not.toHaveBeenCalled()
  })

  it('publishes nothing when a transport error carries no response', async () => {
    const listener = subscribe()
    const client = axios.create()
    client.defaults.adapter = () =>
      Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK'))
    attachCapabilityRevisionInterceptor(client)

    await expect(client.post('/api/billing/subscribe')).rejects.toBeInstanceOf(
      AxiosError
    )

    expect(listener).not.toHaveBeenCalled()
  })

  it.for(['', 'not-a-number', '0', '-1', '1.5', '9007199254740993'])(
    'publishes nothing for an unusable revision header %j',
    async (value) => {
      const listener = subscribe()

      await clientRespondingWith(200, {
        'X-Capability-Revision': value
      }).post('/api/billing/subscribe')

      expect(listener).not.toHaveBeenCalled()
    }
  )

  it('stops publishing to a listener once it unsubscribes', async () => {
    const listener = vi.fn()
    onCapabilityRevision(listener)()

    await clientRespondingWith(200, { 'X-Capability-Revision': '9' }).post(
      '/api/billing/subscribe'
    )

    expect(listener).not.toHaveBeenCalled()
  })
})
