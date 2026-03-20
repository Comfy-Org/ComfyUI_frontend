<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  GridOverride,
  LayoutTemplate,
  LayoutZone
} from '@/components/builder/layoutTemplates'
import { buildGridTemplate } from '@/components/builder/layoutTemplates'
import ZoneResizeHandle from '@/components/builder/ZoneResizeHandle.vue'
import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()
const isMobile = useBreakpoints(breakpointsTailwind).smaller('md')
const appModeStore = useAppModeStore()

const {
  template,
  highlightedZone,
  dashed = true,
  gridOverrides,
  resizable = false
} = defineProps<{
  template: LayoutTemplate
  highlightedZone?: string
  dashed?: boolean
  gridOverrides?: GridOverride
  resizable?: boolean
  /** Zone IDs that have content — empty zones get no border in app mode. */
  filledZones?: Set<string>
}>()

defineSlots<{
  zone(props: { zone: LayoutZone }): unknown
}>()

/** Local fractions for live resize feedback before persisting. */
const liveColumnFractions = ref<number[] | undefined>(undefined)
const liveRowFractions = ref<number[] | undefined>(undefined)

// Clear live fractions when template changes to avoid stale values
watch(
  () => template.id,
  () => {
    liveColumnFractions.value = undefined
    liveRowFractions.value = undefined
  }
)

const effectiveOverrides = computed<GridOverride | undefined>(() => {
  if (!liveColumnFractions.value && !liveRowFractions.value)
    return gridOverrides
  return {
    ...gridOverrides,
    columnFractions:
      liveColumnFractions.value ?? gridOverrides?.columnFractions,
    rowFractions: liveRowFractions.value ?? gridOverrides?.rowFractions
  }
})

const gridStyle = computed(() => {
  if (isMobile.value) {
    // Stack all zones vertically on mobile
    const areas = template.zones.map((z) => `"${z.gridArea}"`).join(' ')
    return {
      gridTemplate: `${areas} / 1fr`,
      gridAutoRows: 'minmax(200px, auto)'
    }
  }
  return { gridTemplate: buildGridTemplate(template, effectiveOverrides.value) }
})

/** Parse column/row counts from the template. */
const columnCount = computed(() => {
  const firstRow = template.gridTemplate
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('"'))
  if (!firstRow) return 0
  const match = firstRow.match(/"([^"]+)"/)
  return match ? match[1].split(/\s+/).length : 0
})

/**
 * Parse fractions from the grid template, handling minmax() expressions.
 * For minmax(Xpx, Yfr), extracts the fr value Y.
 */
function parseFractions(
  gridTemplate: string,
  type: 'column' | 'row'
): number[] {
  const lines = gridTemplate
    .trim()
    .split('\n')
    .map((l) => l.trim())

  if (type === 'column') {
    const slashLine = lines.find((l) => l.startsWith('/'))
    if (!slashLine) return Array.from({ length: columnCount.value }, () => 1)
    // Split on spaces but keep minmax() together
    const parts: string[] = []
    let depth = 0
    let current = ''
    for (const ch of slashLine.substring(1).trim()) {
      if (ch === '(') depth++
      if (ch === ')') depth--
      if (ch === ' ' && depth === 0) {
        if (current) parts.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    if (current) parts.push(current)

    return parts.map((p) => {
      const minmaxMatch = p.match(/minmax\([^,]+,\s*([\d.]+)fr\)/)
      if (minmaxMatch) return parseFloat(minmaxMatch[1])
      const n = parseFloat(p)
      return isNaN(n) ? 1 : n
    })
  }

  return lines
    .filter((l) => l.startsWith('"'))
    .map((line) => {
      const match = line.match(/"[^"]+"\s+(.+)/)
      if (!match) return 1
      const n = parseFloat(match[1])
      return isNaN(n) ? 1 : n
    })
}

const defaultColumnFractions = computed(() =>
  parseFractions(template.gridTemplate, 'column')
)
const defaultRowFractions = computed(() =>
  parseFractions(template.gridTemplate, 'row')
)

const effectiveColumnFractions = computed(
  () =>
    effectiveOverrides.value?.columnFractions ?? defaultColumnFractions.value
)
const effectiveRowFractions = computed(
  () => effectiveOverrides.value?.rowFractions ?? defaultRowFractions.value
)

/** Column handle positions as CSS calc() values accounting for padding and gaps. */
const columnHandles = computed(() => {
  const fracs = effectiveColumnFractions.value
  const total = fracs.reduce((a, b) => a + b, 0)
  if (total === 0) return []
  const handles: { index: number; cssLeft: string }[] = []
  let cumulative = 0
  const gapCount = fracs.length - 1
  for (let i = 0; i < fracs.length - 1; i++) {
    cumulative += fracs[i]
    const pct = (cumulative / total) * 100
    handles.push({
      index: i,
      cssLeft: `calc(12px + (100% - ${24 + gapCount * 12}px) * ${pct / 100} + ${i * 12 + 6}px)`
    })
  }
  return handles
})

/** Row handle positions as CSS calc() values. */
const rowHandles = computed(() => {
  const fracs = effectiveRowFractions.value
  const total = fracs.reduce((a, b) => a + b, 0)
  if (total === 0) return []
  const handles: { index: number; cssTop: string }[] = []
  let cumulative = 0
  const gapCount = fracs.length - 1
  for (let i = 0; i < fracs.length - 1; i++) {
    cumulative += fracs[i]
    const pct = (cumulative / total) * 100
    handles.push({
      index: i,
      cssTop: `calc(12px + (100% - ${24 + gapCount * 12}px) * ${pct / 100} + ${i * 12 + 6}px)`
    })
  }
  return handles
})

function onColumnResize(fractions: number[]) {
  liveColumnFractions.value = fractions
}

function onRowResize(fractions: number[]) {
  liveRowFractions.value = fractions
}

function onColumnResizeEnd(fractions: number[]) {
  liveColumnFractions.value = undefined
  const overrides = appModeStore.gridOverrides ?? {}
  appModeStore.setGridOverrides({ ...overrides, columnFractions: fractions })
}

function onRowResizeEnd(fractions: number[]) {
  liveRowFractions.value = undefined
  const overrides = appModeStore.gridOverrides ?? {}
  appModeStore.setGridOverrides({ ...overrides, rowFractions: fractions })
}
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
            'relative flex flex-col rounded-xl transition-colors',
            'overflow-y-auto',
            dashed
              ? 'border-2 border-dashed border-border-subtle'
              : filledZones
                ? 'border-0'
                : 'border-2 border-solid border-border-subtle',
            highlightedZone === zone.id &&
              'border-primary-background bg-primary-background/10'
          )
        "
        :data-zone-id="zone.id"
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
    <!-- Resize handle overlay — sits above zones so stacking contexts don't block it -->
    <template v-if="resizable && !isMobile">
      <ZoneResizeHandle
        v-for="handle in columnHandles"
        :key="`col-${handle.index}`"
        direction="column"
        :index="handle.index"
        :fractions="gridOverrides?.columnFractions ?? defaultColumnFractions"
        :style="{
          position: 'absolute',
          top: '0',
          bottom: '0',
          left: handle.cssLeft
        }"
        @resize="onColumnResize"
        @resize-end="onColumnResizeEnd"
      />
      <ZoneResizeHandle
        v-for="handle in rowHandles"
        :key="`row-${handle.index}`"
        direction="row"
        :index="handle.index"
        :fractions="gridOverrides?.rowFractions ?? defaultRowFractions"
        :style="{
          position: 'absolute',
          left: '0',
          right: '0',
          top: handle.cssTop
        }"
        @resize="onRowResize"
        @resize-end="onRowResizeEnd"
      />
    </template>
  </div>
</template>
