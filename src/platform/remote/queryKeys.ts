import type {
  RemoteAuthScope,
  RemoteRequestDescriptor
} from '@/platform/remote/schema/remoteRequestSchema'

function sortedParams(
  params?: Record<string, string>
): Array<[string, string]> {
  if (!params) return []
  return Object.entries(params).sort(([a], [b]) => a.localeCompare(b))
}

export const remoteOptionKeys = {
  all: () => ['remote-options'] as const,
  byRoute: (descriptor: RemoteRequestDescriptor, scope: RemoteAuthScope) =>
    [
      ...remoteOptionKeys.all(),
      descriptor.client,
      descriptor.route,
      descriptor.responseKey ?? '',
      sortedParams(descriptor.params),
      scope.workspaceId ?? null,
      scope.userId ?? null,
      scope.apiKeyBucket ?? null
    ] as const
}
