import { afterEach, describe, expect, it, vi } from 'vitest'

import { WORKSHOP_ROUTER_BASE_URL } from '../../../../config/workshop-env'
import type { ReshootTransport } from './transport'
import { ReshootError, appProxyTransport, devProxyTransport } from './transport'
import { reshootTransport } from './transport-config'

const localDev = vi.hoisted(() => ({ value: false }))
vi.mock(import('astro:env/client'), () => ({
  get WORKSHOP_LOCAL_DEV() {
    return localDev.value
  }
}))

const fetchMock = vi.fn<typeof fetch>()
const APP = `${WORKSHOP_ROUTER_BASE_URL}/app-proxy/app-1`
const DEV = 'http://127.0.0.1:4329/api/v2'
const job = { id: 'job 1', status: 'succeeded' }
const output = { id: 'out-1', asset_id: 'asset-1', filename: 'result.mp4' }

function serve(
  response = () => Response.json({ id: 'job 1', status: 'queued' })
) {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(async () => response())
}

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1) ?? []
  return { url: String(url), init: init ?? {} }
}

const app = () => appProxyTransport('app-1', async () => 'jwt')
const dev = () => devProxyTransport('http://127.0.0.1:4329/')

afterEach(() => {
  localDev.value = false
})

describe('Re-shoot transports', () => {
  it.for<{
    name: string
    transport: () => ReshootTransport
    call: (transport: ReshootTransport) => Promise<unknown>
    method: string
    url: string
  }>([
    {
      name: 'app proxy quote',
      transport: app,
      call: (t) => t.quote(),
      method: 'GET',
      url: `${APP}/quote`
    },
    {
      name: 'app proxy upload',
      transport: app,
      call: (t) => t.upload(new File(['v'], 'clip.MOV')),
      method: 'POST',
      url: `${APP}/assets`
    },
    {
      name: 'app proxy submit',
      transport: app,
      call: (t) => t.submit({ 1: {} }, 'key-1'),
      method: 'POST',
      url: `${APP}/jobs`
    },
    {
      name: 'app proxy poll',
      transport: app,
      call: (t) => t.job('job 1'),
      method: 'GET',
      url: `${APP}/jobs/job%201`
    },
    {
      name: 'app proxy output',
      transport: app,
      call: (t) => t.output(job, output),
      method: 'GET',
      url: `${APP}/jobs/job%201/outputs/out-1/content`
    },
    {
      name: 'app proxy cancel',
      transport: app,
      call: (t) => t.cancel('job 1'),
      method: 'POST',
      url: `${APP}/jobs/job%201/cancel`
    },
    {
      name: 'dev proxy submit',
      transport: dev,
      call: (t) => t.submit({}, 'key-1'),
      method: 'POST',
      url: `${DEV}/jobs`
    },
    {
      name: 'dev proxy output',
      transport: dev,
      call: (t) => t.output(job, output),
      method: 'GET',
      url: `${DEV}/assets/asset-1/content`
    }
  ])('$name: $method $url', async ({ transport, call, method, url }) => {
    serve()
    await call(transport())
    const request = lastRequest()
    expect(request.url).toBe(url)
    expect(request.init.method ?? 'GET').toBe(method)
    expect(request.init.credentials).toBe('omit')
  })

  it('signs app proxy calls as the visitor and dev proxy calls not at all', async () => {
    serve()
    await app().job('job 1')
    expect(lastRequest().init.headers).toEqual({ Authorization: 'Bearer jwt' })
    await dev().job('job 1')
    expect(lastRequest().init.headers).toEqual({})
  })

  it('submits the workflow alone, under the given idempotency key', async () => {
    serve()
    await app().submit({ 1: { class_type: 'LoadVideo' } }, 'key-1')
    const { init } = lastRequest()
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'Idempotency-Key': 'key-1'
    })
    expect(JSON.parse(String(init.body))).toEqual({
      workflow: { 1: { class_type: 'LoadVideo' } }
    })
  })

  it('uploads as v2 assets do and binds the name the upload returns', async () => {
    serve(() => Response.json({ file_path: 'earlier.mp4' }))
    const name = await app().upload(
      new File(['v'], 'clip.MOV', { type: 'video/quicktime' })
    )
    const form = lastRequest().init.body
    if (!(form instanceof FormData)) throw new Error('not multipart')
    expect(form.get('file_path')).toMatch(/^crossview-.+\.mov$/)
    expect(form.get('content_type')).toBe('video/quicktime')
    expect(form.get('file')).toBeInstanceOf(File)
    expect(name).toBe('earlier.mp4')
  })

  it('has no quote behind the dev proxy', async () => {
    serve()
    await expect(dev().quote()).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.for<{
    status: number
    headers?: Record<string, string>
    body: string
    code: string
    retry?: number
  }>([
    {
      status: 402,
      headers: { 'X-Comfy-Error-Type': 'insufficient_credits' },
      body: '{"error_type":"insufficient_credits","detail":"top up"}',
      code: 'insufficient_credits'
    },
    { status: 402, body: '', code: 'insufficient_credits' },
    {
      status: 429,
      headers: { 'Retry-After': '3600' },
      body: '{"error_type":"free_runs_exhausted","detail":"","details":{"runs":5}}',
      code: 'free_runs_exhausted',
      retry: 3600
    },
    {
      status: 429,
      body: '{"error_type":"concurrent_run_limit","detail":""}',
      code: 'concurrent_run_limit'
    },
    {
      status: 429,
      body: '{"error_type":"unmetered_rate_limited","detail":""}',
      code: 'unmetered_rate_limited'
    },
    {
      status: 429,
      body: '{"error_type":"upload_rate_limited","detail":""}',
      code: 'upload_rate_limited'
    },
    {
      status: 503,
      body: '{"error_type":"app_unavailable","detail":""}',
      code: 'app_unavailable'
    },
    {
      status: 503,
      body: '{"error_type":"deployment_not_ready","detail":"warming"}',
      code: 'deployment_not_ready'
    },
    {
      status: 503,
      body: '{"error":{"code":"deployment_not_ready"}}',
      code: 'deployment_not_ready'
    },
    { status: 401, body: '', code: 'unauthorized' },
    { status: 500, body: 'oops', code: 'http_500' }
  ])(
    'reads a $status refusal as $code',
    async ({ status, headers, body, code, retry }) => {
      serve(() => new Response(body, { status, headers }))
      const failure = await app()
        .submit({}, 'key')
        .catch((error: unknown) => error)
      expect(failure).toBeInstanceOf(ReshootError)
      expect(failure).toMatchObject({ code, retryAfterSeconds: retry })
    }
  )

  it.for<{ local: boolean; dev?: string; id?: string; base?: string }>([
    { local: true, dev: 'http://127.0.0.1:4329', id: 'app-1', base: DEV },
    { local: false, dev: 'http://127.0.0.1:4329', id: 'app-1', base: APP },
    { local: false, dev: 'http://127.0.0.1:4329' },
    { local: true, id: 'app-1', base: APP },
    { local: true }
  ])(
    'picks $base in local dev $local',
    async ({ local, dev: devProxy, id, base }) => {
      localDev.value = local
      vi.stubEnv('PUBLIC_CROSSVIEW_PROXY', devProxy)
      vi.stubEnv('PUBLIC_WORKSHOP_RESHOOT_PROXY_ID', id)
      serve()
      const transport = reshootTransport(async () => 'jwt')
      if (!base) return expect(transport).toBeUndefined()
      await transport?.job('j')
      expect(lastRequest().url).toBe(`${base}/jobs/j`)
    }
  )
})
