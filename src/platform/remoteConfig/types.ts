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
type OnboardingSurveyFieldType = 'single' | 'multi' | 'text'

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
  icon?: string
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
  syftdata_source_id?: string
  customer_io?: {
    write_key?: string
    site_id?: string
    user_id?: string
  }
  subscription_required?: boolean
  server_health_alert?: ServerHealthAlert
  max_upload_size?: number
  comfy_api_base_url?: string
  comfy_platform_base_url?: string
  firebase_config?: FirebaseRuntimeConfig
  firebase_env?: 'dev'
  telemetry_disabled_events?: TelemetryEventName[]
  enable_telemetry?: boolean
  model_upload_button_enabled?: boolean
  asset_rename_enabled?: boolean
  private_models_enabled?: boolean
  onboarding_survey_enabled?: boolean
  onboarding_survey?: OnboardingSurvey
  /** Full hosted (external) survey URL embedded in the Nodes Manager modal on Cloud. */
  manager_survey_url?: string
  linear_toggle_enabled?: boolean
  team_workspaces_enabled?: boolean
  user_secrets_enabled?: boolean
  node_library_essentials_enabled?: boolean
  free_tier_credits?: number
  free_tier_balance?: {
    allowance: number
    used: number
    remaining: number
  }
  new_free_tier_subscriptions?: boolean
  workflow_sharing_enabled?: boolean
  comfyhub_upload_enabled?: boolean
  comfyhub_profile_gate_enabled?: boolean
  unified_cloud_auth?: boolean
  billing_control_enabled?: boolean
  onboarding_tour_enabled?: boolean
  sentry_dsn?: string
  turnstile_sitekey?: string
  // Raw, unvalidated wire value (a server typo like 'enfroce' is possible).
  // Always funnel it through normalizeTurnstileMode before trusting it as a
  // TurnstileMode — that resolver is the single narrowing boundary.
  signup_turnstile?: string
}

/**
 * Gate mode for the signup Turnstile challenge.
 * - 'off': do not render the widget
 * - 'shadow': render the widget but never block submit (observe only)
 * - 'enforce': block submit until the challenge is solved
 */
export type TurnstileMode = 'off' | 'shadow' | 'enforce'
