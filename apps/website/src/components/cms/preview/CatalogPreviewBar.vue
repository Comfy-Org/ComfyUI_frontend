<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { Eye, Globe, List, LogOut } from '@lucide/vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type {
  CatalogPreviewChange,
  CatalogScheduledPage
} from '@/lib/cms/preview-display'
import CatalogPreviewTimePicker from './CatalogPreviewTimePicker.vue'
import CatalogPreviewChanges from './CatalogPreviewChanges.vue'

const {
  active,
  view = 'DRAFT',
  now,
  changes,
  launches = [],
  busy = false,
  error,
  locale = 'en',
  languages = [
    { code: 'en', label: 'English' },
    { code: 'zh-CN', label: '中文' }
  ]
} = defineProps<{
  active: boolean
  view?: 'DRAFT' | 'LIVE'
  now?: string
  changes: CatalogPreviewChange[]
  launches?: CatalogScheduledPage[]
  busy?: boolean
  error?: string
  locale?: Locale
  languages?: { code: Locale; label: string }[]
}>()
const emit = defineEmits<{
  view: [view: 'DRAFT' | 'LIVE']
  exit: []
  timewarp: [at: string | undefined]
  locale: [locale: Locale]
  navigate: [route: string]
}>()
const t = computed(() => translationsFor(locale).t)
const visible = computed(() => active && (view === 'DRAFT' || Boolean(now)))
const changesOpen = ref(false)
const bar = useTemplateRef<HTMLElement>('bar')
const control =
  'inline-flex h-8 items-center justify-center gap-2 rounded-full border border-primary-comfy-ink/40 px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary-comfy-ink disabled:opacity-40'
function language(event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return
  const value = event.target.value
  const selected = languages.find((option) => option.code === value)
  if (!busy && selected) emit('locale', selected.code)
  event.target.value = locale
}
function selection(event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return
  const selected = event.target.value
  if (!busy && (selected === 'DRAFT' || selected === 'LIVE'))
    emit('view', selected)
  event.target.value = view
}
let observer: ResizeObserver | undefined
let lastOffset: string | undefined
function clearOffset() {
  observer?.disconnect()
  observer = undefined
  if (
    lastOffset &&
    document.documentElement.style.getPropertyValue('--cms-preview-offset') ===
      lastOffset
  )
    document.documentElement.style.removeProperty('--cms-preview-offset')
  lastOffset = undefined
}
watch(
  bar,
  (element) => {
    clearOffset()
    if (!element) {
      changesOpen.value = false
      return
    }
    const offset = (height: number) => {
      if (!Number.isFinite(height)) return
      lastOffset = `${height}px`
      document.documentElement.style.setProperty(
        '--cms-preview-offset',
        lastOffset
      )
    }
    offset(element.getBoundingClientRect().height)
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(([entry]) => {
        if (entry)
          offset(
            entry.borderBoxSize?.[0]?.blockSize ??
              element.getBoundingClientRect().height
          )
      })
      observer.observe(element)
    }
  },
  { flush: 'post' }
)
onBeforeUnmount(clearOffset)
</script>
<template>
  <div
    v-if="visible"
    ref="bar"
    role="region"
    :aria-label="t('cccPreview.label')"
    class="sticky top-0 z-50 w-full border-b border-primary-comfy-ink/20 bg-primary-comfy-yellow font-admin text-primary-comfy-ink"
  >
    <div class="flex flex-wrap items-center gap-2 px-4 py-2 lg:px-6">
      <p class="mr-auto flex items-center gap-2.5 text-sm">
        <Eye class="size-4" aria-hidden="true" />
        <span class="font-semibold">{{ t('cccPreview.mode') }}</span>
        <span class="hidden text-xs sm:inline">
          <template v-if="view === 'DRAFT'">
            {{
              t(
                'cccPreview.summary',
                { count: changes.length },
                { plural: changes.length }
              )
            }}
          </template>
          <template v-if="now">
            <template v-if="view === 'DRAFT'"> · </template>
            {{ t('cccPreview.timeTravel') }}
          </template>
        </span>
      </p>
      <label :class="control">
        <span class="sr-only">{{ t('cccPreview.view') }}</span>
        <select
          :value="view"
          :disabled="busy"
          class="h-full bg-transparent focus-visible:outline-2 focus-visible:outline-primary-comfy-ink disabled:opacity-40"
          @change="selection"
        >
          <option value="DRAFT" :selected="view === 'DRAFT'">
            {{ t('cccPreview.draft') }}
          </option>
          <option value="LIVE" :selected="view === 'LIVE'">
            {{ t('cccPreview.live') }}
          </option>
        </select>
      </label>
      <CatalogPreviewTimePicker
        :now
        :launches
        :busy
        :locale
        @timewarp="emit('timewarp', $event)"
      />
      <button
        type="button"
        :class="control"
        :disabled="busy"
        @click="emit('timewarp', undefined)"
      >
        {{ t('cccPreview.now') }}
      </button>
      <label
        class="relative flex items-center gap-2 rounded-full border border-primary-comfy-ink/40 pl-3 text-xs"
      >
        <Globe class="size-4" aria-hidden="true" />
        <span class="sr-only">{{ t('cccPreview.language') }}</span>
        <select
          :value="locale"
          :disabled="busy"
          class="h-8 rounded-full bg-transparent pr-3 focus-visible:outline-2 focus-visible:outline-primary-comfy-ink disabled:opacity-40"
          @change="language"
        >
          <option
            v-for="option in languages"
            :key="option.code"
            :value="option.code"
            :selected="option.code === locale"
          >
            {{ option.label }}
          </option>
        </select>
      </label>
      <button type="button" :class="control" @click="changesOpen = true">
        <List class="size-4" aria-hidden="true" />{{ t('cccPreview.changes') }}
      </button>
      <button
        type="button"
        :class="control"
        :disabled="busy"
        @click="emit('navigate', '/admin/catalog')"
      >
        {{ t('cccPreview.admin') }}
      </button>
      <button
        type="button"
        :class="control"
        :disabled="busy"
        @click="emit('exit')"
      >
        <LogOut class="size-4" aria-hidden="true" />{{ t('cccPreview.exit') }}
      </button>
    </div>
    <p v-if="error" role="alert" class="px-4 pb-2 text-sm lg:px-6">
      {{ error }}
    </p>
    <CatalogPreviewChanges
      v-model:open="changesOpen"
      :changes
      :busy
      :locale
      @navigate="emit('navigate', $event)"
    />
  </div>
</template>
