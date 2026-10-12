export const CINEMATIC_STUDIO_APP_SLUG = 'apps/cinematic-studio'
export const RESHOOT_APP_SLUG = 'apps/reshoot'

export function studioAnalytics(modelSlug: string) {
  return {
    model_slug: modelSlug,
    page_type: 'app',
    app_slug: CINEMATIC_STUDIO_APP_SLUG
  } as const
}
