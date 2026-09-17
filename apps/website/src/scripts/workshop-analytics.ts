import type { Modality, WorkshopModel } from '../config/models-catalogue'
import type { RunFailure, RunOutput } from '../config/workshop-run'

interface WorkshopModelAnalytics {
  model_slug: string
  router_id?: string
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

export type WorkshopRouterErrorType =
  | 'content_policy_violation'
  | 'deadline_exceeded'
  | 'forbidden'
  | 'insufficient_credits'
  | 'not_enabled'
  | 'provider_error'
  | 'provider_timeout'

export type WorkshopAnalyticsEvent =
  | { name: 'catalogue_viewed'; properties: { model_count: number } }
  | {
      name: 'model_viewed' | 'api_viewed' | 'run_validation_failed'
      properties: WorkshopModelAnalytics
    }
  | { name: 'run_started'; properties: WorkshopRunAnalytics }
  | {
      name: 'run_finished'
      properties: WorkshopRunAnalytics & {
        duration_ms: number
        request_id?: string
      } & (
          | { status: 'succeeded'; output_count: number }
          | {
              status: 'failed'
              reason: RunFailure
              http_status?: number
              router_error_type?: WorkshopRouterErrorType
            }
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
    router_id: model.routerId,
    provider: model.provider,
    modality: model.modality
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
  switch (errorType) {
    case 'content_policy_violation':
    case 'deadline_exceeded':
    case 'forbidden':
    case 'insufficient_credits':
    case 'not_enabled':
    case 'provider_error':
    case 'provider_timeout':
      return errorType
    default:
      return undefined
  }
}

export function workshopCheckoutErrorCode(
  errorCode: string | undefined
): WorkshopCheckoutErrorCode | undefined {
  return errorCode === undefined
    ? undefined
    : WORKSHOP_CHECKOUT_ERROR_CODES[errorCode]
}
