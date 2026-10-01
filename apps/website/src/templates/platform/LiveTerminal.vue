<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useDocumentVisibility, useElementVisibility } from '@vueuse/core'
import { computed, onScopeDispose, ref, useTemplateRef, watchEffect } from 'vue'

import type { CodeLang, HighlightToken } from '../../lib/highlight'
import { highlightTokens } from '../../lib/highlight'
import { prefersReducedMotion } from '../../composables/useReducedMotion'

const TYPE_MS = 35
const COMMAND_PAUSE_MS = 500
const OUTPUT_PAUSE_MS = 700
const REPLAY_HOLD_MS = 5000

const {
  lines,
  label,
  typewriter = true,
  highlightLang
} = defineProps<{
  lines: string[]
  label: string
  /** Set to false for a transcript meant to be read and copied right away
   * (e.g. a prompt), rather than watched land keystroke by keystroke. */
  typewriter?: boolean
  /** Renders the transcript through the site's Shiki syntax highlighter
   * instead of the plain sigil coloring below. Implies static rendering —
   * there is no typewriter effect for colored tokens. */
  highlightLang?: CodeLang
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
    typewriter &&
    !highlightLang &&
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
  const text =
    !typewriter || !!highlightLang || prefersReducedMotion()
      ? transcript.value
      : transcript.value.slice(0, revealedCount.value)
  return text.split('\n')
})

/** The transcript tokenized by the site's Shiki highlighter and regrouped
 * into lines (`highlightTokens` represents each line break as its own
 * `'\n'` token), for `highlightLang`. `null` when highlighting isn't
 * requested or the payload couldn't be tokenized, so `renderedLines` falls
 * back to `plainLines` below. */
const highlightedLines = computed<readonly HighlightToken[][] | null>(() => {
  if (!highlightLang) return null
  const tokens = highlightTokens(transcript.value, highlightLang)
  if (!tokens) return null
  const result: HighlightToken[][] = [[]]
  for (const token of tokens) {
    if (token.content === '\n') result.push([])
    else result.at(-1)?.push(token)
  }
  return result
})

const SIGIL_COLOR = 'var(--color-primary-comfy-yellow)'
/** Only $/✔-led lines get their leading character colored; anything else
 * (prose, blank lines) stays plain, and a blank line gets a non-breaking
 * space token so its row doesn't collapse. */
const isSigilLine = (line: string) =>
  line.startsWith('$') || line.startsWith('✔')

/** `visibleLines` recolored one token per line, so the template below has a
 * single rendering path shared with `highlightedLines`. */
const plainLines = computed<HighlightToken[][]>(() =>
  visibleLines.value.map((line) =>
    isSigilLine(line)
      ? [
          { content: line.slice(0, 1), color: SIGIL_COLOR },
          { content: line.slice(1) }
        ]
      : [{ content: line || (visibleLines.value.length > 1 ? ' ' : '') }]
  )
)

const renderedLines = computed<readonly HighlightToken[][]>(
  () => highlightedLines.value ?? plainLines.value
)

// A floor, not a fixed height: short command transcripts (the original use
// case) still get a terminal-sized panel, but a longer or wrapped line (e.g.
// prose) grows the panel instead of being clipped.
const panelHeight = computed(() => `${lines.length * 1.5 + 3}rem`)
</script>

<template>
  <div ref="root" role="img" :aria-label="label">
    <pre
      aria-hidden="true"
      class="scrollbar-none min-h-[calc(var(--panel-h)*0.9)] overflow-auto rounded-3xl bg-[#2a2230] p-4 font-mono text-2xs/relaxed whitespace-pre-wrap text-primary-comfy-canvas select-none sm:p-5 sm:text-xs/relaxed lg:min-h-(--panel-h) lg:p-6 lg:text-sm/relaxed"
      :style="{ '--panel-h': panelHeight }"
    ><code><template v-for="(tokens, index) in renderedLines" :key="index"><span
          :class="cn(index > 0 && 'block')"
        ><span
            v-for="(token, tokenIndex) in tokens"
            :key="tokenIndex"
            :style="{ color: token.color }"
            >{{ token.content }}</span
          ></span></template><span
        v-if="!highlightedLines && typewriter && !prefersReducedMotion()"
        class="animate-pulse text-primary-comfy-yellow"
      >▋</span></code></pre>
  </div>
</template>
