/**
 * Storybook mock for `useFeatureFlags`.
 *
 * The real composable resolves flags from authenticated remote config, which is
 * unavailable in Storybook. This stub enables the workspace-facing flags so
 * team-plan billing components (e.g. the post-upgrade invite block) render.
 */
// Inlined from `@/composables/useFeatureFlags` (the alias points here) so the
// enum, consumed by modules like nodeReplacementStore, resolves without dragging
// the real composable's auth/remote-config dependency graph into the bundle.
export enum ServerFeatureFlag {
  SUPPORTS_PREVIEW_METADATA = 'supports_preview_metadata',
  MAX_UPLOAD_SIZE = 'max_upload_size',
  MANAGER_SUPPORTS_V4 = 'extension.manager.supports_v4',
  MODEL_UPLOAD_BUTTON_ENABLED = 'model_upload_button_enabled',
  ASSET_RENAME_ENABLED = 'asset_rename_enabled',
  PRIVATE_MODELS_ENABLED = 'private_models_enabled',
  ONBOARDING_SURVEY_ENABLED = 'onboarding_survey_enabled',
  LINEAR_TOGGLE_ENABLED = 'linear_toggle_enabled',
  TEAM_WORKSPACES_ENABLED = 'team_workspaces_enabled',
  USER_SECRETS_ENABLED = 'user_secrets_enabled',
  NODE_REPLACEMENTS = 'node_replacements',
  NODE_LIBRARY_ESSENTIALS_ENABLED = 'node_library_essentials_enabled',
  WORKFLOW_SHARING_ENABLED = 'workflow_sharing_enabled',
  COMFYHUB_UPLOAD_ENABLED = 'comfyhub_upload_enabled',
  COMFYHUB_PROFILE_GATE_ENABLED = 'comfyhub_profile_gate_enabled',
  SHOW_SIGNIN_BUTTON = 'show_signin_button',
  UNIFIED_CLOUD_AUTH = 'unified_cloud_auth',
  BILLING_CONTROL_ENABLED = 'billing_control_enabled'
}

export function useFeatureFlags() {
  return {
    flags: {
      teamWorkspacesEnabled: true,
      billingControlEnabled: true
    }
  }
}
