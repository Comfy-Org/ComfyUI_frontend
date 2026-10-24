import type { AxiosAdapter, AxiosResponse } from 'axios'
import axios, { AxiosError } from 'axios'
import { describe, expect, it, vi } from 'vitest'

import { attachRetryableStatusRetry } from '@/utils/axiosRetryableStatus'
import { DEFAULT_RETRY_POLICY } from '@/utils/retryPolicy'

interface ScriptedAnswer {
  readonly status: number
  readonly headers?: Record<string, string>
}

function makeClient(answers: ScriptedAnswer[]) {
  let call = 0
  const adapter = vi.fn<AxiosAdapter>(async (config) => {
    const { status, headers = {} } =
      answers[Math.min(call++, answers.length - 1)]
    const response: AxiosResponse = {
      data: {},
      status,
      statusText: String(status),
      headers,
      config
    }
    if (status < 400) return response
    throw new AxiosError(
      `Request failed with status code ${status}`,
      AxiosError.ERR_BAD_RESPONSE,
      config,
      null,
      response
    )
  })
  const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {})
  const client = axios.create({ adapter })
  attachRetryableStatusRetry(client, { sleep, random: () => 1 })
  return { client, adapter, sleep }
}

describe('attachRetryableStatusRetry', () => {
  it('returns a 200 after one 503', async () => {
    const { client, adapter } = makeClient([{ status: 503 }, { status: 200 }])

    const response = await client.get('https://api/x')

    expect(response.status).toBe(200)
    expect(adapter).toHaveBeenCalledTimes(2)
  })

  it('rejects with the final 503 once the attempts are spent', async () => {
    const { client, adapter } = makeClient([{ status: 503 }])

    await expect(client.get('https://api/x')).rejects.toMatchObject({
      response: { status: 503 }
    })
    expect(adapter).toHaveBeenCalledTimes(DEFAULT_RETRY_POLICY.maxAttempts)
  })

  it.for([401, 404, 500])('does not retry a %i', async (status) => {
    const { client, adapter } = makeClient([{ status }])

    await expect(client.get('https://api/x')).rejects.toMatchObject({
      response: { status }
    })
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it.for(['post', 'put', 'patch', 'delete'] as const)(
    'does not retry a %s that got a 503',
    async (method) => {
      const { client, adapter } = makeClient([{ status: 503 }])

      await expect(
        client.request({ url: 'https://api/x', method })
      ).rejects.toMatchObject({ response: { status: 503 } })
      expect(adapter).toHaveBeenCalledTimes(1)
    }
  )

  it('waits the Retry-After the server sent', async () => {
    const { client, sleep } = makeClient([
      { status: 429, headers: { 'retry-after': '2' } },
      { status: 200 }
    ])

    await client.get('https://api/x')

    expect(sleep).toHaveBeenCalledExactlyOnceWith(2_000, undefined)
  })

  it('rejects without waiting when Retry-After is past the cap', async () => {
    const { client, adapter, sleep } = makeClient([
      { status: 503, headers: { 'retry-after': '3600' } }
    ])

    await expect(client.get('https://api/x')).rejects.toMatchObject({
      response: { status: 503 }
    })
    expect(adapter).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('rethrows an error that has no response', async () => {
    const networkError = new AxiosError('Network Error', AxiosError.ERR_NETWORK)
    const adapter = vi.fn<AxiosAdapter>().mockRejectedValue(networkError)
    const client = axios.create({ adapter })
    attachRetryableStatusRetry(client, { sleep: async () => {} })

    await expect(client.get('https://api/x')).rejects.toBe(networkError)
    expect(adapter).toHaveBeenCalledTimes(1)
  })
})
