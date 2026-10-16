<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Eye } from '@lucide/vue'
import { translationsFor } from '@/i18n/translations'
import type {
  CatalogPreviewCommand,
  CatalogPreviewLocale
} from '@/lib/cms/preview-client'
import {
  previewNavigationPath,
  updateCatalogPreview
} from '@/lib/cms/preview-client'
import type {
  CatalogPreviewChange,
  CatalogScheduledPage
} from '@/lib/cms/preview-display'
import CatalogPreviewBar from './CatalogPreviewBar.vue'
import { markDraftCards } from '@/lib/cms/draft-card-marks'

// Mounted only by a freshly authorized staff route. This controller cannot
// establish a session; every command is reauthorized by the server.
const {
  csrf,
  view,
  now,
  locale = 'en',
  currentPath,
  changes,
  launches = [],
  showEntry = true
} = defineProps<{
  csrf: string
  view: 'DRAFT' | 'LIVE'
  now?: string
  locale?: CatalogPreviewLocale
  currentPath: string
  changes?: CatalogPreviewChange[]
  launches?: CatalogScheduledPage[]
  showEntry?: boolean
}>()

const t = computed(() => translationsFor(locale).t)
const active = computed(() => view === 'DRAFT' || Boolean(now))
const busy = ref(false)
const ready = ref(false)
onMounted(() => {
  ready.value = true
})
let clearMarks: (() => void) | undefined
watch([ready, () => view, () => changes, () => locale], () => {
  clearMarks?.()
  clearMarks =
    ready.value && view === 'DRAFT'
      ? markDraftCards(document.body, changes ?? [], (state) =>
          t.value(`cccDraftCards.${state}`)
        )
      : undefined
})
onBeforeUnmount(() => clearMarks?.())
const unavailable = computed(() => busy.value || !ready.value)
const failed = ref(false)
async function change(command: CatalogPreviewCommand) {
  if (unavailable.value) return
  const target = previewNavigationPath(currentPath, command.locale)
  if (!target) {
    failed.value = true
    return
  }
  busy.value = true
  failed.value = false
  const committed = await updateCatalogPreview(command, csrf)
  if (!committed) {
    busy.value = false
    failed.value = true
    return
  }
  // Keep controls disabled until the fresh server-rendered page replaces this
  // one. Never show pending locale/view state as successfully committed.
  window.location.assign(target)
}
function language(selected: string) {
  if (selected === 'en' || selected === 'zh-CN')
    void change({ view, locale: selected })
}
function navigate(path: string) {
  if (unavailable.value) return
  const target = previewNavigationPath(path)
  if (target) window.location.assign(target)
}
</script>
<template>
  <CatalogPreviewBar
    :active
    :view
    :now
    :locale
    :changes
    :launches
    :busy="unavailable"
    :error="failed ? t('cccPreview.updateFailed') : undefined"
    @view="change({ view: $event })"
    @timewarp="change({ view, now: $event ?? 'now' })"
    @locale="language"
    @exit="change({ view: 'LIVE', now: 'now' })"
    @navigate="navigate"
  />
  <div
    v-if="!active && showEntry"
    class="fixed right-4 bottom-4 z-40 flex max-w-sm flex-wrap justify-end gap-2"
  >
    <button
      type="button"
      :disabled="unavailable"
      class="inline-flex items-center rounded-full border border-admin-line bg-admin-card px-4 py-2 font-admin text-sm text-admin-fg shadow-lg focus-visible:outline-2 focus-visible:outline-primary-comfy-yellow disabled:opacity-40"
      @click="navigate('/admin/catalog')"
    >
      {{ t('cccPreview.admin') }}
    </button>
    <button
      type="button"
      :disabled="unavailable"
      class="inline-flex items-center gap-2 rounded-full border border-admin-line bg-admin-card px-4 py-2 font-admin text-sm text-admin-fg shadow-lg focus-visible:outline-2 focus-visible:outline-primary-comfy-yellow disabled:opacity-40"
      @click="change({ view: 'DRAFT' })"
    >
      <Eye class="size-4" aria-hidden="true" />
      {{ t('cccPreview.enter') }}
    </button>
    <p
      v-if="failed"
      role="alert"
      class="w-full rounded-lg bg-admin-card p-3 font-admin text-sm text-admin-fg"
    >
      {{ t('cccPreview.updateFailed') }}
    </p>
  </div>
</template>
