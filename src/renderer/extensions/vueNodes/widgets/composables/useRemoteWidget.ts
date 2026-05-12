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
      workspaceId: null
    })

  let isLoaded = false
  let refreshQueued = false
  let cachedValue: T | undefined

  const fetchValue = async (): Promise<T> => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: getQueryKey(),
        queryFn: ({ signal }) => fetchRemoteWidgetData(descriptor, signal),
        staleTime: remoteConfig.refresh,
        retry: (failureCount, error) =>
          failureCount < (remoteConfig.max_retries ?? MAX_RETRIES) &&
          isRetriableError(error)
      })
      cachedValue = (data ?? defaultValue) as T
      return cachedValue
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.warn('Remote widget fetch failed:', message)
      cachedValue = (cachedValue ?? defaultValue) as T
      return cachedValue
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

  const onRefresh = () => {
    if (!remoteConfig.control_after_refresh) return
    const data = cachedValue
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
    if (cachedValue !== undefined) return cachedValue
    const fromQuery = queryClient.getQueryData<T>(getQueryKey())
    if (fromQuery !== undefined) {
      cachedValue = fromQuery
      return fromQuery
    }
    return defaultValue
  }

  function getValue(onFulfilled?: () => void) {
    void fetchValue()
      .then((data) => {
        if (!isLoaded) onFirstLoad(data)
        if (refreshQueued && data !== defaultValue) {
          onRefresh()
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
