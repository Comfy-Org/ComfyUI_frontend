<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useDocumentVisibility, useElementVisibility } from '@vueuse/core'
import { computed, onScopeDispose, ref, useTemplateRef, watchEffect } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'

const TYPE_MS = 35
const COMMAND_PAUSE_MS = 500
const OUTPUT_PAUSE_MS = 700
const REPLAY_HOLD_MS = 5000

const { lines, label } = defineProps<{
  lines: string[]
  label: string
}>()

/** Reveal targets over the joined transcript: commands appear one keystroke
 * at a time, output lines land whole after a beat, as if the run just
 * finished that step. */
const steps = computed(() => {
  const targets: { upTo: number; delay: number }[] = []
  let revealed = 0
  for (const [index, line] of lines.entries()) {
    const newline = index > 0 ? 1 : 0
    if (line.startsWith('$')) {
      for (let char = 1; char <= line.length; char++) {
        targets.push({
          upTo: revealed + newline + char,
          delay: char === 1 ? COMMAND_PAUSE_MS : TYPE_MS
        })
      }
    } else {
      targets.push({
        upTo: revealed + newline + line.length,
        delay: OUTPUT_PAUSE_MS
      })
    }
    revealed += newline + line.length
  }
  return targets
})

const transcript = computed(() => lines.join('\n'))
const revealedCount = ref(0)

const root = useTemplateRef<HTMLElement>('root')
const onScreen = useElementVisibility(root)
const documentVisibility = useDocumentVisibility()

let timer: ReturnType<typeof setTimeout> | undefined
let stepIndex = 0

function schedule() {
  clearTimeout(timer)
  const step = steps.value[stepIndex]
  if (step) {
    timer = setTimeout(() => {
      revealedCount.value = step.upTo
      stepIndex += 1
      schedule()
    }, step.delay)
  } else {
    timer = setTimeout(() => {
      revealedCount.value = 0
      stepIndex = 0
      schedule()
    }, REPLAY_HOLD_MS)
  }
}

watchEffect(() => {
  if (
    onScreen.value &&
    documentVisibility.value === 'visible' &&
    !prefersReducedMotion()
  ) {
    schedule()
  } else {
    clearTimeout(timer)
  }
})
onScopeDispose(() => clearTimeout(timer))

const visibleLines = computed(() => {
  const text = prefersReducedMotion()
    ? transcript.value
    : transcript.value.slice(0, revealedCount.value)
  return text.split('\n')
})

// A floor, not a fixed height: short command transcripts (the original use
// case) still get a terminal-sized panel, but a longer or wrapped line (e.g.
// prose) grows the panel instead of being clipped.
const panelHeight = computed(() => `${lines.length * 1.5 + 3}rem`)
/** Only $/✔-led lines get their leading character typed and highlighted;
 * anything else (prose, blank lines) reveals whole and stays plain, and a
 * blank line gets a non-breaking space so its row doesn't collapse. */
const isSigilLine = (line: string) =>
  line.startsWith('$') || line.startsWith('✔')
</script>

<template>
  <div ref="root" role="img" :aria-label="label">
    <pre
      aria-hidden="true"
      class="scrollbar-none min-h-[calc(var(--panel-h)*0.9)] overflow-auto rounded-3xl bg-[#2a2230] p-4 font-mono text-2xs/relaxed whitespace-pre-wrap text-primary-comfy-canvas select-none sm:p-5 sm:text-xs/relaxed lg:min-h-(--panel-h) lg:p-6 lg:text-sm/relaxed"
      :style="{ '--panel-h': panelHeight }"
    ><code><template v-for="(line, index) in visibleLines" :key="index"><span
          :class="cn(index > 0 && 'block')"
        ><template v-if="isSigilLine(line)"><span class="text-primary-comfy-yellow">{{ line.slice(0, 1) }}</span>{{
          line.slice(1)
        }}</template><template v-else>{{ line || ' ' }}</template></span></template><span
        v-if="!prefersReducedMotion()"
        class="animate-pulse text-primary-comfy-yellow"
      >▋</span></code></pre>
  </div>
</template>
