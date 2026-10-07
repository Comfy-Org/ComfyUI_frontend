<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { crumbs, locale = 'en' } = defineProps<{
  crumbs: readonly { label: string; href?: string; testId?: string }[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <nav
    :aria-label="t('ui.breadcrumb')"
    class="min-w-0"
    data-testid="hub-crumbs"
  >
    <ol class="flex items-center gap-1.5 text-sm text-primary-warm-gray">
      <li
        v-for="(crumb, index) in crumbs"
        :key="crumb.label"
        :class="cn('flex items-center gap-1.5', !crumb.href && 'min-w-0')"
      >
        <ChevronRight
          v-if="index > 0"
          aria-hidden="true"
          class="size-3.5 shrink-0 text-primary-warm-gray/50"
        />
        <a
          v-if="crumb.href"
          :href="crumb.href"
          :data-testid="crumb.testId"
          class="shrink-0 rounded-sm transition-colors outline-none hover:text-primary-comfy-canvas focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          >{{ crumb.label }}</a
        >
        <span
          v-else
          aria-current="page"
          class="truncate text-primary-comfy-canvas/70"
          >{{ crumb.label }}</span
        >
      </li>
    </ol>
  </nav>
</template>
