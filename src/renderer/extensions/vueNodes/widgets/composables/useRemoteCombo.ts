import { computed, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  buildSearchText,
  extractItems,
  getByPath,
  mapToDropdownItem
} from '@/base/remote/itemSchema'
import type { DropdownItemShape } from '@/base/remote/itemSchema'
import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { useRemoteOptions } from '@/platform/remote/composables/useRemoteOptions'
import type { RemoteRequestDescriptor } from '@/platform/remote/schema/remoteRequestSchema'
import type { RemoteComboConfig } from '@/schemas/nodeDefSchema'

import type { RemoteComboPreviewType } from '../components/RemoteCombo/state'

interface UseRemoteComboArgs {
  config: MaybeRefOrGetter<RemoteComboConfig | undefined | null>
  modelValue: Ref<string | undefined>
  fieldLabel?: MaybeRefOrGetter<string>
  enabled?: MaybeRefOrGetter<boolean>
}

export function useRemoteCombo(args: UseRemoteComboArgs) {
  const { t } = useI18n()
  const isOpen = ref(false)
  const searchQuery = ref('')

  const descriptor = computed<RemoteRequestDescriptor | null>(() => {
    const config = toValue(args.config)
    if (!config) return null
    return {
      client: 'comfyApi',
      route: config.route,
      responseKey: config.response_key,
      ttl: config.refresh,
      timeout: config.timeout,
      maxRetries: config.max_retries
    }
  })

  const { rawData, isLoading, isFetching, error, refetch } = useRemoteOptions({
    descriptor,
    enabled: args.enabled
  })

  const rawItems = computed<unknown[]>(() => {
    const data = rawData.value
    const config = toValue(args.config)
    if (data === undefined) return []
    const items = extractItems(data, config?.response_key)
    return items ?? []
  })

  const items = computed<DropdownItemShape[]>(() => {
    const config = toValue(args.config)
    const schema = config?.item_schema
    if (schema) {
      const previewBaseUrl = getComfyApiBaseUrl()
      return rawItems.value.map((raw) =>
        mapToDropdownItem(raw, schema, { previewBaseUrl })
      )
    }
    return rawItems.value.map((raw) => {
      const val = String(raw ?? '')
      return { id: val, name: val }
    })
  })

  const searchIndex = computed(() => {
    const config = toValue(args.config)
    const schema = config?.item_schema
    const fields = schema?.search_fields
    if (!schema || !fields?.length) return new Map<string, string>()
    const index = new Map<string, string>()
    for (const raw of rawItems.value) {
      const id = String(getByPath(raw, schema.value_field) ?? '')
      const text = buildSearchText(raw, fields)
      if (text) index.set(id, text)
    }
    return index
  })

  const filteredItems = computed<DropdownItemShape[]>(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return items.value
    return items.value.filter((item) => {
      const text = searchIndex.value.get(item.id) ?? item.name.toLowerCase()
      return text.includes(q)
    })
  })

  const errorMessage = computed<string | null>(() => {
    if (!error.value) return null
    return t('widgets.remoteCombo.loadFailed')
  })

  const fieldLabel = computed(() => toValue(args.fieldLabel) ?? '')
  const previewType = computed<RemoteComboPreviewType>(
    () => toValue(args.config)?.item_schema?.preview_type ?? 'image'
  )

  function applyAutoSelect(config: RemoteComboConfig) {
    if (args.modelValue.value) return
    const list = items.value
    if (list.length === 0) return
    if (config.auto_select === 'first') {
      args.modelValue.value = list[0].id
    } else if (config.auto_select === 'last') {
      args.modelValue.value = list[list.length - 1].id
    }
  }

  watch(
    items,
    () => {
      const config = toValue(args.config)
      if (config) applyAutoSelect(config)
    },
    { immediate: true }
  )

  async function refresh() {
    await refetch()
  }

  function select(id: string) {
    args.modelValue.value = id
    isOpen.value = false
  }

  return {
    isOpen,
    searchQuery,
    items,
    filteredItems,
    isLoading,
    isFetching,
    errorMessage,
    refresh,
    select,
    selectedValue: args.modelValue,
    fieldLabel,
    previewType
  }
}
