<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'

const { locale = 'en', active } = defineProps<{
  locale?: Locale
  active: 'mcp' | 'cli'
}>()
const { t } = translationsFor(locale)

const routes = getRoutes(locale)

const surfaces = [
  {
    id: 'mcp' as const,
    name: t('surfaces.mcp.name'),
    tagline: t('surfaces.mcp.tagline'),
    href: routes.mcp
  },
  {
    id: 'cli' as const,
    name: t('surfaces.cli.name'),
    tagline: t('surfaces.cli.tagline'),
    href: routes.cli
  }
]

const surfaceClass =
  'flex flex-col gap-0.5 rounded-xl border px-4 py-2.5 text-left'
</script>

<template>
  <nav
    :aria-label="t('surfaces.tabsLabel')"
    class="inline-flex flex-wrap gap-2"
  >
    <template v-for="surface in surfaces" :key="surface.id">
      <span
        v-if="surface.id === active"
        aria-current="page"
        :class="cn(surfaceClass, 'border-primary-comfy-yellow bg-white/8')"
      >
        <span
          class="text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
        >
          {{ surface.name }}
        </span>
        <span class="text-[11px] text-smoke-700">{{ surface.tagline }}</span>
      </span>
      <a
        v-else
        :href="surface.href"
        :class="
          cn(
            surfaceClass,
            'border-white/15 bg-white/4 transition-colors hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none'
          )
        "
      >
        <span class="text-xs font-bold tracking-wider text-smoke-700 uppercase">
          {{ surface.name }}
        </span>
        <span class="text-[11px] text-smoke-700">{{ surface.tagline }}</span>
      </a>
    </template>
  </nav>
</template>
