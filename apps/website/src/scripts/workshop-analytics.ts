import type { Modality, WorkshopModel } from '../config/models-catalogue'
import type { RunFailure, RunOutput } from '../config/workshop-run'
import type {
  FieldErrorCode,
  FieldErrors,
  FieldSchema
} from '../config/workshop-playground'
import type { WorkshopFailureStage } from '../config/workshop-router-errors'
import { WorkshopRouterError } from '../config/workshop-router-errors'
import type { WorkshopWorkflowError } from '../config/workshop-workflow-api'
import type { WorkshopExceptionAnalytics } from './workshop-exception'
import { workshopExceptionAnalytics } from './workshop-exception'

interface WorkshopModelAnalytics {
  model_slug: string
  page_type?: 'model' | 'workflow'
  render_engine?: 'router' | 'cloud' | 'serverless'
  router_id?: string
  workflow_id?: string
  provider?: string
  modality?: Modality
}

export interface WorkshopRunAnalytics extends WorkshopModelAnalytics {
  attempt_id: string
  user_id: string
  workspace_id: string
}

export type WorkshopCheckoutFailureStage = 'balance' | 'credential' | 'checkout'

export type WorkshopCheckoutErrorCode =
  | 'ACCESS_DENIED'
  | 'CONFLICT'
  | 'INVALID_AMOUNT'
  | 'INVALID_RESPONSE'
  | 'INVALID_RETURN_URL'
  | 'MALFORMED_RESPONSE'
  | 'NOT_AUTHENTICATED'
  | 'NOT_AVAILABLE'
  | 'NOT_FOUND'
  | 'REQUEST_FAILED'
  | 'SUPERSEDED'

const WORKSHOP_CHECKOUT_ERROR_CODES: Readonly<
  Record<string, WorkshopCheckoutErrorCode>
> = {
  ACCESS_DENIED: 'ACCESS_DENIED',
  CONFLICT: 'CONFLICT',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  INVALID_RETURN_URL: 'INVALID_RETURN_URL',
  MALFORMED_RESPONSE: 'MALFORMED_RESPONSE',
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  NOT_FOUND: 'NOT_FOUND',
  REQUEST_FAILED: 'REQUEST_FAILED',
  SUPERSEDED: 'SUPERSEDED'
}

const WORKSHOP_ROUTER_ERROR_TYPES = [
  'concurrency_limit_exceeded',
  'rate_limit_exceeded',
  'invalid_input',
  'content_policy_violation',
  'deadline_exceeded',
  'forbidden',
  'insufficient_credits',
  'not_enabled',
  'provider_error',
  'provider_timeout'
] as const

export type WorkshopRouterErrorType =
  (typeof WORKSHOP_ROUTER_ERROR_TYPES)[number]

export type WorkshopAnalyticsEvent =
  | {
      name: 'catalogue_viewed'
      properties: { model_count: number; page_type?: 'model' | 'workflow' }
    }
  | {
      name: 'model_viewed' | 'api_viewed'
      properties: WorkshopModelAnalytics
    }
  | {
      name: 'run_validation_failed'
      properties: WorkshopModelAnalytics & {
        field_error_codes?: FieldErrorCode[]
        field_error_names?: string[]
      }
    }
  | { name: 'run_started'; properties: WorkshopRunAnalytics }
  | {
      name: 'delivery_finished'
      properties: WorkshopRunAnalytics & {
        request_id?: string
        duration_ms: number
        output_kind: RunOutput['kind']
        status: 'succeeded' | 'failed' | 'cancelled' | 'unverified'
        reason?: 'media_error' | 'media_timeout'
        failure_stage?: 'delivery'
      }
    }
  | {
      name: 'run_finished'
      properties: WorkshopRunAnalytics & {
        duration_ms: number
        request_id?: string
      } & (
          | { status: 'succeeded'; output_count: number }
          | ({
              status: 'failed'
              reason: RunFailure
              http_status?: number
              router_error_type?: WorkshopRouterErrorType
              workflow_error_code?: WorkshopWorkflowError['code']
              failure_stage?: WorkshopFailureStage | 'credential'
              field_error_codes?: FieldErrorCode[]
              field_error_names?: string[]
            } & WorkshopExceptionAnalytics)
          | { status: 'cancelled' }
        )
    }
  | {
      name: 'checkout_failed'
      properties: {
        attempt_id?: string
        user_id: string
        workspace_id: string
        stage: WorkshopCheckoutFailureStage
        http_status?: number
        error_code?: WorkshopCheckoutErrorCode
      }
    }
  | {
      name: 'output_download_clicked'
      properties: WorkshopModelAnalytics & { output_kind: RunOutput['kind'] }
    }

export function workshopModelAnalytics(
  model: WorkshopModel
): WorkshopModelAnalytics {
  return {
    model_slug: model.slug,
    page_type: model.routerId === undefined ? 'workflow' : 'model',
    render_engine:
      model.type === 'CLOUD'
        ? 'cloud'
        : model.type === 'SERVERLESS'
          ? 'serverless'
          : 'router',
    router_id: model.routerId,
    ...(model.workflowId ? { workflow_id: model.workflowId } : {}),
    provider: model.provider,
    modality: model.modality
  }
}

const WORKFLOW_FAILURE_REASONS: Record<
  WorkshopWorkflowError['code'],
  RunFailure
> = {
  invalid_request: 'validation',
  invalid_input: 'validation',
  payload_too_large: 'validation',
  unsupported_media_type: 'validation',
  not_authenticated: 'unavailable',
  access_denied: 'unavailable',
  workflow_not_found: 'unavailable',
  run_not_found: 'unavailable',
  definition_changed: 'unavailable',
  definition_incompatible: 'unavailable',
  insufficient_credits: 'noCredits',
  rate_limited: 'rateLimit',
  media_unavailable: 'upload',
  execution_failed: 'provider',
  delivery_failed: 'upload',
  submission_unknown: 'network',
  network: 'network',
  response: 'response',
  persistence: 'client'
}

export function workshopWorkflowFailureAnalytics(
  failure: WorkshopWorkflowError,
  schema: readonly FieldSchema[]
) {
  return {
    reason: WORKFLOW_FAILURE_REASONS[failure.code],
    workflow_error_code: failure.code,
    http_status: workshopHttpStatus(failure.status),
    ...(['not_authenticated', 'access_denied'].includes(failure.code)
      ? { failure_stage: 'credential' as const }
      : {}),
    field_error_codes: workshopFieldErrorCodes(failure.fieldErrors),
    field_error_names: schema
      .filter((field) => Object.hasOwn(failure.fieldErrors, field.name))
      .map((field) => field.name)
  }
}

export function workshopHttpStatus(
  status: number | undefined
): number | undefined {
  return status !== undefined &&
    Number.isInteger(status) &&
    status >= 100 &&
    status <= 599
    ? status
    : undefined
}

export function workshopRouterErrorType(
  errorType: string | null | undefined
): WorkshopRouterErrorType | undefined {
  return WORKSHOP_ROUTER_ERROR_TYPES.find((value) => value === errorType)
}

export function workshopFieldErrorCodes(errors: FieldErrors): FieldErrorCode[] {
  return [...new Set(Object.values(errors))]
}

function diagnosticCause(cause: unknown): unknown | undefined {
  let current = cause
  for (let depth = 0; depth < 8; depth += 1) {
    if (!(current instanceof WorkshopRouterError)) return current
    if (!('cause' in current)) return undefined
    current = current.cause
  }
  return current instanceof WorkshopRouterError ? undefined : current
}

export function workshopFailureAnalytics(
  failure: WorkshopRouterError,
  schema: readonly FieldSchema[] = []
) {
  const httpStatus = workshopHttpStatus(failure.response?.status)
  const routerErrorType = workshopRouterErrorType(failure.response?.errorType)
  const fieldErrorCodes = workshopFieldErrorCodes(failure.fieldErrors)
  const fieldErrorNames = schema
    .filter((field) => Object.hasOwn(failure.fieldErrors, field.name))
    .map((field) => field.name)
  const cause = 'cause' in failure ? diagnosticCause(failure.cause) : undefined
  return {
    reason: failure.reason,
    request_id: failure.requestId ?? undefined,
    ...(httpStatus === undefined ? {} : { http_status: httpStatus }),
    ...(routerErrorType === undefined
      ? {}
      : { router_error_type: routerErrorType }),
    ...(failure.stage ? { failure_stage: failure.stage } : {}),
    ...(cause === undefined ? {} : workshopExceptionAnalytics(cause)),
    ...(fieldErrorCodes.length ? { field_error_codes: fieldErrorCodes } : {}),
    ...(fieldErrorNames.length ? { field_error_names: fieldErrorNames } : {})
  }
}

export function workshopCheckoutErrorCode(
  errorCode: string | undefined
): WorkshopCheckoutErrorCode | undefined {
  return errorCode === undefined
    ? undefined
    : WORKSHOP_CHECKOUT_ERROR_CODES[errorCode]
}
