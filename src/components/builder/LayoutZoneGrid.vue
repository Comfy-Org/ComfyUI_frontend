<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  GridOverride,
  LayoutTemplate,
  LayoutZone
} from '@/components/builder/layoutTemplates'
import { buildGridTemplate } from '@/components/builder/layoutTemplates'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()
const isMobile = useBreakpoints(breakpointsTailwind).smaller('md')

const {
  template,
  highlightedZone,
  dashed = true,
  gridOverrides
} = defineProps<{
  template: LayoutTemplate
  highlightedZone?: string
  dashed?: boolean
  gridOverrides?: GridOverride
  /** Extra CSS classes per zone ID, applied to the grid cell div. */
  zoneClasses?: Record<string, string>
}>()

defineSlots<{
  zone(props: { zone: LayoutZone }): unknown
}>()

const gridStyle = computed(() => {
  if (isMobile.value) {
    // Stack all zones vertically on mobile
    const areas = template.zones.map((z) => `"${z.gridArea}"`).join(' ')
    return {
      gridTemplate: `${areas} / 1fr`,
      gridAutoRows: 'minmax(200px, auto)'
    }
  }
  return { gridTemplate: buildGridTemplate(template, gridOverrides) }
})
</script>

<template>
  <!-- Wrapper so handles overlay above zone content (overflow-y-auto creates stacking contexts) -->
  <div class="relative size-full overflow-hidden">
    <!-- Grid with zones -->
    <div class="grid size-full gap-3 overflow-hidden p-3" :style="gridStyle">
      <div
        v-for="zone in template.zones"
        :key="zone.id"
        :style="{ gridArea: zone.gridArea }"
        :class="
          cn(
            'relative flex flex-col overflow-y-auto rounded-xl transition-colors',
            dashed
              ? 'border border-dashed border-border-subtle/40'
              : 'border border-border-subtle/40',
            highlightedZone === zone.id &&
              'border-primary-background bg-primary-background/10',
            zoneClasses?.[zone.id]
          )
        "
        :data-zone-id="zone.id"
        :aria-label="t(zone.label)"
      >
        <slot name="zone" :zone="zone">
          <div
            class="flex size-full flex-col items-center justify-center gap-2 p-4 text-sm text-muted-foreground"
          >
            <i class="icon-[lucide--plus] size-5" />
            <span>{{ t('linearMode.arrange.dropHere') }}</span>
            <span class="text-xs opacity-60">{{ t(zone.label) }}</span>
          </div>
        </slot>
      </div>
    </div>
  </div>
</template>
