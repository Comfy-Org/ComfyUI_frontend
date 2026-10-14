<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'

import NodeBadge from '@/components/common/NodeBadge.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { HubLane } from './useHubLanes'

const { lane, locale = 'en' } = defineProps<{
  lane: HubLane
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <component
    :is="lane.open ? 'a' : 'span'"
    :href="lane.open ? lane.href : undefined"
    class="group flex flex-col items-center gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    :data-testid="`home-hub-lane-${lane.id}`"
  >
    <NodeBadge
      :segments="[{ text: t(lane.verb) }]"
      segment-class="px-1.5 sm:px-5"
      text-class="text-xl sm:text-4xl lg:text-5xl"
      size-class="h-11 sm:h-auto motion-safe:transition-transform motion-safe:group-hover:-translate-y-1"
    />
    <span
      v-if="lane.open"
      class="flex items-center gap-1 text-[10px] font-medium tracking-wider whitespace-nowrap text-primary-comfy-canvas/70 uppercase group-hover:text-primary-comfy-yellow motion-safe:transition-colors sm:text-xs sm:tracking-widest"
    >
      {{ t(lane.label) }}
      <ArrowUpRight class="size-3" aria-hidden="true" />
    </span>
  </component>
</template>
