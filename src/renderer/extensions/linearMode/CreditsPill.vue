<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import { CREDITS_ICON } from '@/base/credits/comfyCredits'

const { t } = useI18n()
</script>
<template>
  <span
    class="flex h-5 min-w-0 flex-wrap content-start items-center justify-end overflow-hidden text-xs font-medium [--pill-fill:color-mix(in_srgb,currentColor_15%,var(--credits-pill-base,var(--color-base-foreground)))]"
  >
    <span
      class="z-10 flex size-5 shrink-0 items-center justify-center rounded-full bg-(--pill-fill)"
    >
      <i :class="cn(CREDITS_ICON, 'size-3.5 bg-current')" />
    </span>
    <span
      class="-ml-2.5 flex h-5 items-center rounded-r-full bg-(--pill-fill) pr-2.5 pl-3"
    >
      {{ t('linearMode.usesCredits') }}
    </span>
  </span>
</template>
