const TELEMETRY_SAFE_ROUTE_GROUPS = new Set([
  'assets',
  'billing',
  'customers',
  'default_workflow',
  'embeddings',
  'experiment',
  'extensions',
  'features',
  'files',
  'folder_paths',
  'free',
  'global_subgraphs',
  'history',
  'hub',
  'internal',
  'interrupt',
  'jobs',
  'logs',
  'models',
  'node_replacements',
  'object_info',
  'prompt',
  'providers',
  'queue',
  'secrets',
  'settings',
  'system_stats',
  'upload',
  'user',
  'userdata',
  'users',
  'video_metadata',
  'view',
  'view_metadata',
  'workflow_templates',
  'workflows',
  'workspace',
  'workspaces'
])

/** A route reduced to its allowlisted group, safe to send to telemetry. */
export function getFetchRouteTemplate(route: string): string {
  const segments = (route.split(/[?#]/)[0] ?? '').split('/').filter(Boolean)
  const routeSegments = segments[0] === 'api' ? segments.slice(1) : segments
  const [routeGroup, ...resources] = routeSegments

  if (!routeGroup || !TELEMETRY_SAFE_ROUTE_GROUPS.has(routeGroup))
    return '/other'
  return `/${routeGroup}${resources.length ? '/:resource' : ''}`
}
