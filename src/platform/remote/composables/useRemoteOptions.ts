import { useQuery, useQueryClient } from '@tanstack/vue-query'
import axios from 'axios'
import { computed, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'

import { isRetriableError } from '@/base/remote/retry'
import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { remoteOptionKeys } from '@/platform/remote/queryKeys'
import type {
  RemoteAuthScope,
  RemoteRequestDescriptor
} from '@/platform/remote/schema/remoteRequestSchema'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { useAuthStore } from '@/stores/authStore'

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 3

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
  const authStore = useAuthStore()
  const authHeader = await authStore.getAuthHeader()
  const headers = authHeader ? { ...authHeader } : undefined
  const url = resolveUrl(descriptor, getComfyApiBaseUrl())
  const response = await axios.get(url, {
    params: descriptor.params,
    timeout: descriptor.timeout ?? DEFAULT_TIMEOUT_MS,
    signal,
    ...(headers ? { headers } : {})
  })
  return response.data
}

interface UseRemoteOptionsResult<T> {
  data: ComputedRef<T | undefined>
  rawData: ComputedRef<unknown>
  isLoading: ComputedRef<boolean>
  isFetching: ComputedRef<boolean>
  error: ComputedRef<Error | null>
  refetch: () => Promise<unknown>
  invalidate: () => Promise<void>
}

interface UseRemoteOptionsArgs<T> {
  descriptor: MaybeRefOrGetter<RemoteRequestDescriptor | null | undefined>
  enabled?: MaybeRefOrGetter<boolean>
  select?: (raw: unknown) => T
}

export function useRemoteOptions<T = unknown>(
  args: UseRemoteOptionsArgs<T>
): UseRemoteOptionsResult<T> {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const workspaceStore = useWorkspaceAuthStore()

  const scope = computed<RemoteAuthScope>(() => ({
    userId: authStore.userId ?? null,
    workspaceId: workspaceStore.currentWorkspace?.id ?? null
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
        throw new Error('useRemoteOptions: descriptor is required')
      }
      return executeRemoteRequest(descriptor, signal)
    },
    retry: (failureCount, error) => {
      const descriptor = toValue(args.descriptor)
      const max = descriptor?.maxRetries ?? DEFAULT_MAX_RETRIES
      return failureCount < max && isRetriableError(error)
    },
    staleTime: computed(() => toValue(args.descriptor)?.ttl ?? 0)
  })

  const data = computed<T | undefined>(() => {
    const raw = query.data.value
    if (raw === undefined) return undefined
    if (args.select) return args.select(raw)
    return raw as T
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKey.value })
  }

  return {
    data,
    rawData: computed(() => query.data.value),
    isLoading: computed(() => query.isLoading.value),
    isFetching: computed(() => query.isFetching.value),
    error: computed(() => query.error.value),
    refetch: async () => {
      await query.refetch()
    },
    invalidate
  }
}
