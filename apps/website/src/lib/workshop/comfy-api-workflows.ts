/**
 * Workflows that run on a deployment of their own rather than the shared
 * Cloud endpoint. Every other workflow runs the same way, so marking them all
 * would mark nothing: only the few that run somewhere else say so.
 */
const OWN_DEPLOYMENT: ReadonlySet<string> = new Set([
  'workflows/remove-object-from-video'
])

export function runsOnComfyApi(slug: string): boolean {
  return OWN_DEPLOYMENT.has(slug)
}
