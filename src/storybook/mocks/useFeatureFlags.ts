/**
 * Storybook mock for `useFeatureFlags`.
 *
 * The real composable resolves flags from authenticated remote config, which is
 * unavailable in Storybook. This stub enables the workspace-facing flags so
 * team-plan billing components (e.g. the post-upgrade invite block) render.
 */
export function useFeatureFlags() {
  return {
    flags: {
      teamWorkspacesEnabled: true
    }
  }
}
