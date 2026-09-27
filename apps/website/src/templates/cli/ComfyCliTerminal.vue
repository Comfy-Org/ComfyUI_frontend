<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useElementVisibility } from '@vueuse/core'
import { computed, onUnmounted, ref, useTemplateRef, watchEffect } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { TerminalLine } from './cliTerminalSequences'
import { cliTerminalSequences } from './cliTerminalSequences'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const START_DELAY_MS = 1200
const TYPE_MIN_MS = 14
const TYPE_MAX_MS = 40
const AFTER_CMD_MS = 420
const OUTPUT_DELAY_MS = 550
const HOLD_MS = 2600
const BETWEEN_SEQUENCES_MS = 700

const TITLE = 'comfy — zsh'
const PROMPT = '$ '
const CHECK = '✓ '

const lineClass = 'font-mono text-xs leading-relaxed break-words lg:text-sm'
const caretClass =
  'bg-primary-comfy-yellow animate-cursor-blink ml-0.5 inline-block h-3.5 w-1.75 translate-y-0.5'

const sequenceIndex = ref(0)
const revealedCount = ref(0)
const typed = ref('')
const typing = ref(false)

const activeSequence = computed(
  () => cliTerminalSequences[sequenceIndex.value % cliTerminalSequences.length]
)

const root = useTemplateRef<HTMLElement>('root')
const visible = useElementVisibility(root)

let timer: ReturnType<typeof setTimeout> | undefined

function schedule(step: () => void, ms: number) {
  clearTimeout(timer)
  timer = setTimeout(step, ms)
}

function revealNextLine() {
  const lines = activeSequence.value.lines
  if (revealedCount.value >= lines.length) {
    schedule(advanceSequence, HOLD_MS)
    return
  }

  const line = lines[revealedCount.value]
  if (line.kind === 'cmd') {
    typeCommand(line.text)
    return
  }

  schedule(() => {
    revealedCount.value += 1
    revealNextLine()
  }, OUTPUT_DELAY_MS)
}

function typeCommand(text: string) {
  typing.value = true
  typed.value = ''

  let typedLength = 0
  function typeCharacter() {
    typedLength += 1
    typed.value = text.slice(0, typedLength)

    if (typedLength < text.length) {
      schedule(
        typeCharacter,
        TYPE_MIN_MS + Math.random() * (TYPE_MAX_MS - TYPE_MIN_MS)
      )
      return
    }

    schedule(() => {
      typing.value = false
      revealedCount.value += 1
      revealNextLine()
    }, AFTER_CMD_MS)
  }

  typeCharacter()
}

function advanceSequence() {
  sequenceIndex.value = (sequenceIndex.value + 1) % cliTerminalSequences.length
  revealedCount.value = 0
  typed.value = ''
  schedule(revealNextLine, BETWEEN_SEQUENCES_MS)
}

function displayText(line: TerminalLine, index: number): string {
  const isTypingLine =
    line.kind === 'cmd' && typing.value && index === revealedCount.value
  const body = isTypingLine ? typed.value : line.text
  if (line.kind === 'cmd') return PROMPT + body
  if (line.kind === 'ok') return CHECK + body
  return body
}

function isVisibleLine(index: number): boolean {
  if (index < revealedCount.value) return true
  return typing.value && index === revealedCount.value
}

watchEffect(() => {
  clearTimeout(timer)
  if (prefersReducedMotion()) {
    typing.value = false
    typed.value = ''
    revealedCount.value = activeSequence.value.lines.length
    return
  }
  if (visible.value) schedule(revealNextLine, START_DELAY_MS)
})

onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <div
    ref="root"
    data-testid="cli-terminal"
    role="img"
    :aria-label="t('cli.hero.terminalAria', locale)"
    class="rounded-5xl flex flex-col overflow-hidden bg-white/4"
  >
    <div class="flex items-center gap-2 border-b border-white/10 px-5 py-4">
      <span class="size-2.5 rounded-full bg-white/15" />
      <span class="size-2.5 rounded-full bg-white/15" />
      <span class="size-2.5 rounded-full bg-white/15" />
      <span class="ml-3 font-mono text-xs text-white/40">{{ TITLE }}</span>
    </div>

    <!-- Every sequence is stacked invisibly in the same grid cell so the
         panel is always as tall as the longest and typing never reflows
         the page. -->
    <div class="grid p-5 lg:p-6">
      <div
        v-for="sequence in cliTerminalSequences"
        :key="sequence.id"
        aria-hidden="true"
        class="invisible col-start-1 row-start-1 flex flex-col gap-2"
      >
        <p v-for="(line, i) in sequence.lines" :key="i" :class="lineClass">
          {{ displayText(line, -1) }}
        </p>
      </div>

      <div class="col-start-1 row-start-1 flex flex-col gap-2">
        <template v-for="(line, i) in activeSequence.lines" :key="i">
          <p
            v-if="isVisibleLine(i)"
            :class="
              cn(
                lineClass,
                line.kind === 'cmd' && 'text-primary-comfy-canvas',
                line.kind === 'out' && 'text-white/50',
                line.kind === 'ok' && 'text-primary-comfy-yellow'
              )
            "
          >
            {{ displayText(line, i)
            }}<span
              v-if="line.kind === 'cmd' && typing && i === revealedCount"
              :class="caretClass"
            />
          </p>
        </template>
        <p v-if="!typing && revealedCount === 0" :class="lineClass">
          <span class="text-primary-comfy-canvas">{{ PROMPT }}</span
          ><span :class="caretClass" />
        </p>
      </div>
    </div>
  </div>
</template>
