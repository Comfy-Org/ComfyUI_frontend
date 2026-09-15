import type {
  RemoteAuthScope,
  RemoteRequestDescriptor
} from '@/platform/remote/schema/remoteRequestSchema'
import {
  DEFAULT_REMOTE_MAX_RETRIES,
  DEFAULT_REMOTE_TIMEOUT_MS
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
      descriptor.timeout ?? DEFAULT_REMOTE_TIMEOUT_MS,
      descriptor.maxRetries ?? DEFAULT_REMOTE_MAX_RETRIES,
      scope.workspaceId ?? null,
      scope.userId ?? null,
      scope.apiKeyBucket ?? null,
      scope.apiKeySessionId ?? null
    ] as const
}
