<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { Globe, LayoutDashboard, List, X } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent
} from 'reka-ui'
import { adminButtonVariants } from '@/components/cms/ui/adminButton'
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
  changes?: CatalogPreviewChange[]
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
const draft = computed(() => view === 'DRAFT')
const languageCode = computed(() => (locale === 'zh-CN' ? '中' : 'EN'))
const changesOpen = ref(false)
const languagesOpen = ref(false)
const bar = useTemplateRef<HTMLElement>('bar')
const control = adminButtonVariants({
  class: 'data-[state=open]:bg-admin-hover'
})
function language(code: Locale) {
  if (busy || !languages.some((option) => option.code === code)) return
  if (code !== locale) emit('locale', code)
  languagesOpen.value = false
}
function selection(selected: 'DRAFT' | 'LIVE') {
  if (!busy && selected !== view) emit('view', selected)
}
function openChanges() {
  if (busy) return
  if (changes === undefined) emit('navigate', '/admin/catalog')
  else changesOpen.value = true
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
    :class="
      cn(
        'sticky top-0 z-50 w-full border-t-2 border-b border-b-admin-line bg-admin-chrome font-admin text-admin-fg',
        draft ? 'border-t-admin-info' : 'border-t-admin-success'
      )
    "
  >
    <div
      :class="
        cn(
          'flex flex-wrap items-center gap-2 px-4 py-2.5 lg:px-6',
          draft ? 'bg-admin-info/15' : 'bg-admin-success/5'
        )
      "
    >
      <p class="mr-auto flex items-center gap-2.5 text-sm">
        <span
          :class="
            cn(
              'inline-flex h-7 items-center gap-2 rounded-full border px-3 text-xs font-semibold tracking-[0.04em] uppercase',
              draft
                ? 'border-admin-info/40 bg-admin-info/15 text-admin-info'
                : 'border-admin-success/40 bg-admin-success/15 text-admin-success'
            )
          "
        >
          <span class="relative flex size-2" aria-hidden="true">
            <span
              v-if="draft"
              class="absolute inline-flex size-full animate-ping rounded-full bg-admin-info opacity-60 motion-reduce:hidden"
            />
            <span
              :class="
                cn(
                  'relative inline-flex size-2 rounded-full',
                  draft ? 'bg-admin-info' : 'bg-admin-success'
                )
              "
            />
          </span>
          {{ t(draft ? 'cmsAdmin.preview.mode' : 'cmsAdmin.preview.liveMode') }}
        </span>
        <span class="hidden text-xs text-admin-muted sm:inline">
          <template v-if="view === 'DRAFT' && changes !== undefined">
            {{ t('cccPreview.summary', { count: changes.length }) }}
          </template>
          <template v-if="now">
            <template v-if="view === 'DRAFT' && changes !== undefined">
              ·
            </template>
            {{ t('cccPreview.timeTravel') }}
          </template>
        </span>
      </p>
      <div
        role="group"
        :aria-label="t('cccPreview.view')"
        class="inline-flex gap-1 rounded-lg border border-admin-field p-0.5"
      >
        <button
          v-for="option in ['DRAFT', 'LIVE'] as const"
          :key="option"
          type="button"
          :aria-pressed="view === option"
          :disabled="busy"
          :class="
            cn(
              'inline-flex h-6.5 cursor-pointer items-center rounded-md px-2.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-admin-fg disabled:opacity-40',
              view === option
                ? 'bg-admin-selected'
                : 'text-admin-muted hover:text-admin-fg'
            )
          "
          @click="selection(option)"
        >
          {{ t(option === 'DRAFT' ? 'cccPreview.draft' : 'cccPreview.live') }}
        </button>
      </div>
      <CatalogPreviewTimePicker
        :now
        :launches
        :busy
        :locale
        :trigger-class="control"
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
      <PopoverRoot v-model:open="languagesOpen">
        <PopoverTrigger
          :class="control"
          :disabled="busy"
          :aria-label="t('cccPreview.language')"
        >
          <Globe class="size-3.5" aria-hidden="true" />{{ languageCode }}
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            :side-offset="8"
            class="z-60 grid w-44 gap-0.5 rounded-xl border border-admin-line bg-admin-chrome p-1 font-admin text-admin-fg shadow-admin-popover"
          >
            <button
              v-for="option in languages"
              :key="option.code"
              type="button"
              :lang="option.code"
              :disabled="busy"
              :aria-current="option.code === locale ? 'true' : undefined"
              class="rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-admin-hover focus-visible:outline-2 focus-visible:outline-admin-fg disabled:opacity-40 aria-[current]:bg-admin-line"
              @click="language(option.code)"
            >
              {{ option.label }}
            </button>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>
      <button
        type="button"
        :class="control"
        :disabled="busy"
        @click="openChanges"
      >
        <List class="size-4" aria-hidden="true" />{{ t('cccPreview.changes') }}
      </button>
      <button
        type="button"
        :class="control"
        :disabled="busy"
        @click="emit('navigate', '/admin/catalog')"
      >
        <LayoutDashboard class="size-3.5" aria-hidden="true" />
        {{ t('cccPreview.admin') }}
      </button>
      <button
        type="button"
        :class="adminButtonVariants({ variant: 'primary' })"
        :disabled="busy"
        @click="emit('exit')"
      >
        <X class="size-3.5" aria-hidden="true" />{{ t('cccPreview.exit') }}
      </button>
    </div>
    <div
      v-if="draft"
      aria-hidden="true"
      class="pointer-events-none fixed inset-0 z-60 border-2 border-admin-info/70"
    />
    <p v-if="error" role="alert" class="px-4 pb-2 text-sm lg:px-6">
      {{ error }}
    </p>
    <CatalogPreviewChanges
      v-if="changes !== undefined"
      v-model:open="changesOpen"
      :changes
      :busy
      :locale
      @navigate="emit('navigate', $event)"
    />
  </div>
</template>
