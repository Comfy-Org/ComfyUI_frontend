import axios from 'axios'

import { isRetriableError } from '@/base/remote/retry'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { IWidget, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isCloud } from '@/platform/distribution/types'
import { getAppQueryClient } from '@/platform/remote/queryClient'
import { remoteOptionKeys } from '@/platform/remote/queryKeys'
import type {
  RemoteAuthScope,
  RemoteRequestDescriptor
} from '@/platform/remote/schema/remoteRequestSchema'
import type { RemoteWidgetConfig } from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

const MAX_RETRIES = 5
const TIMEOUT = 4096
type RemoteWidgetValue = string | number
type RemoteWidgetData = RemoteWidgetValue | RemoteWidgetValue[]

function isRemoteWidgetValue(value: unknown): value is RemoteWidgetValue {
  return typeof value === 'string' || typeof value === 'number'
}

function isRemoteWidgetData(value: unknown): value is RemoteWidgetData {
  return (
    isRemoteWidgetValue(value) ||
    (Array.isArray(value) && value.every(isRemoteWidgetValue))
  )
}

async function getAuthHeaders() {
  if (isCloud) {
    const authStore = useAuthStore()
    const authHeader = await authStore.getAuthHeader()
    return {
      ...(authHeader && { headers: authHeader })
    }
  }
  return {}
}

const createDescriptor = (
  config: RemoteWidgetConfig
): RemoteRequestDescriptor => ({
  client: 'comfyApi',
  route: config.route,
  params: config.query_params,
  responseKey: config.response_key,
  ttl: config.refresh,
  timeout: config.timeout ?? TIMEOUT,
  maxRetries: config.max_retries ?? MAX_RETRIES
})

async function fetchRemoteWidgetData(
  descriptor: RemoteRequestDescriptor,
  signal: AbortSignal,
  authHeaders: Awaited<ReturnType<typeof getAuthHeaders>>
): Promise<unknown> {
  const res = await axios.get(descriptor.route, {
    params: descriptor.params,
    signal,
    timeout: descriptor.timeout,
    ...authHeaders
  })
  return descriptor.responseKey
    ? (res.data as Record<string, unknown>)[descriptor.responseKey]
    : res.data
}

export function useRemoteWidget(options: {
  remoteConfig: RemoteWidgetConfig
  defaultValue: RemoteWidgetData
  node: LGraphNode
  widget: IWidget
}) {
  const { remoteConfig, defaultValue, node, widget } = options
  const descriptor = createDescriptor(remoteConfig)
  const queryClient = getAppQueryClient()
  const getAuthScope = (): RemoteAuthScope => ({
    userId: useAuthStore().userId ?? null,
    workspaceId: null,
    apiKeyBucket: useApiKeyAuthStore().getApiKey() ? 'apikey' : 'anon',
    apiKeySessionId: useApiKeyAuthStore().apiKeySessionId
  })
  const scopesMatch = (left: RemoteAuthScope, right: RemoteAuthScope) =>
    left.userId === right.userId &&
    left.workspaceId === right.workspaceId &&
    left.apiKeyBucket === right.apiKeyBucket &&
    left.apiKeySessionId === right.apiKeySessionId
  const createQueryKey = (scope: RemoteAuthScope) =>
    remoteOptionKeys.byRoute(descriptor, scope)
  const getQueryKey = () => createQueryKey(getAuthScope())

  let isLoaded = false
  let refreshQueued = false

  const fetchValue = async (): Promise<{
    data: RemoteWidgetData
    scope: RemoteAuthScope
  }> => {
    const scope = getAuthScope()
    const queryKey = createQueryKey(scope)
    const fallback = () =>
      queryClient.getQueryData<RemoteWidgetData>(queryKey) ?? defaultValue
    try {
      const authHeaders = await getAuthHeaders()
      if (!scopesMatch(scope, getAuthScope())) {
        return { data: fallback(), scope }
      }
      const data = await queryClient.fetchQuery({
        queryKey,
        queryFn: async ({ signal }) => {
          const data = await fetchRemoteWidgetData(
            descriptor,
            signal,
            authHeaders
          )
          return isRemoteWidgetData(data) ? data : fallback()
        },
        staleTime: remoteConfig.refresh,
        retry: (failureCount, error) =>
          failureCount < (remoteConfig.max_retries ?? MAX_RETRIES) &&
          isRetriableError(error)
      })
      return { data, scope }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.warn('Remote widget fetch failed:', message)
      return { data: fallback(), scope }
    }
  }

  const onFirstLoad = (data: RemoteWidgetData) => {
    isLoaded = true
    const nextValue =
      Array.isArray(data) && data.length > 0 ? data[0] : undefined
    widget.value = nextValue ?? (Array.isArray(data) ? defaultValue : data)
    widget.callback?.(widget.value)
    node.graph?.setDirtyCanvas(true)
  }

  const onRefresh = (data: RemoteWidgetData) => {
    if (!remoteConfig.control_after_refresh) return
    if (!Array.isArray(data)) return

    switch (remoteConfig.control_after_refresh) {
      case 'first':
        widget.value = data[0] ?? defaultValue
        break
      case 'last':
        widget.value = data.at(-1) ?? defaultValue
        break
    }
    widget.callback?.(widget.value)
    node.graph?.setDirtyCanvas(true)
  }

  function getCachedValue(): RemoteWidgetData {
    return (
      queryClient.getQueryData<RemoteWidgetData>(getQueryKey()) ?? defaultValue
    )
  }

  function getValue(onFulfilled?: () => void) {
    void fetchValue()
      .then(async ({ data, scope }) => {
        if (!scopesMatch(scope, getAuthScope())) {
          await queryClient.cancelQueries({ queryKey: createQueryKey(scope) })
          onFulfilled?.()
          return
        }
        if (!isLoaded) onFirstLoad(data)
        if (refreshQueued && data !== defaultValue) {
          onRefresh(data)
          refreshQueued = false
        }
        onFulfilled?.()
      })
      .catch((err) => {
        console.error(err)
      })
    return getCachedValue()
  }

  widget.refresh = function () {
    refreshQueued = true
    void queryClient.invalidateQueries({ queryKey: getQueryKey() }).then(() => {
      getValue()
    })
  }

  function addRefreshButton() {
    node.addWidget('button', 'refresh', 'refresh', widget.refresh)
  }

  function addAutoRefreshToggle() {
    let autoRefreshEnabled = false

    const handleExecutionSuccess = () => {
      if (autoRefreshEnabled && widget.refresh) {
        widget.refresh()
      }
    }

    const autoRefreshWidget = node.addWidget(
      'toggle',
      'Auto-refresh after generation',
      false,
      (value: boolean) => {
        autoRefreshEnabled = value
      },
      {
        serialize: false
      }
    )

    api.addEventListener('execution_success', handleExecutionSuccess)

    node.onRemoved = useChainCallback(node.onRemoved, function () {
      api.removeEventListener('execution_success', handleExecutionSuccess)
    })

    return autoRefreshWidget
  }

  addAutoRefreshToggle()

  return {
    getCachedValue,
    getValue,
    refreshValue: widget.refresh,
    addRefreshButton,
    getQueryKey
  }
}
