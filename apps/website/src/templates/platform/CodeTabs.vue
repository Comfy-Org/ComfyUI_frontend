<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  useDocumentVisibility,
  useElementVisibility,
  useIntervalFn
} from '@vueuse/core'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'

/**
 * A segment is either static code, or a set of values the tab cycles
 * through in lockstep with every other cycling segment (index-synced, so a
 * model id and its matching prompt/filename change together).
 */
type CodeSegment = string | { values: string[]; highlight?: boolean }

export interface CodeTab {
  name: string
  segments: CodeSegment[]
}

const CYCLE_INTERVAL_MS = 3000

const {
  tabs,
  label,
  contentClass = 'bg-primary-comfy-ink'
} = defineProps<{
  tabs: Record<string, CodeTab>
  label: string
  contentClass?: string
  listClass?: string
}>()

const activeTab = ref(Object.keys(tabs)[0])
const cycleIndex = ref(0)

const root = useTemplateRef<HTMLElement>('root')
const visible = useElementVisibility(root)
const documentVisibility = useDocumentVisibility()

const hasCycle = computed(() =>
  Object.values(tabs).some((tab) =>
    tab.segments.some((segment) => typeof segment !== 'string')
  )
)

function lineBreakCount(segment: CodeSegment): number {
  const values = typeof segment === 'string' ? [segment] : segment.values
  return Math.max(0, ...values.map((value) => value.split('\n').length - 1))
}

const codePanelHeight = computed(() => {
  const maxLineCount = Math.max(
    1,
    ...Object.values(tabs).map(
      (tab) =>
        1 +
        tab.segments.reduce(
          (total, segment) => total + lineBreakCount(segment),
          0
        )
    )
  )

  return `${maxLineCount * 1.5 + 3}rem`
})

const { pause, resume } = useIntervalFn(
  () => {
    cycleIndex.value += 1
  },
  CYCLE_INTERVAL_MS,
  { immediate: false }
)

watchEffect(() => {
  if (
    hasCycle.value &&
    visible.value &&
    documentVisibility.value === 'visible' &&
    !prefersReducedMotion()
  )
    resume()
  else pause()
})

function cycleValue(values: string[]): string {
  return values[cycleIndex.value % values.length]
}
</script>

<template>
  <TabsRoot
    ref="root"
    v-model="activeTab"
    activation-mode="manual"
    class="block"
  >
    <TabsList
      :aria-label="label"
      :class="
        cn(
          'flex w-full max-w-full scrollbar-none overflow-x-auto rounded-2xl border border-white/15 bg-primary-comfy-ink p-1 sm:inline-flex sm:w-auto',
          listClass
        )
      "
    >
      <TabsTrigger
        v-for="(tab, tabId) in tabs"
        :key="tabId"
        :value="tabId"
        class="focus-visible:ring-primary-comfy-yellow/50 data-[state=active]:bg-secondary-mauve flex-1 cursor-pointer rounded-xl px-1 py-2 text-center text-[10px] font-bold tracking-normal whitespace-nowrap text-smoke-700 uppercase transition-colors hover:text-primary-comfy-canvas focus-visible:ring-2 focus-visible:outline-none data-[state=active]:text-primary-warm-white sm:flex-none sm:px-5 sm:text-xs sm:tracking-wider"
      >
        {{ tab.name }}
      </TabsTrigger>
    </TabsList>

    <TabsContent
      v-for="(tab, tabId) in tabs"
      :key="tabId"
      :value="tabId"
      class="mt-4 block"
    >
      <pre
        :class="
          cn(
            'h-[calc(var(--code-panel-h)*0.9)] scrollbar-none overflow-auto rounded-3xl p-4 font-mono text-2xs/relaxed whitespace-pre-wrap text-primary-comfy-canvas sm:p-5 sm:text-xs/relaxed sm:whitespace-pre lg:h-(--code-panel-h) lg:p-6 lg:text-sm/relaxed',
            contentClass
          )
        "
        :style="{ '--code-panel-h': codePanelHeight }"
      ><code><template
          v-for="(segment, index) in tab.segments"
          :key="index"
        ><Transition
            v-if="typeof segment !== 'string'"
            name="crossfade"
            mode="out-in"
          ><span
              :key="cycleValue(segment.values)"
              :class="cn(segment.highlight && 'text-primary-comfy-yellow')"
            >{{ cycleValue(segment.values) }}</span></Transition><template
            v-else
          >{{ segment }}</template></template></code></pre>
    </TabsContent>
  </TabsRoot>
</template>
