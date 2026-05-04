import type { PostHogConfig } from 'posthog-js'

import type { TelemetryEventName } from '@/platform/telemetry/types'

/**
 * Server health alert configuration from the backend
 */
type ServerHealthAlert = {
  message: string
  tooltip?: string
  severity?: 'info' | 'warning' | 'error'
  badge?: string
}

type FirebaseRuntimeConfig = {
  apiKey: string
  authDomain: string
  databaseURL?: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  measurementId?: string
}

/**
 * Server-driven onboarding survey schema.
 *
 * The backend ships the entire form definition so onboarding questions can
 * be tweaked without a frontend release. Field types map 1:1 to a component
 * in our internal UI library — see `DynamicSurveyField.vue`.
 */
export type OnboardingSurveyFieldType = 'single' | 'multi' | 'text'

/**
 * A translatable string. Either:
 * - a single literal (treated as the fallback in any locale), or
 * - a locale → text map, e.g. `{ en: 'Personal use', ko: '개인 용도' }`,
 *   so the backend can ship translations without a frontend release.
 */
export type LocalizedString = string | Record<string, string>

export type OnboardingSurveyOption = {
  value: string
  label?: LocalizedString
  labelKey?: string
}

export type OnboardingSurveyFieldCondition = {
  field: string
  equals?: string | string[]
}

export type OnboardingSurveyField = {
  id: string
  type: OnboardingSurveyFieldType
  labelKey?: string
  label?: LocalizedString
  options?: OnboardingSurveyOption[]
  required?: boolean
  randomize?: boolean
  allowOther?: boolean
  otherFieldId?: string
  placeholder?: string
  showWhen?: OnboardingSurveyFieldCondition
}

export type OnboardingSurvey = {
  version: number
  introKey?: string
  fields: OnboardingSurveyField[]
}

/**
 * Remote configuration type
 * Configuration fetched from the server at runtime
 */
export type RemoteConfig = {
  gtm_container_id?: string
  ga_measurement_id?: string
  mixpanel_token?: string
  posthog_project_token?: string
  posthog_api_host?: string
  posthog_config?: Partial<PostHogConfig>
  subscription_required?: boolean
  server_health_alert?: ServerHealthAlert
  max_upload_size?: number
  comfy_api_base_url?: string
  comfy_platform_base_url?: string
  firebase_config?: FirebaseRuntimeConfig
  telemetry_disabled_events?: TelemetryEventName[]
  model_upload_button_enabled?: boolean
  asset_rename_enabled?: boolean
  private_models_enabled?: boolean
  onboarding_survey_enabled?: boolean
  onboarding_survey?: OnboardingSurvey
  linear_toggle_enabled?: boolean
  team_workspaces_enabled?: boolean
  user_secrets_enabled?: boolean
  node_library_essentials_enabled?: boolean
  free_tier_credits?: number
  new_free_tier_subscriptions?: boolean
  workflow_sharing_enabled?: boolean
  comfyhub_upload_enabled?: boolean
  comfyhub_profile_gate_enabled?: boolean
  sentry_dsn?: string
}
