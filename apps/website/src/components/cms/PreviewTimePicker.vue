<script setup lang="ts">
import { Clock } from '@lucide/vue'
import { computed, ref } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import PreviewForm from '@/components/cms/PreviewForm.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import PopoverTrigger from '@/components/ui/popover/PopoverTrigger.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatUtc } from '@/lib/cms/format'

interface Launch {
  id: string
  title: string
  at: string
  page: string
}

const {
  csrf,
  now,
  launches,
  pathname,
  triggerClass,
  locale = 'en'
} = defineProps<{
  csrf: string
  now?: string
  launches: Launch[]
  pathname: string
  triggerClass: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const picked = ref((now ?? new Date().toISOString()).slice(0, 16))
const pickedIso = computed(() => `${picked.value}:00Z`)
const label = now ? formatUtc(now, locale) : t('cmsAdmin.preview.now')
</script>

<template>
  <Popover>
    <PopoverTrigger :class="triggerClass">
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
      {{ label }}
    </PopoverTrigger>
    <PopoverContent class="grid w-80 gap-4">
      <PreviewForm
        :csrf
        view="DRAFT"
        :now="pickedIso"
        :return-to="pathname"
        class="grid gap-3"
      >
        <label class="grid gap-2 text-xs text-primary-comfy-canvas">
          {{ t('cmsAdmin.preview.asOf') }}
          <input
            v-model="picked"
            type="datetime-local"
            class="w-full rounded-xl border border-transparency-white-t20 bg-site-bg-soft px-3 py-2 text-sm text-primary-warm-white scheme-dark outline-none focus-visible:border-primary-comfy-yellow"
          />
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
      </PreviewForm>
      <div v-if="launches.length" class="grid gap-2">
        <p class="text-xs tracking-widest text-primary-comfy-canvas uppercase">
          {{ t('cmsAdmin.preview.jump') }}
        </p>
        <PreviewForm
          v-for="launch in launches"
          :key="launch.id"
          :csrf
          action="preview"
          view="DRAFT"
          :now="launch.at"
          :return-to="launch.page"
        >
          <button
            class="grid w-full rounded-xl border border-transparency-white-t8 px-3 py-2 text-left hover:border-primary-comfy-yellow"
          >
            <span class="font-medium">{{ launch.title }}</span>
            <span class="text-xs text-primary-comfy-canvas">
              {{ formatUtc(launch.at, locale) }}
            </span>
          </button>
        </PreviewForm>
      </div>
    </PopoverContent>
  </Popover>
</template>
