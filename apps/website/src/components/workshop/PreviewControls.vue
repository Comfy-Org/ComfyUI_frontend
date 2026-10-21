<script setup lang="ts">
import { Check, Ellipsis } from '@lucide/vue'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import {
  PREVIEW_SWITCH_GROUPS,
  setPreviewSwitch,
  usePreviewSwitch
} from '@/lib/workshop/preview-switches'

const { enabled, locale = 'en' } = defineProps<{
  enabled: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const groups = PREVIEW_SWITCH_GROUPS.map((group) => ({
  ...group,
  switches: group.switches.map((entry) => ({
    ...entry,
    on: usePreviewSwitch(entry.id)
  }))
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
        class="z-60 w-80 max-w-[calc(100vw-1rem)] rounded-2xl border border-transparency-white-t8 bg-site-dropdown p-1.5 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <p
          class="px-2.5 pt-1.5 pb-2 text-sm font-medium text-primary-warm-white"
        >
          {{ t('workshop.preview.label') }}
        </p>
        <DropdownMenuGroup
          v-for="group in groups"
          :key="group.page"
          class="border-t border-transparency-white-t8 py-1"
          :data-testid="`preview-group-${group.page}`"
        >
          <DropdownMenuLabel
            class="px-2.5 pt-1.5 pb-1 text-xs tracking-wide text-primary-warm-gray uppercase"
          >
            {{ t(group.labelKey) }}
          </DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            v-for="entry in group.switches"
            :key="entry.id"
            :model-value="entry.on.value"
            :data-testid="`preview-switch-${entry.id}`"
            class="flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 outline-none data-highlighted:bg-transparency-white-t8"
            @select.prevent
            @update:model-value="
              (on: boolean) => setPreviewSwitch(entry.id, on)
            "
          >
            <span class="flex flex-1 flex-col gap-0.5">
              <span class="text-sm text-primary-warm-white">
                {{ t(entry.labelKey) }}
              </span>
              <span class="text-xs text-primary-warm-gray">
                {{ t(entry.hintKey) }}
              </span>
            </span>
            <span
              class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border border-transparency-white-t20"
            >
              <DropdownMenuItemIndicator>
                <Check class="size-3.5" aria-hidden="true" />
              </DropdownMenuItemIndicator>
            </span>
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <p
          class="border-t border-transparency-white-t8 px-2.5 pt-2 pb-1 text-xs text-primary-warm-gray"
        >
          {{ t('workshop.preview.note') }}
        </p>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
