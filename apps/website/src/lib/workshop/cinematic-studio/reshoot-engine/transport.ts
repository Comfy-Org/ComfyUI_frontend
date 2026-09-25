import { WORKSHOP_ROUTER_BASE_URL } from '../../../../config/workshop-env'

export interface ReshootOutput {
  readonly id?: string
  readonly asset_id?: string
  readonly filename?: string
  readonly name?: string
}

export interface ReshootJob {
  readonly id: string
  readonly status: string
  readonly outputs?: readonly ReshootOutput[]
}

export interface ReshootQuote {
  readonly free_runs_allowance?: {
    readonly runs: number
    readonly period: string
    readonly period_seconds: number
  }
  readonly free_runs_remaining: number
  readonly resets_at?: string | null
  readonly price_credits: number
  readonly next_run: 'free' | 'paid' | 'blocked'
  readonly blocked_reason?: string
}

/**
 * A refusal or failure, by the Router's `error_type` code: the app proxy's
 * own (`insufficient_credits`, `free_runs_exhausted`, `app_unavailable`, ...)
 * or one the deployment passed through (`deployment_not_ready`, ...).
 */
export class ReshootError extends Error {
  constructor(
    readonly code: string,
    readonly retryAfterSeconds?: number,
    readonly detail = ''
  ) {
    super(detail ? `${code}: ${detail}` : code)
  }
}

/** One conversation with the Re-shoot deployment, whoever holds its key. */
export interface ReshootTransport {
  /** What the next metered run costs; undefined where nothing is metered. */
  quote(signal?: AbortSignal): Promise<ReshootQuote | undefined>
  /** Uploads a clip and returns the name LoadVideo must be given. */
  upload(file: File, signal?: AbortSignal): Promise<string>
  submit(
    workflow: object,
    idempotencyKey: string,
    signal?: AbortSignal
  ): Promise<ReshootJob>
  job(id: string, signal?: AbortSignal): Promise<ReshootJob>
  output(
    job: ReshootJob,
    output: ReshootOutput,
    signal?: AbortSignal
  ): Promise<Blob>
  cancel(id: string): Promise<void>
}

const STATUS_CODES: Readonly<Partial<Record<number, string>>> = {
  401: 'unauthorized',
  402: 'insufficient_credits',
  404: 'not_found'
}

function bodyField(body: string, key: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body)
    const value =
      parsed && typeof parsed === 'object'
        ? Reflect.get(parsed, key)
        : undefined
    return typeof value === 'string' ? value : undefined
  } catch {
    return undefined
  }
}

export async function reshootError(response: Response): Promise<ReshootError> {
  const body = await response.text().catch(() => '')
  const retryAfter = Number(response.headers.get('Retry-After') ?? NaN)
  const code =
    response.headers.get('X-Comfy-Error-Type') ||
    bodyField(body, 'error_type') ||
    // the deployment's own v2 errors, as the dev proxy passes them on
    (body.includes('deployment_not_ready')
      ? 'deployment_not_ready'
      : undefined) ||
    STATUS_CODES[response.status] ||
    `http_${response.status}`
  return new ReshootError(
    code,
    Number.isFinite(retryAfter) ? retryAfter : undefined,
    bodyField(body, 'detail') ?? ''
  )
}

interface Routes {
  readonly base: string
  readonly headers: () => Promise<Record<string, string>>
  readonly outputPath: (job: ReshootJob, output: ReshootOutput) => string
}

type Init = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>
}

function createTransport(routes: Routes, quoted: boolean): ReshootTransport {
  async function send(path: string, init: Init = {}) {
    const response = await fetch(routes.base + path, {
      ...init,
      credentials: 'omit',
      headers: { ...(await routes.headers()), ...init.headers }
    })
    if (!response.ok) throw await reshootError(response)
    return response
  }
  const json = async <T>(path: string, init?: Init): Promise<T> =>
    (await send(path, init)).json() as Promise<T>

  return {
    quote: async (signal) =>
      quoted ? json<ReshootQuote>('/quote', { signal }) : undefined,
    async upload(file, signal) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4'
      const name = `crossview-${crypto.randomUUID()}.${ext}`
      const form = new FormData()
      form.set('file_path', name)
      form.set('content_type', file.type || 'video/mp4')
      form.set('file', file, name)
      const asset = await json<{ file_path?: string }>('/assets', {
        method: 'POST',
        body: form,
        signal
      })
      // Assets are content-addressed: bytes seen before come back under their
      // earlier name, and that is the name to bind.
      return asset.file_path ?? name
    },
    submit: (workflow, idempotencyKey, signal) =>
      json<ReshootJob>('/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ workflow }),
        signal
      }),
    job: (id, signal) =>
      json<ReshootJob>(`/jobs/${encodeURIComponent(id)}`, { signal }),
    output: async (job, output, signal) =>
      (await send(routes.outputPath(job, output), { signal })).blob(),
    async cancel(id) {
      await send(`/jobs/${encodeURIComponent(id)}/cancel`, {
        method: 'POST'
      }).catch(() => undefined)
    }
  }
}

/** comfy-api's app proxy: the signed-in visitor's own runs, quota and credits. */
export function appProxyTransport(
  proxyId: string,
  token: () => Promise<string>
): ReshootTransport {
  return createTransport(
    {
      base: `${WORKSHOP_ROUTER_BASE_URL}/app-proxy/${encodeURIComponent(proxyId)}`,
      headers: async () => ({ Authorization: `Bearer ${await token()}` }),
      outputPath: (job, output) =>
        `/jobs/${encodeURIComponent(job.id)}/outputs/${encodeURIComponent(output.id ?? '')}/content`
    },
    true
  )
}

/**
 * The local key-holding proxy (scripts/crossview-dev-proxy.ts), which speaks
 * the deployment's own v2 API. Nothing is metered, so there is no quote.
 */
export function devProxyTransport(origin: string): ReshootTransport {
  return createTransport(
    {
      base: `${origin.replace(/\/$/, '')}/api/v2`,
      headers: async () => ({}),
      outputPath: (_job, output) =>
        `/assets/${encodeURIComponent(output.asset_id ?? output.id ?? '')}/content`
    },
    false
  )
}
