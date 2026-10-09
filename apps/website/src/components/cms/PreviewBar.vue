<script setup lang="ts">
import { Eye, Globe, List, X } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

import PreviewChangesSheet from '@/components/cms/PreviewChangesSheet.vue'
import PreviewForm from '@/components/cms/PreviewForm.vue'
import PreviewTimePicker from '@/components/cms/PreviewTimePicker.vue'
import { adminButtonVariants } from '@/components/cms/ui/adminButton'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import PopoverTrigger from '@/components/ui/popover/PopoverTrigger.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { DraftPageChange } from '@/lib/cms/format'
import { formatUtc, isFuture, pageOf, previewChanges } from '@/lib/cms/format'

const {
  csrf,
  view = 'DRAFT',
  now,
  changes,
  pathname,
  locale = 'en'
} = defineProps<{
  csrf: string
  view?: 'DRAFT' | 'LIVE'
  now?: string
  changes: DraftPageChange[]
  pathname: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const listed = computed(() =>
  previewChanges(changes, now ? Date.parse(now) : Date.now(), (at) =>
    formatUtc(at, locale)
  )
)
const launches = computed(() =>
  changes.flatMap((change) =>
    change.visibleFrom && isFuture(change.visibleFrom)
      ? [
          {
            id: change.id,
            title: change.title,
            at: change.visibleFrom,
            page: pageOf(change.slug)
          }
        ]
      : []
  )
)
const basePath = pathname.replace(/^\/zh-CN(?=\/)/, '')
const languages = [
  { code: 'en', label: 'English', href: basePath },
  { code: 'zh-CN', label: '中文', href: `/zh-CN${basePath}` }
]
const languageCode = locale === 'zh-CN' ? '中' : 'EN'
const views = [
  { value: 'DRAFT', label: t('cmsAdmin.preview.draftTab') },
  { value: 'LIVE', label: t('cmsAdmin.preview.liveTab') }
] as const
const summary = computed(() =>
  [
    view === 'LIVE'
      ? t('cmsAdmin.preview.liveSummary')
      : t(
          'cmsAdmin.preview.changes',
          { count: changes.length },
          changes.length
        ),
    now ? t('cmsAdmin.preview.timeTravel') : ''
  ]
    .filter(Boolean)
    .join(' · ')
)
const changesOpen = ref(false)

// The site header is also sticky; publish this bar's height so the header
// docks underneath it instead of sliding over it.
const bar = useTemplateRef('bar')
let observer: ResizeObserver | undefined
onMounted(() => {
  const url = new URL(window.location.href)
  if (url.searchParams.get('changes') === 'open') {
    changesOpen.value = true
    url.searchParams.delete('changes')
    window.history.replaceState(null, '', url)
  }
  observer = new ResizeObserver(([entry]) =>
    document.documentElement.style.setProperty(
      '--cms-preview-offset',
      `${entry.borderBoxSize[0].blockSize}px`
    )
  )
  if (bar.value) observer.observe(bar.value)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  document.documentElement.style.removeProperty('--cms-preview-offset')
})

const pill = adminButtonVariants({ class: 'data-[state=open]:bg-admin-hover' })
</script>

<template>
  <div
    ref="bar"
    role="region"
    :aria-label="t('cmsAdmin.preview.label')"
    class="sticky top-0 z-50 border-b border-admin-line bg-admin-chrome font-admin text-admin-fg"
  >
    <div class="flex flex-wrap items-center gap-2 px-4 py-2 lg:px-6">
      <p class="mr-auto flex items-center gap-2.5 text-sm">
        <span
          class="grid size-6 place-items-center rounded-md bg-admin-fg text-admin-card"
          aria-hidden="true"
        >
          <Eye class="size-3.5" />
        </span>
        <span class="font-medium">{{
          t(
            view === 'LIVE'
              ? 'cmsAdmin.preview.liveMode'
              : 'cmsAdmin.preview.mode'
          )
        }}</span>
        <span class="hidden text-xs text-admin-muted sm:inline">
          {{ summary }}
        </span>
      </p>

      <PreviewForm
        :csrf
        action="preview"
        :return-to="pathname"
        role="group"
        :aria-label="t('cmsAdmin.preview.modeLabel')"
        class="inline-flex gap-1 rounded-lg border border-admin-field p-0.5"
      >
        <template v-for="option in views" :key="option.value">
          <span
            v-if="option.value === view"
            aria-current="true"
            class="inline-flex h-6.5 items-center rounded-md bg-admin-selected px-2.5 text-xs font-medium"
          >
            {{ option.label }}
          </span>
          <button
            v-else
            name="view"
            :value="option.value"
            class="inline-flex h-6.5 cursor-pointer items-center rounded-md px-2.5 text-xs font-medium text-admin-muted hover:text-admin-fg"
          >
            {{ option.label }}
          </button>
        </template>
      </PreviewForm>

      <PreviewTimePicker
        :csrf
        :now
        :launches
        :pathname
        :trigger-class="pill"
        :locale
      />

      <Popover>
        <PopoverTrigger
          :class="pill"
          :aria-label="t('cmsAdmin.preview.language')"
        >
          <Globe aria-hidden="true" />
          {{ languageCode }}
        </PopoverTrigger>
        <PopoverContent class="grid w-44 gap-0.5 p-1">
          <a
            v-for="language in languages"
            :key="language.code"
            :href="language.href"
            :lang="language.code"
            :aria-current="language.code === locale ? 'true' : undefined"
            class="rounded-md px-2.5 py-1.5 text-sm hover:bg-admin-hover aria-[current]:bg-admin-line"
          >
            {{ language.label }}
          </a>
        </PopoverContent>
      </Popover>

      <button type="button" :class="pill" @click="changesOpen = true">
        <List aria-hidden="true" />
        {{ t('cmsAdmin.preview.changesButton') }}
      </button>

      <PreviewForm :csrf action="exit" :return-to="pathname">
        <button :class="adminButtonVariants({ variant: 'primary' })">
          <X aria-hidden="true" />
          {{ t('cmsAdmin.preview.exit') }}
        </button>
      </PreviewForm>
    </div>

    <PreviewChangesSheet
      v-model:open="changesOpen"
      :csrf
      :changes="listed"
      :pathname
      :locale
    />
  </div>
</template>
