<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { Check, Copy } from '@lucide/vue'
import {
  useClipboard,
  useDocumentVisibility,
  useElementVisibility,
  useIntervalFn
} from '@vueuse/core'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
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
  fill = false
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

// The crossfade only runs when the key changes; a pinned value patches in place.
function crossfadeKey(value: string): string | undefined {
  return selectedIndex === undefined ? value : undefined
}

const { copy, copied } = useClipboard({ copiedDuring: 2000 })

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
      <TabsList
        :aria-label="label"
        :class="
          cn(
            'scrollbar-none flex w-full max-w-full overflow-x-auto rounded-2xl border border-white/15 bg-primary-comfy-ink p-1 sm:inline-flex sm:w-auto',
            listClass
          )
        "
      >
        <TabsTrigger
          v-for="(tab, tabId) in tabs"
          :key="tabId"
          :value="tabId"
          :class="
            cn(
              'flex-1 cursor-pointer rounded-xl px-1 py-2 text-center text-[10px] font-bold tracking-normal whitespace-nowrap text-smoke-700 uppercase transition-colors hover:text-primary-comfy-canvas focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none data-[state=active]:bg-secondary-mauve data-[state=active]:text-primary-warm-white sm:flex-none sm:px-5 sm:text-xs sm:tracking-wider',
              triggerClass
            )
          "
        >
          <span class="ppformula-text-center">{{ tab.name }}</span>
        </TabsTrigger>
      </TabsList>
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
        :aria-label="copied ? copiedLabel : copyLabel"
        class="absolute top-4 right-4 z-10 cursor-pointer text-primary-warm-gray transition-colors hover:text-primary-comfy-canvas lg:top-5 lg:right-5"
        @click="void copy(codeText(tab))"
      >
        <component :is="copied ? Check : Copy" class="size-4" />
      </button>
      <pre
        :class="
          cn(
            'scrollbar-none overflow-auto rounded-3xl p-4 font-mono text-2xs/relaxed whitespace-pre-wrap text-primary-comfy-canvas sm:p-5 sm:text-xs/relaxed lg:p-6 lg:text-sm/relaxed',
            fill
              ? 'min-h-0 flex-1'
              : 'h-[calc(var(--code-panel-h)*0.9)] lg:h-(--code-panel-h)',
            tab.wrap && 'wrap-anywhere sm:whitespace-pre-wrap',
            copyLabel && 'pr-14',
            contentClass
          )
        "
        :style="{ '--code-panel-h': codePanelHeight }"
      ><code><template
          v-for="(group, index) in groupsByTab[tabId]"
          :key="index"
        ><Transition
            v-if="group.kind === 'cycle'"
            name="crossfade"
            mode="out-in"
          ><span
              :key="crossfadeKey(group.value)"
              :class="cn(group.highlight && 'text-primary-comfy-yellow')"
            ><template v-if="group.highlight">{{ group.value }}</template><template
                v-else
              ><span
                  v-for="(token, tokenIndex) in group.tokens"
                  :key="tokenIndex"
                  :style="{ color: token.color }"
                >{{ token.content }}</span></template></span></Transition><template
            v-else
          ><span
              v-for="(token, tokenIndex) in group.tokens"
              :key="tokenIndex"
              :style="{ color: token.color }"
            >{{ token.content }}</span></template></template></code></pre>
    </TabsContent>
  </TabsRoot>
</template>
