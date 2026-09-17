import { z } from 'zod'

import type { WorkshopCloudEnv } from '../src/config/workshop-cloud-env'
import type {
  ReportFailureCode,
  ReportSource,
  RouterModelReportUpdate
} from './router-model-report'

const eventSchema = z.object({
  at: z.string().datetime({ offset: true }),
  phase: z.enum(['preflight', 'generation']),
  status: z.string(),
  requestId: z.string().nullable().optional(),
  completion: z.literal('collected-after-timeout').optional(),
  reason: z.string().optional(),
  fieldErrors: z.record(z.string(), z.unknown()).optional(),
  response: z
    .object({
      status: z.number().int(),
      errorType: z.string().nullable().optional()
    })
    .optional(),
  artifacts: z
    .array(
      z.object({
        kind: z.enum(['image', 'video', 'audio']),
        bytes: z.number(),
        sha256: z.string(),
        width: z.number().optional(),
        height: z.number().optional(),
        durationSeconds: z.number().optional(),
        channels: z.number().optional()
      })
    )
    .optional()
})

const localFailureCodes = new Map<string, ReportFailureCode>([
  ['upload', 'upload'],
  ['network', 'network'],
  ['response', 'response'],
  ['client', 'client'],
  ['conflict', 'conflict']
])

const modelFailureCodes = new Map<string, ReportFailureCode>([
  ['noCredits', 'no-credits'],
  ['unavailable', 'unavailable'],
  ['validation', 'invalid-input'],
  ['provider', 'provider-error'],
  ['policy', 'policy'],
  ['timeout', 'timeout'],
  ['verification', 'invalid-artifact']
])

function admissionFailureCode(
  event: z.infer<typeof eventSchema>
): ReportFailureCode | undefined {
  if (
    event.reason === 'concurrency' ||
    event.response?.errorType === 'concurrency_limit_exceeded'
  )
    return 'concurrency-limit'
  if (event.response?.status === 429 || event.reason === 'rateLimit')
    return 'rate-limit'
  if (event.response?.status === 401) return 'authentication'
  return undefined
}

function modelFailureCode(
  event: z.infer<typeof eventSchema>
): ReportFailureCode {
  const failure = modelFailureCodes.get(event.reason ?? '') ?? 'unknown'
  const errorType = event.response?.errorType
  if (failure === 'no-credits' || failure === 'unavailable') return failure
  if (errorType === 'invalid_input' || failure === 'invalid-input')
    return 'invalid-input'
  if (errorType === 'provider_error') return 'provider-error'
  return failure
}

function failureCode(event: z.infer<typeof eventSchema>): ReportFailureCode {
  return (
    localFailureCodes.get(event.reason ?? '') ??
    admissionFailureCode(event) ??
    modelFailureCode(event)
  )
}

export function routerReportUpdate(
  model: Pick<RouterModelReportUpdate, 'slug' | 'routerId' | 'modality'>,
  environment: WorkshopCloudEnv,
  source: ReportSource,
  data: unknown
): RouterModelReportUpdate | undefined {
  const event = eventSchema.parse(data)
  const base = { ...model, environment, inputMode: 'page-defaults' as const }
  const fields = Object.keys(event.fieldErrors ?? {})
    .filter((name) => /^[A-Za-z_][A-Za-z0-9_.[\]-]{0,79}$/.test(name))
    .slice(0, 100)
  if (event.phase === 'preflight') {
    if (event.status !== 'ready' && event.status !== 'failed') return
    return {
      ...base,
      preflight: { status: event.status, at: event.at, fields, source }
    }
  }
  if (!['passed', 'failed', 'cancelled'].includes(event.status)) return
  const requestId = z.string().uuid().safeParse(event.requestId)
  const common = {
    at: event.at,
    source,
    ...(requestId.success ? { requestId: requestId.data } : {}),
    ...(event.response ? { httpStatus: event.response.status } : {})
  }
  if (event.status === 'passed')
    return {
      ...base,
      live: {
        ...common,
        status: 'passed',
        ...(event.completion ? { completion: event.completion } : {}),
        artifacts: event.artifacts
      }
    }
  if (event.status === 'cancelled')
    return {
      ...base,
      live: { ...common, status: 'cancelled', failure: 'cancelled' }
    }
  const failure = failureCode(event)
  const blocked = [
    'concurrency-limit',
    'rate-limit',
    'authentication',
    'no-credits',
    'unavailable'
  ].includes(failure)
  return {
    ...base,
    live: { ...common, status: blocked ? 'blocked' : 'failed', failure, fields }
  }
}
