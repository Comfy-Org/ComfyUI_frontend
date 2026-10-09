<script setup lang="ts">
import { Clock, Eye, Globe, List, X } from '@lucide/vue'
import { computed, ref } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import ChangeTag from '@/components/cms/ChangeTag.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import PopoverTrigger from '@/components/ui/popover/PopoverTrigger.vue'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import SheetContent from '@/components/ui/sheet/SheetContent.vue'
import SheetDescription from '@/components/ui/sheet/SheetDescription.vue'
import SheetTitle from '@/components/ui/sheet/SheetTitle.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatUtc } from '@/lib/cms/format'
import type { QueueChange } from '@/lib/cms/queue'

interface PreviewChange {
  id: string
  title: string
  change: QueueChange
  slug: string
  visibleFrom?: string
}

const {
  csrf,
  now,
  changes,
  pathname,
  locale = 'en'
} = defineProps<{
  csrf: string
  now?: string
  changes: PreviewChange[]
  pathname: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const clock = computed(() => (now ? Date.parse(now) : Date.now()))
const scheduled = computed(() =>
  changes.filter(
    (change) =>
      change.visibleFrom && Date.parse(change.visibleFrom) > Date.now()
  )
)
const picked = ref((now ?? new Date().toISOString()).slice(0, 16))
const pickedIso = computed(() => `${picked.value}:00Z`)
const languages = computed(() => {
  const base = pathname.replace(/^\/zh-CN(?=\/)/, '')
  return [
    { code: 'en', label: 'English', href: base },
    { code: 'zh-CN', label: '中文', href: `/zh-CN${base}` }
  ]
})
const changesOpen = ref(false)
const pageOf = (slug: string) => slug.replace(/\/?$/, '/')
const hiddenNow = (change: PreviewChange) =>
  !!change.visibleFrom && Date.parse(change.visibleFrom) > clock.value

const pill =
  'inline-flex items-center gap-2 rounded-full border-[1.5px] border-primary-comfy-ink/35 px-3 py-1 text-sm font-medium transition-colors hover:border-primary-comfy-ink hover:bg-primary-comfy-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-comfy-ink data-[state=open]:border-primary-comfy-ink'
const field =
  'w-full rounded-xl border border-transparency-white-t20 bg-site-bg-soft px-3 py-2 text-sm text-primary-warm-white outline-none [color-scheme:dark] focus-visible:border-primary-comfy-yellow'
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
          ·
          {{
            t(
              'cmsAdmin.preview.changes',
              { count: changes.length },
              changes.length
            )
          }}
          <template v-if="now">
            · {{ t('cmsAdmin.preview.timeTravel') }}</template
          >
        </span>
      </p>

      <form
        data-astro-reload
        method="post"
        action="/admin/actions"
        role="group"
        :aria-label="t('cmsAdmin.preview.modeLabel')"
        class="flex rounded-full bg-primary-comfy-ink/10 p-0.5"
      >
        <input type="hidden" name="csrf" :value="csrf" />
        <input type="hidden" name="action" value="preview" />
        <input type="hidden" name="return_to" :value="pathname" />
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
      </form>

      <Popover>
        <PopoverTrigger :class="pill">
          <Clock class="size-4" aria-hidden="true" />
          <span
            :class="
              cn(
                'size-2 rounded-full',
                now
                  ? 'bg-primary-comfy-orange ring-1 ring-primary-comfy-ink'
                  : 'bg-primary-comfy-ink'
              )
            "
            aria-hidden="true"
          />
          {{ now ? formatUtc(now, locale) : t('cmsAdmin.preview.now') }}
        </PopoverTrigger>
        <PopoverContent class="grid w-80 gap-4">
          <form
            data-astro-reload
            method="post"
            action="/admin/actions"
            class="grid gap-3"
          >
            <input type="hidden" name="csrf" :value="csrf" />
            <input type="hidden" name="view" value="DRAFT" />
            <input type="hidden" name="return_to" :value="pathname" />
            <input type="hidden" name="now" :value="pickedIso" />
            <label class="grid gap-2 text-xs text-primary-comfy-canvas">
              {{ t('cmsAdmin.preview.asOf') }}
              <input v-model="picked" type="datetime-local" :class="field" />
            </label>
            <div class="flex flex-wrap gap-2">
              <button
                name="action"
                value="preview"
                class="rounded-full bg-primary-comfy-yellow px-4 py-1.5 text-sm font-semibold text-primary-comfy-ink"
              >
                {{ t('cmsAdmin.preview.show') }}
              </button>
              <button
                v-if="now"
                name="action"
                value="now"
                class="rounded-full border border-transparency-white-t20 px-4 py-1.5 text-sm"
              >
                {{ t('cmsAdmin.preview.backToNow') }}
              </button>
            </div>
          </form>
          <div v-if="scheduled.length" class="grid gap-2">
            <p
              class="text-xs tracking-widest text-primary-comfy-canvas uppercase"
            >
              {{ t('cmsAdmin.preview.jump') }}
            </p>
            <form
              v-for="change in scheduled"
              :key="change.id"
              data-astro-reload
              method="post"
              action="/admin/actions"
            >
              <input type="hidden" name="csrf" :value="csrf" />
              <input type="hidden" name="action" value="preview" />
              <input type="hidden" name="view" value="DRAFT" />
              <input type="hidden" name="now" :value="change.visibleFrom" />
              <input
                type="hidden"
                name="return_to"
                :value="pageOf(change.slug)"
              />
              <button
                class="grid w-full rounded-xl border border-transparency-white-t8 px-3 py-2 text-left hover:border-primary-comfy-yellow"
              >
                <span class="font-medium">{{ change.title }}</span>
                <span class="text-xs text-primary-comfy-canvas">{{
                  formatUtc(change.visibleFrom ?? '', locale)
                }}</span>
              </button>
            </form>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger
          :class="pill"
          :aria-label="t('cmsAdmin.preview.language')"
        >
          <Globe class="size-4" aria-hidden="true" />
          {{ locale === 'zh-CN' ? '中' : 'EN' }}
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

      <form data-astro-reload method="post" action="/admin/actions">
        <input type="hidden" name="csrf" :value="csrf" />
        <input type="hidden" name="return_to" :value="pathname" />
        <button
          name="action"
          value="exit"
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
      </form>
    </div>

    <Sheet v-model:open="changesOpen">
      <SheetContent
        :close-label="t('cmsAdmin.review.close')"
        class="w-full gap-0 bg-primary-comfy-ink-light sm:max-w-sm"
      >
        <div class="grid gap-1 p-6 pr-20">
          <SheetTitle class="text-xl">
            {{ t('cmsAdmin.preview.changesTitle') }}
          </SheetTitle>
          <SheetDescription class="text-sm text-primary-comfy-canvas">
            {{ t('cmsAdmin.preview.changesNote') }}
          </SheetDescription>
        </div>
        <ul class="grid gap-1 overflow-y-auto px-3 pb-6">
          <li v-for="change in changes" :key="change.id">
            <form
              v-if="hiddenNow(change)"
              data-astro-reload
              method="post"
              action="/admin/actions"
            >
              <input type="hidden" name="csrf" :value="csrf" />
              <input type="hidden" name="action" value="preview" />
              <input type="hidden" name="view" value="DRAFT" />
              <input type="hidden" name="now" :value="change.visibleFrom" />
              <input
                type="hidden"
                name="return_to"
                :value="pageOf(change.slug)"
              />
              <button
                class="grid w-full gap-1 rounded-xl px-3 py-2 text-left text-primary-warm-white hover:bg-transparency-white-t8"
              >
                <span class="font-medium">{{ change.title }}</span>
                <span
                  class="flex items-center gap-2 text-xs text-primary-comfy-orange"
                >
                  <ChangeTag :change="change.change" :locale />
                  {{ formatUtc(change.visibleFrom ?? '', locale) }}
                </span>
              </button>
            </form>
            <a
              v-else
              :href="
                change.change === 'removed' ? undefined : pageOf(change.slug)
              "
              :aria-current="
                pageOf(change.slug) === pathname ? 'page' : undefined
              "
              class="grid gap-1 rounded-xl px-3 py-2 text-primary-warm-white hover:bg-transparency-white-t8 aria-[current=page]:bg-transparency-white-t8"
            >
              <span class="font-medium">{{ change.title }}</span>
              <span
                class="flex items-center gap-2 text-xs text-primary-comfy-canvas"
              >
                <ChangeTag :change="change.change" :locale />
                {{ change.slug }}
              </span>
            </a>
          </li>
        </ul>
        <a
          href="/admin/"
          class="mx-6 mt-auto mb-6 rounded-2xl border border-transparency-white-t20 px-4 py-2 text-center text-sm hover:border-primary-comfy-yellow"
        >
          {{ t('cmsAdmin.preview.toAdmin') }}
        </a>
      </SheetContent>
    </Sheet>
  </div>
</template>
