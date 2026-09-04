<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import {
  HoverCardContent,
  HoverCardPortal,
  HoverCardRoot,
  HoverCardTrigger
} from 'reka-ui'
import { computed, nextTick, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { hubTagUrl } from '../../lib/hub/routes'
import { tagDisplayName } from '../../lib/hub/tag-aliases'

// Inside a card that is itself a link, the chips cannot be anchors.
const {
  tags,
  fallbackLabel = '',
  linkTags = true
} = defineProps<{
  tags: readonly string[]
  fallbackLabel?: string
  linkTags?: boolean
}>()

const allTags = computed(() =>
  tags.map((tag) => ({
    key: tag,
    label: tagDisplayName(tag),
    href: hubTagUrl(tag)
  }))
)

const row = ref<HTMLElement | null>(null)
const measure = ref<HTMLElement | null>(null)
const visibleCount = ref(allTags.value.length)

const OVERFLOW_RESERVE = 52
const GAP = 6

// As many whole chips as fit, then a "+N" chip; never a clipped chip.
function recompute() {
  const available = row.value?.clientWidth ?? 0
  const chips = Array.from(measure.value?.children ?? []) as HTMLElement[]
  if (!available || !chips.length) return
  const total = chips.reduce(
    (sum, c, i) => sum + c.offsetWidth + (i ? GAP : 0),
    0
  )
  if (total <= available) {
    visibleCount.value = chips.length
    return
  }
  let used = 0
  let count = 0
  for (const [i, chip] of chips.entries()) {
    const w = chip.offsetWidth + (i ? GAP : 0)
    if (used + w + GAP + OVERFLOW_RESERVE > available) break
    used += w
    count++
  }
  visibleCount.value = count
}

useResizeObserver(row, recompute)
watch(allTags, () => nextTick(recompute), { immediate: true })

const visibleTags = computed(() => allTags.value.slice(0, visibleCount.value))
const hiddenTags = computed(() => allTags.value.slice(visibleCount.value))
const pillClass =
  'inline-flex h-6 w-fit shrink-0 items-center justify-center rounded-full bg-hub-surface px-3 py-1 text-xs font-normal whitespace-nowrap text-content transition-colors'
</script>

<template>
  <div
    ref="row"
    data-testid="tag-row"
    class="relative flex h-6 min-w-0 items-center gap-1.5 overflow-hidden"
  >
    <span v-if="!allTags.length && fallbackLabel" :class="pillClass">
      {{ fallbackLabel }}
    </span>
    <template v-else>
      <component
        :is="linkTags ? 'a' : 'span'"
        v-for="tag in visibleTags"
        :key="tag.key"
        :href="linkTags ? tag.href : undefined"
        :class="cn(pillClass, linkTags && 'hover:bg-hub-surface-hover')"
        @click.stop
      >
        {{ tag.label }}
      </component>
      <HoverCardRoot v-if="hiddenTags.length" :open-delay="120">
        <HoverCardTrigger
          as="button"
          type="button"
          :aria-label="hiddenTags.map((tag) => tag.label).join(', ')"
          :class="cn(pillClass, 'cursor-default tabular-nums')"
          data-testid="tag-overflow"
          @click.prevent.stop
        >
          +{{ hiddenTags.length }}
        </HoverCardTrigger>
        <HoverCardPortal>
          <HoverCardContent
            side="top"
            align="start"
            :side-offset="6"
            class="bg-site-dropdown z-50 flex max-w-64 flex-col gap-1.5 rounded-2xl border border-white/10 p-2 shadow-2xl shadow-black/50"
            data-testid="tag-overflow-list"
          >
            <span
              v-for="tag in hiddenTags"
              :key="`o:${tag.key}`"
              :class="cn(pillClass, 'w-full justify-start')"
            >
              {{ tag.label }}
            </span>
          </HoverCardContent>
        </HoverCardPortal>
      </HoverCardRoot>
    </template>
    <div
      ref="measure"
      aria-hidden="true"
      class="pointer-events-none invisible absolute flex items-center gap-1.5"
    >
      <span v-for="tag in allTags" :key="`m:${tag.key}`" :class="pillClass">
        {{ tag.label }}
      </span>
    </div>
  </div>
</template>
