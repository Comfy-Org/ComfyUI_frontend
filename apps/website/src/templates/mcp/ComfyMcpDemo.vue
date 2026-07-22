<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { Check } from '@lucide/vue'
import { useElementVisibility } from '@vueuse/core'
import { computed, onUnmounted, ref, useTemplateRef, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { mcpDemoPrompts, thumbUrls, visibleWindow } from './mcpDemoPrompts'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const VISIBLE_CARDS = 5
const START_DELAY_MS = 2600
const TYPE_MIN_MS = 18
const TYPE_MAX_MS = 55
const AFTER_TYPING_MS = 520
const RUN_TOOL_MS = 360
const AFTER_CARD_MS = 900
const BETWEEN_PROMPTS_MS = 650

const reducedMotion = computed(prefersReducedMotion)

const promptTextClass =
  'font-formula col-start-1 row-start-1 text-[17px] leading-[1.3] font-light'
// Drop the blinking caret when the user prefers reduced motion.
const caretClass = computed(() =>
  cn(
    'bg-primary-comfy-yellow ml-0.5 inline-block h-5 w-2.25 translate-y-0.5',
    !reducedMotion.value && 'animate-cursor-blink'
  )
)

const generateLabel = t('mcp.hero.demoGenerate', locale)
const idleStatus = t('mcp.hero.demoStatusIdle', locale)

const index = ref(0)
const cards = computed(() =>
  visibleWindow(mcpDemoPrompts, index.value, VISIBLE_CARDS)
)
const nextPrompt = computed(
  () => mcpDemoPrompts[(index.value + 1) % mcpDemoPrompts.length]
)

const typed = ref(t(nextPrompt.value.promptKey, locale))
const submitting = ref(false)
const status = ref(idleStatus)

const root = useTemplateRef<HTMLElement>('root')
const visible = useElementVisibility(root)

let timer: ReturnType<typeof setTimeout> | undefined

function schedule(step: () => void, ms: number) {
  clearTimeout(timer)
  timer = setTimeout(step, ms)
}

function typeNextPrompt() {
  const text = t(nextPrompt.value.promptKey, locale)
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

    schedule(runTool, AFTER_TYPING_MS)
  }

  typeCharacter()
}

function runTool() {
  const { via, toolKey } = nextPrompt.value
  const tool = t(toolKey, locale)

  submitting.value = true
  status.value = via
    ? t('mcp.hero.demoStatusBridging', locale)
        .replace('{app}', via)
        .replace('{tool}', tool)
    : t('mcp.hero.demoStatusRunning', locale).replace('{tool}', tool)

  schedule(commitCard, RUN_TOOL_MS)
}

function commitCard() {
  submitting.value = false
  index.value = (index.value + 1) % mcpDemoPrompts.length
  status.value = idleStatus
  schedule(restBeforeNextPrompt, AFTER_CARD_MS)
}

function restBeforeNextPrompt() {
  typed.value = ''
  schedule(typeNextPrompt, BETWEEN_PROMPTS_MS)
}

// Run the demo only while on-screen and when motion is allowed. Under reduced
// motion it holds its initial fully-typed frame — no looping, no abrupt card
// swaps (which read as flashing once transitions are disabled).
watch([visible, reducedMotion], ([onScreen, reduce]) => {
  clearTimeout(timer)
  if (onScreen && !reduce) schedule(typeNextPrompt, START_DELAY_MS)
})

onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <div ref="root" class="flex flex-col gap-6">
    <div
      data-testid="mcp-demo-panel"
      class="rounded-5xl flex flex-col gap-6 bg-white/4 p-6 lg:p-8"
    >
      <!-- Every prompt, caret included, is stacked in one grid cell so the
           panel is always as tall as the longest and typing cannot reflow
           the page. -->
      <div class="grid">
        <p
          v-for="prompt in mcpDemoPrompts"
          :key="prompt.id"
          aria-hidden="true"
          :class="cn(promptTextClass, 'invisible')"
        >
          {{ t(prompt.promptKey, locale) }}<span :class="caretClass" />
        </p>

        <p :class="cn(promptTextClass, 'text-primary-comfy-canvas')">
          {{ typed }}<span :class="caretClass" />
        </p>
      </div>

      <div class="flex flex-col gap-5">
        <div class="h-px bg-white/10" />

        <div
          class="flex flex-col items-end gap-3 lg:flex-row lg:items-center lg:justify-between"
        >
          <p
            class="font-formula w-full truncate text-xs font-light text-primary-comfy-canvas/50 lg:text-sm"
          >
            {{ status }}
          </p>

          <div
            :class="
              cn(
                'bg-primary-comfy-yellow font-formula shrink-0 rounded-2xl p-3 text-sm font-extrabold tracking-[0.7px] text-primary-comfy-ink uppercase transition-transform duration-100 lg:px-4',
                submitting && 'scale-[0.97]'
              )
            "
          >
            {{ generateLabel }}
          </div>
        </div>
      </div>
    </div>

    <!-- Fixed height for a fixed card count: the window rolls rather than
         growing, so the list never resets and never moves the page. -->
    <div
      data-testid="mcp-demo-cascade"
      class="relative h-66.5 overflow-hidden lg:h-112.5"
    >
      <TransitionGroup
        name="card-slide"
        tag="div"
        :css="!reducedMotion"
        class="flex flex-col gap-2.5"
      >
        <div
          v-for="(card, i) in cards"
          :key="card.id"
          data-testid="mcp-demo-card"
          :class="
            cn(
              'flex h-20.5 items-center gap-3.5 rounded-3xl px-4',
              i === 0 ? 'bg-white/8' : 'bg-white/4'
            )
          "
        >
          <div v-if="card.variants" class="flex shrink-0 items-center gap-1.5">
            <img
              v-for="url in thumbUrls(card)"
              :key="url"
              :src="url"
              alt=""
              width="54"
              height="54"
              loading="lazy"
              decoding="async"
              class="size-9 rounded-xl object-cover lg:size-13.5"
            />
          </div>

          <!-- Offset layers behind the thumbnail read as a stack of outputs. -->
          <div
            v-else
            :class="
              cn(
                'relative isolate size-13.5 shrink-0',
                card.stacked &&
                  'before:absolute before:inset-0 before:-z-10 before:translate-1 before:rounded-[14px] before:bg-white/16 after:absolute after:inset-0 after:-z-20 after:translate-2 after:rounded-[14px] after:bg-white/8'
              )
            "
          >
            <img
              :src="thumbUrls(card)[0]"
              alt=""
              width="54"
              height="54"
              loading="lazy"
              decoding="async"
              class="size-full rounded-[14px] object-cover"
            />
          </div>

          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <p
              class="font-formula text-primary-comfy-yellow line-clamp-2 text-xs font-extrabold tracking-[0.7px] uppercase lg:text-sm"
            >
              {{ t(card.toolKey, locale) }}
            </p>
            <p
              class="font-formula truncate text-sm font-light text-primary-comfy-canvas"
            >
              {{ card.result }}
            </p>
          </div>

          <span
            v-if="card.via"
            class="font-formula relative isolate hidden h-8 shrink-0 items-center justify-center overflow-visible bg-transparent px-3 text-xs font-extrabold tracking-[0.7px] text-white/60 uppercase before:absolute before:inset-0 before:-z-10 before:-skew-x-12 before:rounded-sm before:bg-white/20 lg:inline-flex lg:px-5 lg:text-sm"
          >
            <span class="ppformula-text-center">
              {{ card.via }}
            </span>
          </span>

          <Check
            class="text-primary-comfy-yellow hidden size-4 shrink-0 lg:block"
            :stroke-width="2"
          />
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>
