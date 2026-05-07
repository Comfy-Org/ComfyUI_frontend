<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type {
  RemoteComboConfig,
  RemoteItemSchema
} from '@/schemas/nodeDefSchema'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@comfyorg/tailwind-utils'

import FormDropdown from './form/dropdown/FormDropdown.vue'
import type { FormDropdownItem, LayoutMode } from './form/dropdown/types'
import { AssetKindKey } from './form/dropdown/types'
import {
  buildSearchText,
  extractItems,
  getByPath,
  mapToDropdownItem
} from '../utils/itemSchemaUtils'
import { fetchRemoteRoute } from '../utils/fetchRemoteRoute'
import {
  buildCacheKey,
  getBackoff,
  isRetriableError,
  summarizeError,
  summarizePayload
} from '../utils/richComboHelpers'

const DEFAULT_MAX_RETRIES = 5
const DEFAULT_TIMEOUT = 30000

// --- Persistent cache using browser Cache API (survives page reloads) ---
const CACHE_NAME = 'comfy-remote-widget'

// Mirrors useAuthStore().getAuthHeader()'s priority chain so the cache is
// partitioned by the *active* auth context, not just the firebase user.
// Same firebase user across two workspaces, or across workspace ↔ personal,
// would otherwise share a cache and bleed data.
//
// Returns an opaque, non-secret identifier. The API-key branch deliberately
// returns a constant rather than the key value or a hash of it: hashing is
// async (SubtleCrypto), and grouping all keys on one machine under a single
// scope is an acceptable tradeoff for the rare key-rotation case.
function getAuthScope(): string {
  const { flags } = useFeatureFlags()
  if (flags.teamWorkspacesEnabled) {
    const wsId = useWorkspaceAuthStore().currentWorkspace?.id
    if (wsId) return `ws:${wsId}`
  }
  const uid = useAuthStore().userId
  if (uid) return `fb:${uid}`
  return useApiKeyAuthStore().getApiKey() ? 'apikey' : 'anon'
}

function cacheKeyFor(config: RemoteComboConfig): string {
  return buildCacheKey(config, getAuthScope())
}

async function getCached(config: RemoteComboConfig): Promise<unknown[] | null> {
  try {
    const cache = await caches.open(CACHE_NAME)
    const resp = await cache.match(cacheKeyFor(config))
    if (!resp) return null
    const entry = await resp.json()
    const ttl = config.refresh
    if (!ttl || ttl <= 0) return entry.data
    if (Date.now() - entry.timestamp < ttl) return entry.data
    return null
  } catch {
    return null
  }
}

async function clearCache(config: RemoteComboConfig) {
  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.delete(cacheKeyFor(config))
  } catch {
    // ignore
  }
}

async function setCache(config: RemoteComboConfig, data: unknown[]) {
  try {
    const cache = await caches.open(CACHE_NAME)
    const body = JSON.stringify({ data, timestamp: Date.now() })
    await cache.put(cacheKeyFor(config), new Response(body))
  } catch {
    // Cache API unavailable — widget still works, just no persistence
  }
}

const { widget } = defineProps<{
  widget: SimplifiedWidget<string | undefined>
}>()

const modelValue = defineModel<string>()

const { t } = useI18n()

const comboSpec = computed(() => {
  if (widget.spec && isComboInputSpec(widget.spec)) {
    return widget.spec
  }
  return undefined
})
const remoteConfig = computed<RemoteComboConfig | undefined>(
  () => comboSpec.value?.remote_combo
)
const itemSchema = computed<RemoteItemSchema | undefined>(
  () => remoteConfig.value?.item_schema
)

// --- Fetch state ---
const rawItems = ref<unknown[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
let abortController: AbortController | undefined

// --- Auto-select policy ---
// Only sets modelValue when it's empty; never overrides an existing value
// (valid or stale) — user intent and workflow portability are preserved.
function applyAutoSelect(config: RemoteComboConfig) {
  if (modelValue.value) return

  const list = items.value
  if (list.length === 0) return

  if (config.auto_select === 'first') {
    modelValue.value = list[0].id
  } else if (config.auto_select === 'last') {
    modelValue.value = list[list.length - 1].id
  }
}

async function fetchAll(config: RemoteComboConfig) {
  const controller = abortController!
  const maxRetries = config.max_retries ?? DEFAULT_MAX_RETRIES
  loading.value = true
  error.value = null

  let attempts = 0
  while (!controller.signal.aborted) {
    try {
      const res = await fetchRemoteRoute(config.route, {
        timeout: config.timeout ?? DEFAULT_TIMEOUT,
        signal: controller.signal
      })
      if (controller.signal.aborted) return
      const fetchedItems = extractItems(res.data, config.response_key)
      if (fetchedItems === null) {
        console.error('RichComboWidget: expected array response', {
          route: config.route,
          responseKey: config.response_key,
          received: summarizePayload(res.data)
        })
        error.value = t('widgets.remoteCombo.loadFailed')
        break
      }
      await setCache(config, fetchedItems)
      if (controller.signal.aborted) return
      rawItems.value = fetchedItems
      applyAutoSelect(config)
      break
    } catch (err: unknown) {
      if (controller.signal.aborted) return
      console.error('RichComboWidget: fetch error', {
        route: config.route,
        error: summarizeError(err)
      })
      if (!isRetriableError(err)) {
        error.value = t('widgets.remoteCombo.loadFailed')
        break
      }
      attempts++
      if (attempts >= maxRetries) {
        error.value = t('widgets.remoteCombo.loadFailed')
        break
      }
      const delay = getBackoff(attempts)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  if (!controller.signal.aborted) {
    loading.value = false
  }
}

async function fetchItems(bypassCache = false) {
  const config = remoteConfig.value
  if (!config) return

  // Claim the active controller before any async work so the cache-hit
  // path can bail out if a later fetchItems supersedes us.
  abortController?.abort()
  const myController = new AbortController()
  abortController = myController

  // Check cache first (unless manual refresh)
  if (!bypassCache) {
    const cached = await getCached(config)
    if (myController.signal.aborted) return
    if (cached) {
      rawItems.value = cached
      applyAutoSelect(config)
      return
    }
  }

  // Reset items for fresh fetch
  rawItems.value = []
  await fetchAll(config)
}

onMounted(() => {
  void fetchItems()
})

onUnmounted(() => {
  abortController?.abort()
})

// --- Preview type ---
const assetKind = computed(() => itemSchema.value?.preview_type ?? 'image')

provide(AssetKindKey, assetKind)

// --- Item mapping ---
const items = computed<FormDropdownItem[]>(() => {
  const schema = itemSchema.value
  if (schema) {
    return rawItems.value.map((raw) => mapToDropdownItem(raw, schema))
  }
  return rawItems.value.map((raw) => {
    const val = String(raw ?? '')
    return { id: val, name: val }
  })
})

// --- Search ---
const searchIndex = computed(() => {
  const schema = itemSchema.value
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

const layoutMode = ref<LayoutMode>('list')
const selectedSet = ref<Set<string>>(new Set())

async function searcher(query: string, searchItems: FormDropdownItem[]) {
  if (!query.trim()) return searchItems
  const q = query.toLowerCase()
  return searchItems.filter((item) => {
    const text = searchIndex.value.get(item.id) ?? item.name.toLowerCase()
    return text.includes(q)
  })
}

// --- Selection sync ---
watch(
  [modelValue, items],
  ([val]) => {
    selectedSet.value.clear()
    if (val) {
      const item = items.value.find((i) => i.id === val)
      if (item) selectedSet.value.add(item.id)
    }
  },
  { immediate: true }
)

function handleRefresh() {
  abortController?.abort()
  error.value = null
  const config = remoteConfig.value
  // Sequence the cache delete before the refetch: otherwise the (very fast)
  // setCache from a quickly-resolved network response can land the new entry
  // before the still-pending cache.delete removes it, silently dropping the
  // freshly-cached data on the next mount.
  void (async () => {
    if (config) await clearCache(config)
    await fetchItems(true)
  })()
}

function handleSelection(selected: Set<string>) {
  modelValue.value = selected.values().next().value
}

const placeholder = computed(() => {
  if (loading.value) return t('widgets.remoteCombo.loading')
  if (error.value) return error.value
  return t('widgets.uploadSelect.placeholder')
})
</script>

<template>
  <div
    class="flex w-full min-w-0 items-center gap-1 rounded-lg focus-within:ring focus-within:ring-component-node-widget-background-highlighted"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <FormDropdown
      v-model:selected="selectedSet"
      v-model:layout-mode="layoutMode"
      :items="items"
      :placeholder="placeholder"
      :multiple="false"
      :show-sort="false"
      :show-layout-switcher="false"
      :searcher="searcher"
      class="min-w-0 flex-1"
      @update:selected="handleSelection"
    />
    <button
      v-if="remoteConfig?.refresh_button !== false"
      type="button"
      :aria-label="t('g.refresh')"
      :title="t('g.refresh')"
      class="text-secondary flex size-7 shrink-0 items-center justify-center rounded-sm hover:bg-component-node-widget-background-hovered"
      @click.stop="handleRefresh"
    >
      <i
        :class="
          cn('icon-[lucide--refresh-cw] size-3.5', loading && 'animate-spin')
        "
      />
    </button>
  </div>
</template>
