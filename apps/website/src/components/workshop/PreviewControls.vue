<script setup lang="ts">
import { Check, Ellipsis } from '@lucide/vue'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import {
  PREVIEW_SWITCHES,
  setPreviewSwitch,
  usePreviewSwitch
} from '@/lib/workshop/preview-switches'

const { enabled, locale = 'en' } = defineProps<{
  enabled: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const switches = PREVIEW_SWITCHES.map((entry) => ({
  ...entry,
  on: usePreviewSwitch(entry.id)
}))
</script>

<template>
  <DropdownMenuRoot v-if="enabled">
    <DropdownMenuTrigger
      :aria-label="t('workshop.preview.label')"
      class="fixed right-3 bottom-20 z-60 flex size-8 items-center justify-center rounded-full border border-transparency-white-t20 bg-primary-comfy-ink-light text-primary-comfy-canvas shadow-lg outline-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 lg:right-6 lg:bottom-16"
      data-testid="preview-controls"
    >
      <Ellipsis class="size-4" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        side="top"
        align="end"
        :side-offset="8"
        :collision-padding="8"
        class="z-60 min-w-72 rounded-2xl border border-transparency-white-t8 bg-site-dropdown p-1.5 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <DropdownMenuLabel
          class="px-2.5 pt-1.5 pb-1 text-xs text-primary-warm-gray"
        >
          {{ t('workshop.preview.label') }}
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          v-for="entry in switches"
          :key="entry.id"
          :model-value="entry.on.value"
          :data-testid="`preview-switch-${entry.id}`"
          class="flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-primary-warm-white outline-none data-highlighted:bg-transparency-white-t8"
          @select.prevent
          @update:model-value="(on: boolean) => setPreviewSwitch(entry.id, on)"
        >
          <span class="flex-1">{{ t(entry.labelKey) }}</span>
          <DropdownMenuItemIndicator>
            <Check class="size-3.5" aria-hidden="true" />
          </DropdownMenuItemIndicator>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
