import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios'
import axios, { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTelemetry } from '@comfyorg/telemetry'

import { attachRetryableStatusRetry } from '@/utils/axiosRetryableStatus'
import type { RetryPolicy } from '@comfyorg/api-client/retryPolicy'
import {
  DEFAULT_RETRY_POLICY,
  withSignInRefusalRetry
} from '@comfyorg/api-client/retryPolicy'
import { clearStatusRetryBudget } from '@comfyorg/api-client/statusRetryTelemetry'

vi.mock(import('@comfyorg/telemetry'))

interface ScriptedAnswer {
  readonly status: number
  readonly headers?: Record<string, string>
  readonly data?: unknown
}

function scriptedAdapter(answers: ScriptedAnswer[]) {
  let call = 0
  return vi.fn<AxiosAdapter>(async (config) => {
    const {
      status,
      headers = {},
      data = {}
    } = answers[Math.min(call++, answers.length - 1)]
    const response: AxiosResponse = {
      data,
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
}

function makeClient(answers: ScriptedAnswer[], policy?: RetryPolicy) {
  const adapter = scriptedAdapter(answers)
  const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {})
  const client = axios.create({ adapter })
  attachRetryableStatusRetry(client, { sleep, random: () => 1, policy })
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

  describe('a write the sign-in check refused', () => {
    const AUTH_UNAVAILABLE = 'authentication service unavailable'
    const policy = withSignInRefusalRetry()
    const tracked = () => vi.mocked(useTelemetry()!.trackFetchStatusRetry)

    beforeEach(() => clearStatusRetryBudget())

    function refusal(
      message = AUTH_UNAVAILABLE,
      headers: Record<string, string> = { 'retry-after': '5' }
    ): ScriptedAnswer {
      return { status: 503, headers, data: { code: 'unavailable', message } }
    }

    it('is sent once under the default policy', async () => {
      const { client, adapter, sleep } = makeClient([
        refusal(),
        { status: 200 }
      ])

      await expect(client.post('https://api/x', {})).rejects.toMatchObject({
        response: { status: 503 }
      })
      expect(adapter).toHaveBeenCalledTimes(1)
      expect(sleep).not.toHaveBeenCalled()
    })

    it('sends a write that succeeds once, with no telemetry', async () => {
      const { client, adapter } = makeClient([{ status: 200 }], policy)

      const response = await client.post('https://api.comfy.org/x', {})

      expect(response.status).toBe(200)
      expect(adapter).toHaveBeenCalledOnce()
      expect(tracked()).not.toHaveBeenCalled()
    })

    it.for(['post', 'put', 'patch', 'delete'] as const)(
      'sends a %s once more and returns the success',
      async (method) => {
        const { client, adapter, sleep } = makeClient(
          [refusal(), { status: 200 }],
          policy
        )

        const response = await client.request({
          url: 'https://api/x',
          method,
          data: {}
        })

        expect(response.status).toBe(200)
        expect(adapter).toHaveBeenCalledTimes(2)
        expect(sleep).toHaveBeenCalledExactlyOnceWith(5_250, undefined)
      }
    )

    it('records the write it sent twice', async () => {
      const { client } = makeClient([refusal(), { status: 200 }], policy)

      await client.post('https://api.comfy.org/customers/balance', {})

      expect(tracked()).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          transport: 'axios',
          method: 'POST',
          attempts: 2,
          final_status: 200,
          outcome: 'recovered'
        })
      )
    })

    it('rejects with the second refusal after exactly two sends', async () => {
      const { client, adapter } = makeClient([refusal(), refusal()], policy)

      await expect(client.post('https://api/x', {})).rejects.toMatchObject({
        response: { status: 503, data: { message: AUTH_UNAVAILABLE } }
      })
      expect(adapter).toHaveBeenCalledTimes(2)
    })

    it.for<[string, ScriptedAnswer]>([
      ['has no Retry-After', refusal(AUTH_UNAVAILABLE, {})],
      ['names another service', refusal('agent service unavailable')],
      [
        'has a body that is not JSON',
        {
          status: 503,
          headers: { 'retry-after': '5' },
          data: 'Service Unavailable'
        }
      ],
      [
        'asks for a Retry-After past the cap',
        refusal(AUTH_UNAVAILABLE, { 'retry-after': '3600' })
      ]
    ])(
      'does not send a POST again when the 503 %s',
      async ([_name, answer]) => {
        const { client, adapter, sleep } = makeClient(
          [answer, { status: 200 }],
          policy
        )

        await expect(client.post('https://api/x', {})).rejects.toMatchObject({
          response: { status: 503 }
        })
        expect(adapter).toHaveBeenCalledTimes(1)
        expect(sleep).not.toHaveBeenCalled()
        expect(tracked()).not.toHaveBeenCalled()
      }
    )

    it('does not send a stream body again', async () => {
      const { client, adapter } = makeClient(
        [refusal(), { status: 200 }],
        policy
      )

      await expect(
        client.post('https://api/x', new ReadableStream<Uint8Array>())
      ).rejects.toMatchObject({ response: { status: 503 } })
      expect(adapter).toHaveBeenCalledTimes(1)
    })

    it('keeps the full retry budget for a GET', async () => {
      const { client, adapter } = makeClient([refusal()], policy)

      await expect(client.get('https://api/x')).rejects.toMatchObject({
        response: { status: 503 }
      })
      expect(adapter).toHaveBeenCalledTimes(DEFAULT_RETRY_POLICY.maxAttempts)
    })

    function makeClientWhoseWaitTakes(waitMs: number) {
      vi.useFakeTimers()
      const adapter = scriptedAdapter([refusal(), { status: 200 }])
      const client = axios.create({ adapter })
      attachRetryableStatusRetry(client, {
        random: () => 1,
        policy,
        sleep: async () => {
          vi.setSystemTime(Date.now() + waitMs)
        }
      })
      return { client, adapter }
    }

    it('rejects with the first 503 and sends nothing more when the wait spends the timeout', async () => {
      const { client, adapter } = makeClientWhoseWaitTakes(7_000)

      await expect(
        client.post('https://api/x', {}, { timeout: 6_000 })
      ).rejects.toMatchObject({
        response: { status: 503, data: { message: AUTH_UNAVAILABLE } }
      })
      expect(adapter).toHaveBeenCalledOnce()
      expect(tracked()).not.toHaveBeenCalled()
    })

    it('sends again with what is left of the timeout when the wait fits', async () => {
      const { client, adapter } = makeClientWhoseWaitTakes(5_250)

      const response = await client.post(
        'https://api/x',
        {},
        { timeout: 6_000 }
      )

      expect(response.status).toBe(200)
      expect(adapter.mock.calls.map(([config]) => config.timeout)).toEqual([
        6_000, 750
      ])
    })

    it('waits the Retry-After before sending again', async () => {
      vi.useFakeTimers()
      const adapter = scriptedAdapter([refusal(), { status: 200 }])
      const client = axios.create({ adapter })
      attachRetryableStatusRetry(client, { random: () => 1, policy })

      const pending = client.post('https://api/x', {})

      await vi.advanceTimersByTimeAsync(5_249)
      expect(adapter).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect((await pending).status).toBe(200)
      expect(adapter).toHaveBeenCalledTimes(2)
    })
  })

  it('waits the Retry-After the server sent', async () => {
    const { client, sleep } = makeClient([
      { status: 429, headers: { 'retry-after': '2' } },
      { status: 200 }
    ])

    await client.get('https://api/x')

    expect(sleep).toHaveBeenCalledExactlyOnceWith(2_250, undefined)
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

  it('sends once when the request opts out of the status retry', async () => {
    const { client, adapter, sleep } = makeClient([{ status: 503 }])

    await expect(
      client.get('https://api/x', { __skipStatusRetry: true })
    ).rejects.toMatchObject({ response: { status: 503 } })
    expect(adapter).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('retries through an adapter the request selects for itself', async () => {
    const { client, adapter: defaultAdapter } = makeClient([{ status: 200 }])
    const requestAdapter = scriptedAdapter([{ status: 503 }, { status: 200 }])

    const response = await client.get('https://api/x', {
      adapter: requestAdapter
    })

    expect(response.status).toBe(200)
    expect(requestAdapter).toHaveBeenCalledTimes(2)
    expect(defaultAdapter).not.toHaveBeenCalled()
  })

  it('does not stack a second retry loop when attached twice', async () => {
    const adapter = scriptedAdapter([{ status: 503 }])
    const client = axios.create({ adapter })
    const sleep = async () => {}
    attachRetryableStatusRetry(client, { sleep })
    attachRetryableStatusRetry(client, { sleep })

    await expect(client.get('https://api/x')).rejects.toMatchObject({
      response: { status: 503 }
    })
    expect(adapter).toHaveBeenCalledTimes(DEFAULT_RETRY_POLICY.maxAttempts)
  })

  describe('with a request timeout', () => {
    function makeTimedClient(answers: ScriptedAnswer[]) {
      const adapter = scriptedAdapter(answers)
      const client = axios.create({ adapter })
      attachRetryableStatusRetry(client, { random: () => 1 })
      return { client, adapter }
    }

    it('stops instead of waiting past the timeout', async () => {
      vi.useFakeTimers()
      const { client, adapter } = makeTimedClient([
        { status: 503, headers: { 'retry-after': '1' } },
        { status: 200 }
      ])

      await expect(
        client.get('https://api/x', { timeout: 100 })
      ).rejects.toMatchObject({ response: { status: 503 } })

      expect(adapter).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(0)
    })

    it('surfaces the last failure when the wait overruns the timeout', async () => {
      vi.useFakeTimers()
      const adapter = scriptedAdapter([{ status: 503 }, { status: 200 }])
      const client = axios.create({ adapter })
      attachRetryableStatusRetry(client, {
        random: () => 1,
        sleep: async () => {
          vi.setSystemTime(Date.now() + 5_000)
        }
      })

      await expect(
        client.get('https://api/x', { timeout: 1_000 })
      ).rejects.toMatchObject({ response: { status: 503 } })
      expect(adapter).toHaveBeenCalledTimes(1)
    })

    it('hands the original timeout back on the error it throws', async () => {
      vi.useFakeTimers()
      const adapter = scriptedAdapter([{ status: 503 }])
      const client = axios.create({ adapter })
      attachRetryableStatusRetry(client, {
        random: () => 1,
        sleep: async () => {
          vi.setSystemTime(Date.now() + 100)
        }
      })

      const error = await client
        .get('https://api/x', { timeout: 5_000 })
        .catch((reason: unknown) => reason)

      expect(error).toMatchObject({ config: { timeout: 5_000 } })
    })

    it('reports an abort during the wait as a cancellation', async () => {
      vi.useFakeTimers()
      const { client } = makeTimedClient([
        { status: 503, headers: { 'retry-after': '5' } }
      ])
      const controller = new AbortController()

      const outcome = client
        .get('https://api/x', { signal: controller.signal })
        .catch((reason: unknown) => reason)
      await vi.advanceTimersByTimeAsync(1_000)
      controller.abort()

      expect(axios.isCancel(await outcome)).toBe(true)
    })

    it('reports a timeout signal fired during the wait as a cancellation, not a stale 503', async () => {
      vi.useFakeTimers()
      const { client, adapter } = makeTimedClient([
        { status: 503, headers: { 'retry-after': '5' } }
      ])
      const controller = new AbortController()

      const outcome = client
        .get('https://api/x', { signal: controller.signal })
        .catch((reason: unknown) => reason)
      await vi.advanceTimersByTimeAsync(1_000)
      controller.abort(new DOMException('Fetch timeout', 'TimeoutError'))

      expect(axios.isCancel(await outcome)).toBe(true)
      expect(adapter).toHaveBeenCalledTimes(1)
    })

    it('reports a cancel token fired during the wait as a cancellation', async () => {
      vi.useFakeTimers()
      const { client } = makeTimedClient([
        { status: 503, headers: { 'retry-after': '5' } }
      ])
      const source = axios.CancelToken.source()

      const outcome = client
        .get('https://api/x', { cancelToken: source.token })
        .catch((reason: unknown) => reason)
      await vi.advanceTimersByTimeAsync(1_000)
      source.cancel()

      expect(axios.isCancel(await outcome)).toBe(true)
    })

    it('retries when the wait fits inside the timeout and shrinks the next attempt', async () => {
      vi.useFakeTimers()
      const { client, adapter } = makeTimedClient([
        { status: 503, headers: { 'retry-after': '1' } },
        { status: 200 }
      ])

      const pending = client.get('https://api/x', { timeout: 5_000 })
      await vi.advanceTimersByTimeAsync(1_250)

      expect((await pending).status).toBe(200)
      expect(adapter.mock.calls.map(([config]) => config.timeout)).toEqual([
        5_000, 3_750
      ])
    })
  })
})

describe('attachRetryableStatusRetry status retry telemetry', () => {
  const tracked = () => vi.mocked(useTelemetry()!.trackFetchStatusRetry)

  beforeEach(() => clearStatusRetryBudget())

  function failThenThrow(
    second: (config: InternalAxiosRequestConfig) => never
  ) {
    return vi
      .fn<AxiosAdapter>()
      .mockImplementationOnce(async (config) => {
        throw new AxiosError(
          'Request failed with status code 503',
          AxiosError.ERR_BAD_RESPONSE,
          config,
          null,
          { data: {}, status: 503, statusText: '503', headers: {}, config }
        )
      })
      .mockImplementationOnce(async (config) => second(config))
  }

  it('records a request that recovered after a retry', async () => {
    const { client } = makeClient([{ status: 503 }, { status: 200 }])

    await client.get('/api/billing/balance', {
      baseURL: 'https://cloud.comfy.org'
    })

    expect(tracked()).toHaveBeenCalledExactlyOnceWith({
      transport: 'axios',
      method: 'GET',
      host: 'cloud.comfy.org',
      route: '/billing/:resource',
      attempts: 2,
      final_status: 200,
      outcome: 'recovered'
    })
  })

  it.for<[string, ScriptedAnswer[], Record<string, unknown>]>([
    [
      'spent its attempts',
      [{ status: 503 }],
      { attempts: 3, final_status: 503, outcome: 'exhausted' }
    ],
    [
      'got a non-retryable error after a retry',
      [{ status: 503 }, { status: 404 }],
      { attempts: 2, final_status: 404, outcome: 'failed' }
    ]
  ])('records a request that %s', async ([_name, answers, expected]) => {
    const { client } = makeClient(answers)

    await expect(client.get('https://api/x')).rejects.toBeDefined()

    expect(tracked()).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining(expected)
    )
  })

  it('records a request whose wait would overrun its timeout', async () => {
    vi.useFakeTimers()
    const adapter = scriptedAdapter([{ status: 503 }, { status: 200 }])
    const client = axios.create({ adapter })
    attachRetryableStatusRetry(client, {
      random: () => 1,
      sleep: async () => {
        vi.setSystemTime(Date.now() + 5_000)
      }
    })

    await expect(
      client.get('https://api/x', { timeout: 1_000 })
    ).rejects.toBeDefined()

    expect(tracked()).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        attempts: 1,
        final_status: 503,
        outcome: 'timeout_budget'
      })
    )
  })

  it('records a retry that hit the request timeout', async () => {
    const adapter = failThenThrow((config) => {
      throw new AxiosError(
        'timeout of 60000ms exceeded',
        AxiosError.ECONNABORTED,
        config
      )
    })
    const client = axios.create({ adapter })
    attachRetryableStatusRetry(client, {
      sleep: async () => {},
      random: () => 1
    })

    await expect(
      client.get('https://api/x', { timeout: 60_000 })
    ).rejects.toMatchObject({ code: AxiosError.ECONNABORTED })

    expect(tracked()).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        attempts: 2,
        final_status: 503,
        outcome: 'timeout_budget'
      })
    )
  })

  it.for([
    ['a cancellation error', AxiosError.ERR_CANCELED, 'canceled'],
    ['a browser abort', AxiosError.ECONNABORTED, 'Request aborted']
  ])(
    'records nothing when a retry ends in %s',
    async ([_name, code, message]) => {
      const adapter = failThenThrow((config) => {
        throw new AxiosError(message, code, config)
      })
      const client = axios.create({ adapter })
      attachRetryableStatusRetry(client, {
        sleep: async () => {},
        random: () => 1
      })

      await expect(client.get('https://api/x')).rejects.toMatchObject({ code })

      expect(tracked()).not.toHaveBeenCalled()
    }
  )

  it('records a request whose own timeout signal fired while it waited to retry', async () => {
    const controller = new AbortController()
    const timeout = new DOMException('signal timed out', 'TimeoutError')
    const adapter = scriptedAdapter([{ status: 503 }, { status: 200 }])
    const client = axios.create({ adapter })
    attachRetryableStatusRetry(client, {
      random: () => 1,
      sleep: async () => {
        controller.abort(timeout)
        throw timeout
      }
    })

    await expect(
      client.get('https://api/x', { signal: controller.signal })
    ).rejects.toBeInstanceOf(axios.CanceledError)

    expect(tracked()).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        attempts: 1,
        final_status: 503,
        outcome: 'timeout_budget'
      })
    )
  })

  it('still returns the response when recording throws', async () => {
    tracked().mockImplementation(() => {
      throw new Error('telemetry down')
    })
    const { client } = makeClient([{ status: 503 }, { status: 200 }])

    await expect(client.get('https://api/x')).resolves.toMatchObject({
      status: 200
    })
  })

  it('records nothing for a request that never saw a retryable status', async () => {
    const { client } = makeClient([{ status: 404 }])

    await expect(client.get('https://api/x')).rejects.toBeDefined()

    expect(tracked()).not.toHaveBeenCalled()
  })

  it('records nothing for a read that opted out of the status retry', async () => {
    const { client } = makeClient([{ status: 503 }])

    await expect(
      client.get('https://api/x', { __skipStatusRetry: true })
    ).rejects.toBeDefined()

    expect(tracked()).not.toHaveBeenCalled()
  })
})
