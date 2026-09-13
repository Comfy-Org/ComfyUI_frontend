import { useQuery, useQueryClient } from '@tanstack/vue-query'
import axios from 'axios'
import { computed, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'

import { isRetriableError } from '@/base/remote/retry'
import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { remoteOptionKeys } from '@/platform/remote/queryKeys'
import {
  DEFAULT_REMOTE_MAX_RETRIES,
  DEFAULT_REMOTE_TIMEOUT_MS
} from '@/platform/remote/schema/remoteRequestSchema'
import type {
  RemoteAuthScope,
  RemoteRequestDescriptor
} from '@/platform/remote/schema/remoteRequestSchema'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

function resolveUrl(
  descriptor: RemoteRequestDescriptor,
  baseUrl: string
): string {
  if (descriptor.client === 'comfyApi') {
    return baseUrl + descriptor.route
  }
  return descriptor.route
}

async function executeRemoteRequest(
  descriptor: RemoteRequestDescriptor,
  signal: AbortSignal
): Promise<unknown> {
  let headers: Record<string, string> | undefined
  if (descriptor.client === 'comfyApi') {
    const authStore = useAuthStore()
    const authHeader = await authStore.getAuthHeader()
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    headers = authHeader ? { ...authHeader } : undefined
  }
  const url = resolveUrl(descriptor, getComfyApiBaseUrl())
  const response = await axios.get(url, {
    params: descriptor.params,
    timeout: descriptor.timeout ?? DEFAULT_REMOTE_TIMEOUT_MS,
    signal,
    ...(headers ? { headers } : {})
  })
  return response.data
}

interface UseRemoteOptionsResult {
  rawData: ComputedRef<unknown>
  isLoading: ComputedRef<boolean>
  isFetching: ComputedRef<boolean>
  error: ComputedRef<Error | null>
  refetch: () => Promise<unknown>
  invalidate: () => Promise<void>
}

interface UseRemoteOptionsArgs {
  descriptor: MaybeRefOrGetter<RemoteRequestDescriptor | null | undefined>
  enabled?: MaybeRefOrGetter<boolean>
}

export function useRemoteOptions(
  args: UseRemoteOptionsArgs
): UseRemoteOptionsResult {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const workspaceStore = useWorkspaceAuthStore()
  const apiKeyStore = useApiKeyAuthStore()

  const scope = computed<RemoteAuthScope>(() => ({
    userId: authStore.userId ?? null,
    workspaceId: workspaceStore.currentWorkspace?.id ?? null,
    apiKeyBucket: apiKeyStore.getApiKey() ? 'apikey' : 'anon',
    apiKeySessionId: apiKeyStore.apiKeySessionId
  }))

  const queryKey = computed(() => {
    const descriptor = toValue(args.descriptor)
    if (!descriptor) {
      return [...remoteOptionKeys.all(), 'disabled'] as const
    }
    return remoteOptionKeys.byRoute(descriptor, scope.value)
  })

  const enabled = computed(() => {
    const userEnabled = toValue(args.enabled)
    const hasDescriptor = !!toValue(args.descriptor)
    return hasDescriptor && (userEnabled === undefined || userEnabled)
  })

  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async ({ signal }) => {
      const descriptor = toValue(args.descriptor)
      if (!descriptor) {
        // Guards against a race between `enabled` (derived from `hasDescriptor`)
        // and TanStack Query invoking a stale queryFn.
        throw new TypeError('useRemoteOptions: descriptor is required')
      }
      return executeRemoteRequest(descriptor, signal)
    },
    retry: (failureCount, error) => {
      const descriptor = toValue(args.descriptor)
      const max = descriptor?.maxRetries ?? DEFAULT_REMOTE_MAX_RETRIES
      return failureCount < max && isRetriableError(error)
    },
    staleTime: computed(() => toValue(args.descriptor)?.ttl ?? 0)
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKey.value })
  }

  return {
    rawData: computed(() => query.data.value),
    isLoading: computed(() => query.isLoading.value),
    isFetching: computed(() => query.isFetching.value),
    error: computed(() => query.error.value),
    refetch: () => query.refetch(),
    invalidate
  }
}
