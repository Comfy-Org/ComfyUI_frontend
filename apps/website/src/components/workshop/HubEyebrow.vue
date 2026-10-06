<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import { getRoutes } from '@/config/routes'
import { t } from '@/i18n/translations'
import type { HubSection } from '@/lib/workshop/hub-section'
import { workshopEyebrowClass } from './workshopHeadingClasses'

const { section } = defineProps<{ section: HubSection }>()
</script>

<template>
  <p v-if="section === 'explore'" :class="workshopEyebrowClass">
    {{ t('workshop.catalogue.eyebrow') }}
  </p>
  <a
    v-else
    :href="getRoutes('en').hubExplore"
    :class="
      cn(
        workshopEyebrowClass,
        'group inline-flex items-center gap-1 rounded-lg outline-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
      )
    "
    data-testid="hub-back"
  >
    <ChevronLeft
      class="size-4 transition-transform group-hover:-translate-x-0.5"
      aria-hidden="true"
    />
    {{ t('workshop.catalogue.eyebrow') }}
  </a>
</template>
