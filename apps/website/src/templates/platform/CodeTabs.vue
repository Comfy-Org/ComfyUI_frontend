<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { Check, Copy } from '@lucide/vue'
import {
  useClipboard,
  useDocumentVisibility,
  useElementVisibility,
  useIntervalFn
} from '@vueuse/core'
import { TabsContent, TabsRoot } from 'reka-ui'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import CodeTabsCode from './CodeTabsCode.vue'
import CodeTabsPicker from './CodeTabsPicker.vue'
import type { CodeLang } from '../../lib/highlight'
import type { CodeSegment } from './codeTokens'
import { tokenizeSegments } from './codeTokens'

export interface CodeTab {
  name: string
  lang: CodeLang
  segments: CodeSegment[]
  wrap?: boolean
}

const CYCLE_INTERVAL_MS = 3000

const {
  tabs,
  label,
  contentClass = 'bg-primary-comfy-ink',
  selectedIndex,
  fill = false,
  picker = 'tabs'
} = defineProps<{
  tabs: Record<string, CodeTab>
  label: string
  contentClass?: string
  listClass?: string
  triggerClass?: string
  copyLabel?: string
  copiedLabel?: string
  /** Pins every cycling segment to this value index instead of cycling. */
  selectedIndex?: number
  /** Fill the parent's height instead of sizing the panel to its longest sample. */
  fill?: boolean
  /** Offer the samples as a row of tabs or behind one dropdown. */
  picker?: 'tabs' | 'dropdown'
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

const codePanelHeights = computed(() => {
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

  const rem = maxLineCount * 1.5 + 3
  return {
    '--code-panel-h': `${rem}rem`,
    '--code-panel-h-compact': `${rem * 0.9}rem`
  }
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
    selectedIndex === undefined &&
    visible.value &&
    documentVisibility.value === 'visible' &&
    !prefersReducedMotion()
  )
    resume()
  else pause()
})

function cycleValue(values: string[]): string {
  return values[(selectedIndex ?? cycleIndex.value) % values.length]
}

const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })
const copiedTab = ref<string>()

function copyTab(tabId: string, tab: CodeTab): void {
  copiedTab.value = tabId
  void copy(codeText(tab))
}

function isCopied(tabId: string): boolean {
  return copied.value && copiedTab.value === tabId
}

function codeText(tab: CodeTab): string {
  return tab.segments
    .map((segment) =>
      typeof segment === 'string' ? segment : cycleValue(segment.values)
    )
    .join('')
}

const groupsByTab = computed(() =>
  Object.fromEntries(
    Object.entries(tabs).map(([tabId, tab]) => [
      tabId,
      tokenizeSegments(tab.segments, tab.lang, cycleValue)
    ])
  )
)
</script>

<template>
  <TabsRoot
    ref="root"
    v-model="activeTab"
    activation-mode="manual"
    :class="fill ? 'flex h-full flex-col' : 'block'"
  >
    <div class="flex flex-wrap items-center justify-between gap-4">
      <CodeTabsPicker
        v-model="activeTab"
        :tabs
        :label
        :picker
        :list-class="listClass"
        :trigger-class="triggerClass"
      />
      <slot name="controls" />
    </div>

    <TabsContent
      v-for="(tab, tabId) in tabs"
      :key="tabId"
      :value="tabId"
      :class="cn('relative mt-4 block', fill && 'flex min-h-0 flex-1 flex-col')"
    >
      <button
        v-if="copyLabel && copiedLabel"
        type="button"
        :aria-label="isCopied(tabId) ? copiedLabel : copyLabel"
        class="absolute top-4 right-4 z-10 cursor-pointer text-primary-warm-gray transition-colors hover:text-primary-comfy-canvas lg:top-5 lg:right-5"
        @click="copyTab(tabId, tab)"
      >
        <component :is="isCopied(tabId) ? Check : Copy" class="size-4" />
      </button>
      <pre
        :class="
          cn(
            'scrollbar-none overflow-auto rounded-3xl p-4 font-mono text-2xs/relaxed whitespace-pre-wrap text-primary-comfy-canvas sm:p-5 sm:text-xs/relaxed lg:p-6 lg:text-sm/relaxed',
            fill
              ? 'min-h-0 flex-1'
              : 'h-(--code-panel-h-compact) lg:h-(--code-panel-h)',
            tab.wrap && 'wrap-anywhere sm:whitespace-pre-wrap',
            copyLabel && 'pr-14',
            contentClass
          )
        "
        :style="codePanelHeights"
      ><code><CodeTabsCode
          :groups="groupsByTab[tabId]"
          :animated="selectedIndex === undefined"
        /></code></pre>
    </TabsContent>
  </TabsRoot>
</template>
