<script setup lang="ts">
import { Globe, LayoutDashboard, List, Pencil, X } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
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
import { markDraftCards } from '@/lib/cms/draft-card-marks'
import type { DraftPageChange } from '@/lib/cms/format'
import { formatUtc, isFuture, pageOf, previewChanges } from '@/lib/cms/format'

const {
  csrf,
  view = 'DRAFT',
  editHref,
  now,
  changes,
  pendingWorkflows = 0,
  pathname,
  locale = 'en'
} = defineProps<{
  csrf: string
  view?: 'DRAFT' | 'LIVE'
  /** The admin editor for the page being previewed, when it is a Hub item. */
  editHref?: string
  now?: string
  changes: DraftPageChange[]
  /** Workflow submissions waiting for approval, which no page shows yet. */
  pendingWorkflows?: number
  pathname: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const draft = view === 'DRAFT'

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
let unmarkCards = () => {}
onMounted(() => {
  if (view === 'DRAFT')
    unmarkCards = markDraftCards(document.body, changes, (state) =>
      t(`cmsAdmin.preview.card.${state}`)
    )
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
  unmarkCards()
  observer?.disconnect()
  document.documentElement.style.removeProperty('--cms-preview-offset')
})

const pill = adminButtonVariants({ class: 'data-[state=open]:bg-admin-hover' })
</script>

<template>
  <div
    ref="bar"
    data-cms-preview-bar
    role="region"
    :aria-label="t('cmsAdmin.preview.label')"
    :class="
      cn(
        'sticky top-0 z-50 border-t-2 border-b border-b-admin-line bg-admin-chrome font-admin text-admin-fg',
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

      <a v-if="editHref" :href="editHref" :class="pill">
        <Pencil aria-hidden="true" />
        {{ t('cmsAdmin.preview.editPage') }}
      </a>

      <a href="/admin/" :class="pill">
        <LayoutDashboard aria-hidden="true" />
        {{ t('cmsAdmin.title') }}
      </a>

      <PreviewForm :csrf action="exit" :return-to="pathname">
        <button :class="adminButtonVariants({ variant: 'primary' })">
          <X aria-hidden="true" />
          {{ t('cmsAdmin.preview.exit') }}
        </button>
      </PreviewForm>
    </div>

    <div
      v-if="draft"
      aria-hidden="true"
      class="pointer-events-none fixed inset-0 z-60 border-2 border-admin-info/70"
    />

    <PreviewChangesSheet
      v-model:open="changesOpen"
      :csrf
      :changes="listed"
      :pending-workflows="pendingWorkflows"
      :pathname
      :locale
    />
  </div>
</template>
