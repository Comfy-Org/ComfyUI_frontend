import axios from 'axios'

import { isRetriableError } from '@/base/remote/retry'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { IWidget, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isCloud } from '@/platform/distribution/types'
import { getAppQueryClient } from '@/platform/remote/queryClient'
import { remoteOptionKeys } from '@/platform/remote/queryKeys'
import type { RemoteRequestDescriptor } from '@/platform/remote/schema/remoteRequestSchema'
import type { RemoteWidgetConfig } from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

const MAX_RETRIES = 5
const TIMEOUT = 4096

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
  signal: AbortSignal
): Promise<unknown> {
  const authHeaders = await getAuthHeaders()
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

export function useRemoteWidget<
  T extends string | number | boolean | object
>(options: {
  remoteConfig: RemoteWidgetConfig
  defaultValue: T
  node: LGraphNode
  widget: IWidget
}) {
  const { remoteConfig, defaultValue, node, widget } = options
  const descriptor = createDescriptor(remoteConfig)
  const queryClient = getAppQueryClient()
  const getQueryKey = () =>
    remoteOptionKeys.byRoute(descriptor, {
      userId: useAuthStore().userId ?? null,
      workspaceId: null,
      apiKeyBucket: useApiKeyAuthStore().getApiKey() ? 'apikey' : 'anon',
      apiKeySessionId: useApiKeyAuthStore().apiKeySessionId
    })

  let isLoaded = false
  let refreshQueued = false

  const fetchValue = async (): Promise<T> => {
    const queryKey = getQueryKey()
    try {
      const data = await queryClient.fetchQuery({
        queryKey,
        queryFn: ({ signal }) => fetchRemoteWidgetData(descriptor, signal),
        staleTime: remoteConfig.refresh,
        retry: (failureCount, error) =>
          failureCount < (remoteConfig.max_retries ?? MAX_RETRIES) &&
          isRetriableError(error)
      })
      return (data ?? defaultValue) as T
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.warn('Remote widget fetch failed:', message)
      return queryClient.getQueryData<T>(queryKey) ?? defaultValue
    }
  }

  const onFirstLoad = (data: T | T[]) => {
    isLoaded = true
    const nextValue =
      Array.isArray(data) && data.length > 0 ? data[0] : undefined
    widget.value = nextValue ?? (Array.isArray(data) ? defaultValue : data)
    widget.callback?.(widget.value)
    node.graph?.setDirtyCanvas(true)
  }

  const onRefresh = (data: T) => {
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

  function getCachedValue(): T {
    return queryClient.getQueryData<T>(getQueryKey()) ?? defaultValue
  }

  function getValue(onFulfilled?: () => void) {
    void fetchValue()
      .then((data) => {
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
    return getCachedValue() ?? defaultValue
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
