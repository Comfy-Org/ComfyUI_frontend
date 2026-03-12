import { z } from 'zod'

const zServerHealthAlert = z.object({
  message: z.string(),
  tooltip: z.string().optional(),
  severity: z.enum(['info', 'warning', 'error']).optional(),
  badge: z.string().optional()
})

const zFirebaseRuntimeConfig = z.object({
  apiKey: z.string(),
  authDomain: z.string(),
  databaseURL: z.string().optional(),
  projectId: z.string(),
  storageBucket: z.string(),
  messagingSenderId: z.string(),
  appId: z.string(),
  measurementId: z.string().optional()
})

export const remoteConfigSchema = z.object({
  gtm_container_id: z.string().optional(),
  ga_measurement_id: z.string().optional(),
  mixpanel_token: z.string().optional(),
  posthog_project_token: z.string().optional(),
  posthog_api_host: z.string().optional(),
  posthog_config: z.record(z.unknown()).optional(),
  subscription_required: z.boolean().optional(),
  server_health_alert: zServerHealthAlert.optional(),
  max_upload_size: z.number().optional(),
  comfy_api_base_url: z.string().optional(),
  comfy_platform_base_url: z.string().optional(),
  firebase_config: zFirebaseRuntimeConfig.optional(),
  telemetry_disabled_events: z.array(z.string()).optional(),
  model_upload_button_enabled: z.boolean().optional(),
  asset_rename_enabled: z.boolean().optional(),
  private_models_enabled: z.boolean().optional(),
  onboarding_survey_enabled: z.boolean().optional(),
  linear_toggle_enabled: z.boolean().optional(),
  team_workspaces_enabled: z.boolean().optional(),
  user_secrets_enabled: z.boolean().optional(),
  node_library_essentials_enabled: z.boolean().optional(),
  free_tier_credits: z.number().optional(),
  new_free_tier_subscriptions: z.boolean().optional(),
  workflow_sharing_enabled: z.boolean().optional(),
  comfyhub_upload_enabled: z.boolean().optional(),
  comfyhub_profile_gate_enabled: z.boolean().optional()
}).passthrough()
