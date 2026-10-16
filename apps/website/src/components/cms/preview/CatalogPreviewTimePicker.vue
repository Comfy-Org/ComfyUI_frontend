<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Clock, ChevronDown } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import { adminButtonVariants } from '@/components/cms/ui/adminButton'
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent
} from 'reka-ui'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CatalogScheduledPage } from '@/lib/cms/preview-display'
import {
  formatPreviewUtc,
  parseUtcInput,
  utcInput
} from '@/lib/cms/preview-display'

const {
  now,
  launches = [],
  busy = false,
  triggerClass,
  locale = 'en'
} = defineProps<{
  now?: string
  launches?: CatalogScheduledPage[]
  busy?: boolean
  triggerClass?: string
  locale?: Locale
}>()
const emit = defineEmits<{ timewarp: [at: string | undefined] }>()
const t = computed(() => translationsFor(locale).t)
const open = ref(false)
const input = ref(utcInput(now))
const attempted = ref(false)
const parsed = computed(() => parseUtcInput(input.value))
const scheduled = computed(() =>
  launches.filter((launch) => utcInput(launch.at))
)
watch(
  () => now,
  (value) => {
    input.value = utcInput(value)
    attempted.value = false
  }
)
function select(at: string | undefined) {
  if (busy) return
  emit('timewarp', at)
  open.value = false
}
function submit() {
  attempted.value = true
  if (parsed.value) select(parsed.value)
}
</script>
<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger
      :disabled="busy"
      :aria-label="t('cccPreview.time')"
      :class="
        triggerClass ??
        adminButtonVariants({ class: 'data-[state=open]:bg-admin-hover' })
      "
    >
      <Clock class="size-4" aria-hidden="true" />
      <span
        :class="
          cn(
            'size-1.5 rounded-full',
            now ? 'bg-admin-warning' : 'bg-admin-success'
          )
        "
        aria-hidden="true"
      />
      {{ now ? formatPreviewUtc(now, locale) : t('cccPreview.realTime') }}
      <ChevronDown class="size-3" aria-hidden="true" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :side-offset="8"
        align="start"
        class="z-60 grid w-80 max-w-[calc(100vw-2rem)] gap-4 rounded-xl border border-admin-line bg-admin-chrome p-4 font-admin text-admin-fg shadow-admin-popover"
      >
        <form class="grid gap-3" @submit.prevent="submit">
          <label class="grid gap-2 text-sm text-admin-muted">
            {{ t('cccPreview.dateLabel') }}
            <input
              v-model="input"
              type="datetime-local"
              :disabled="busy"
              :aria-invalid="attempted && !parsed"
              class="rounded-lg border border-admin-field bg-admin-page p-2 text-admin-fg focus-visible:outline-2 focus-visible:outline-admin-fg"
            />
          </label>
          <p
            v-if="attempted && !parsed"
            role="alert"
            class="text-xs text-admin-danger-text"
          >
            {{ t('cccPreview.invalidDate') }}
          </p>
          <div class="flex gap-2">
            <AdminButton type="submit" variant="primary" :disabled="busy">{{
              t('cccPreview.showDate')
            }}</AdminButton>
            <AdminButton :disabled="busy" @click="select(undefined)">{{
              t('cccPreview.now')
            }}</AdminButton>
          </div>
        </form>
        <div
          v-if="scheduled.length"
          class="grid gap-1 border-t border-admin-line pt-3"
        >
          <h3 class="mb-1 text-xs text-admin-muted">
            {{ t('cccPreview.scheduled') }}
          </h3>
          <button
            v-for="launch in scheduled"
            :key="launch.uid"
            type="button"
            :disabled="busy"
            class="grid gap-1 rounded-lg p-2 text-left text-sm hover:bg-admin-hover focus-visible:outline-2 focus-visible:outline-admin-fg disabled:opacity-40"
            @click="select(new Date(launch.at).toISOString())"
          >
            <span>{{ launch.title }}</span
            ><span class="text-xs text-admin-muted">{{
              formatPreviewUtc(launch.at, locale)
            }}</span>
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
