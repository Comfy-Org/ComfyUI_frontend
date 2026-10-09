<script setup lang="ts">
import { Eye, Globe, List, X } from '@lucide/vue'
import { computed, ref } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import PreviewChangesSheet from '@/components/cms/PreviewChangesSheet.vue'
import PreviewForm from '@/components/cms/PreviewForm.vue'
import PreviewTimePicker from '@/components/cms/PreviewTimePicker.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import PopoverTrigger from '@/components/ui/popover/PopoverTrigger.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { DraftPageChange } from '@/lib/cms/format'
import { formatUtc, isFuture, pageOf, previewChanges } from '@/lib/cms/format'

const {
  csrf,
  now,
  changes,
  pathname,
  locale = 'en'
} = defineProps<{
  csrf: string
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
const summary = computed(() =>
  [
    t('cmsAdmin.preview.changes', { count: changes.length }, changes.length),
    now ? t('cmsAdmin.preview.timeTravel') : ''
  ]
    .filter(Boolean)
    .join(' · ')
)
const changesOpen = ref(false)

const pill =
  'inline-flex items-center gap-2 rounded-full border-[1.5px] border-primary-comfy-ink/35 px-3 py-1 text-sm font-medium transition-colors hover:border-primary-comfy-ink hover:bg-primary-comfy-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-comfy-ink data-[state=open]:border-primary-comfy-ink'
</script>

<template>
  <div
    role="region"
    :aria-label="t('cmsAdmin.preview.label')"
    class="sticky top-0 z-50 border-b-2 border-primary-comfy-ink bg-primary-comfy-yellow text-primary-comfy-ink"
  >
    <div class="flex flex-wrap items-center gap-2 px-4 py-2 lg:px-6">
      <p class="mr-auto flex items-center gap-2 text-sm font-bold">
        <span
          class="grid size-7 place-items-center rounded-full bg-primary-comfy-ink text-primary-comfy-yellow"
          aria-hidden="true"
        >
          <Eye class="size-4" />
        </span>
        {{ t('cmsAdmin.preview.mode') }}
        <span class="hidden font-medium opacity-75 sm:inline">
          · {{ summary }}
        </span>
      </p>

      <PreviewForm
        :csrf
        action="preview"
        :return-to="pathname"
        role="group"
        :aria-label="t('cmsAdmin.preview.modeLabel')"
        class="flex rounded-full bg-primary-comfy-ink/10 p-0.5"
      >
        <span
          aria-current="true"
          class="rounded-full bg-primary-comfy-ink px-3 py-1 text-sm font-semibold text-primary-comfy-yellow"
        >
          {{ t('cmsAdmin.preview.draftTab') }}
        </span>
        <button
          name="view"
          value="LIVE"
          class="rounded-full px-3 py-1 text-sm font-semibold hover:bg-primary-comfy-ink/10"
        >
          {{ t('cmsAdmin.preview.liveTab') }}
        </button>
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
          <Globe class="size-4" aria-hidden="true" />
          {{ languageCode }}
        </PopoverTrigger>
        <PopoverContent class="grid w-48 gap-1 p-2">
          <a
            v-for="language in languages"
            :key="language.code"
            :href="language.href"
            :lang="language.code"
            :aria-current="language.code === locale ? 'true' : undefined"
            class="rounded-lg px-3 py-2 text-sm hover:bg-transparency-white-t8 aria-[current]:bg-transparency-white-t8 aria-[current]:font-semibold"
          >
            {{ language.label }}
          </a>
        </PopoverContent>
      </Popover>

      <button type="button" :class="pill" @click="changesOpen = true">
        <List class="size-4" aria-hidden="true" />
        {{ t('cmsAdmin.preview.changesButton') }}
      </button>

      <PreviewForm :csrf action="exit" :return-to="pathname">
        <button
          :class="
            cn(
              pill,
              'border-primary-comfy-ink bg-primary-comfy-ink font-semibold text-primary-comfy-yellow hover:bg-primary-comfy-ink'
            )
          "
        >
          <X class="size-4" aria-hidden="true" />
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
