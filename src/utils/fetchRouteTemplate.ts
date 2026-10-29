/**
 * Route groups whose name is safe to send to telemetry. Anything after the
 * group, and any group not listed, is collapsed so user-chosen names (files,
 * workflows, folders) and ids never leave the client.
 */
const FETCH_ROUTE_GROUPS = new Set([
  'assets',
  'billing',
  'customers',
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

export function getFetchRouteTemplate(route: string): string {
  const segments = (route.split(/[?#]/)[0] ?? '').split('/').filter(Boolean)
  const routeSegments = segments[0] === 'api' ? segments.slice(1) : segments
  const [routeGroup, ...resources] = routeSegments

  if (!routeGroup || !FETCH_ROUTE_GROUPS.has(routeGroup)) return '/other'
  return `/${routeGroup}${resources.length ? '/:resource' : ''}`
}
