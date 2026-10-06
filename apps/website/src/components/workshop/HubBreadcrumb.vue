<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { crumbs, locale = 'en' } = defineProps<{
  crumbs: readonly { label: string; href?: string }[]
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
        <span
          v-if="index > 0"
          aria-hidden="true"
          class="text-primary-warm-gray/50"
          >›</span
        >
        <a
          v-if="crumb.href"
          :href="crumb.href"
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
