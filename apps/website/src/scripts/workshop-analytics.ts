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
              router_error_type?: string
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
        error_code?: string
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
