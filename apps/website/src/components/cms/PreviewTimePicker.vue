<script setup lang="ts">
import { Clock } from '@lucide/vue'
import { computed, ref } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import PreviewForm from '@/components/cms/PreviewForm.vue'
import { adminButtonVariants } from '@/components/cms/ui/adminButton'
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
      <Clock aria-hidden="true" />
      <span
        :class="
          cn(
            'size-1.5 rounded-full',
            now ? 'bg-admin-warning' : 'bg-admin-success'
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
        <label class="grid gap-1.5 text-xs text-admin-muted">
          {{ t('cmsAdmin.preview.asOf') }}
          <input
            v-model="picked"
            type="datetime-local"
            class="h-8 w-full rounded-lg border border-admin-field bg-admin-page px-2.5 text-xs text-admin-fg scheme-dark outline-none hover:border-ash-800 focus-visible:border-admin-control"
          />
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            name="action"
            value="preview"
            :class="adminButtonVariants({ variant: 'primary' })"
          >
            {{ t('cmsAdmin.preview.show') }}
          </button>
          <button
            v-if="now"
            name="action"
            value="now"
            :class="adminButtonVariants()"
          >
            {{ t('cmsAdmin.preview.backToNow') }}
          </button>
        </div>
      </PreviewForm>
      <div v-if="launches.length" class="grid gap-1.5">
        <p
          class="text-xs font-medium tracking-[0.06em] text-admin-muted uppercase"
        >
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
            class="grid w-full cursor-pointer gap-0.5 rounded-lg border border-admin-line px-3 py-2 text-left text-sm hover:bg-admin-hover"
          >
            <span>{{ launch.title }}</span>
            <span class="text-xs text-admin-muted">
              {{ formatUtc(launch.at, locale) }}
            </span>
          </button>
        </PreviewForm>
      </div>
    </PopoverContent>
  </Popover>
</template>
