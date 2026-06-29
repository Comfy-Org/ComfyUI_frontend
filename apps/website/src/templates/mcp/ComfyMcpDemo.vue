<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const PROMPT = t('mcp.hero.demoPrompt', locale)
const generateLabel = t('mcp.hero.demoGenerate', locale)

const cards = [
  {
    actionKey: 'mcp.hero.demoActionGenerateImage',
    file: 'moodboard_v1.png · 6-up',
    tag: 'Gmail',
    thumb: '/images/mcp/mcp-thumb-moodboard.webp'
  },
  {
    actionKey: 'mcp.hero.demoActionGenerateImage',
    file: 'concepts_01–03.png',
    tag: 'Notion',
    thumb: '/images/mcp/mcp-thumb-concepts.webp'
  },
  {
    actionKey: 'mcp.hero.demoActionGenerateImage',
    file: 'hero_keyart.png',
    tag: 'Figma',
    thumb: '/images/mcp/mcp-thumb-keyart.webp'
  },
  {
    actionKey: 'mcp.hero.demoActionGenerate3d',
    file: 'asphalt_pbr/ · 5 maps',
    tag: 'Blender',
    thumb: '/images/mcp/mcp-thumb-asphalt.webp'
  },
  {
    actionKey: 'mcp.hero.demoActionUpscale',
    file: 'kaiju_neon_4k.png · 4096',
    tag: null,
    thumb: '/images/mcp/mcp-thumb-kaiju.webp'
  }
] as const

const visibleCount = ref(0)
const displayedPrompt = ref('')
const promptDone = ref(false)

const displayedCards = computed(() =>
  cards
    .slice(0, visibleCount.value)
    .map((card) => ({ ...card, action: t(card.actionKey, locale) }))
)

let timer: ReturnType<typeof setTimeout> | null = null
let active = false

function schedule(fn: () => void, ms: number) {
  timer = setTimeout(() => {
    if (active) fn()
  }, ms)
}

function typePrompt(onDone: () => void) {
  displayedPrompt.value = ''
  promptDone.value = false
  let i = 0

  function step() {
    i++
    displayedPrompt.value = PROMPT.slice(0, i)
    if (i < PROMPT.length) {
      schedule(step, 35)
    } else {
      promptDone.value = true
      schedule(onDone, 350)
    }
  }

  schedule(step, 50)
}

function revealNextCard() {
  if (visibleCount.value >= cards.length) {
    // All done — pause then reset
    schedule(() => {
      visibleCount.value = 0
      schedule(revealNextCard, 500)
    }, 2500)
    return
  }

  // Type the prompt, then slide in the next card
  typePrompt(() => {
    visibleCount.value++
    schedule(revealNextCard, 400)
  })
}

onMounted(() => {
  active = true
  schedule(revealNextCard, 600)
})

onUnmounted(() => {
  active = false
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Prompt panel -->
    <div
      class="flex flex-col justify-between gap-8 overflow-hidden rounded-[40px] bg-white/4 p-8"
    >
      <p
        class="font-formula text-[17px] leading-relaxed font-light text-primary-comfy-canvas"
      >
        {{ displayedPrompt
        }}<span
          class="bg-primary-comfy-yellow ml-0.5 inline-block h-[22px] w-2 translate-y-0.5"
          :class="promptDone ? 'animate-cursor-blink' : ''"
        />
      </p>

      <div class="flex items-center gap-3">
        <div class="h-px flex-1 bg-white/10" />
        <div
          class="bg-primary-comfy-yellow font-formula rounded-2xl px-4 py-3 text-sm font-extrabold tracking-[0.7px] text-primary-comfy-ink uppercase"
        >
          {{ generateLabel }}
        </div>
      </div>
    </div>

    <!-- Cards accumulate — each slides in from the right after its prompt cycle -->
    <div class="flex flex-col gap-2.5 overflow-hidden">
      <TransitionGroup name="card-slide">
        <div
          v-for="(card, i) in displayedCards"
          :key="card.file"
          class="flex items-center gap-3.5 overflow-hidden rounded-3xl px-4 py-3.5"
          :class="i === 0 ? 'bg-white/8' : 'bg-white/4'"
        >
          <img
            :src="card.thumb"
            :alt="card.action"
            class="size-[54px] shrink-0 rounded-[14px] object-cover"
          />

          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <p
              class="font-formula text-primary-comfy-yellow text-xs font-extrabold tracking-[0.7px] uppercase"
            >
              {{ card.action }}
            </p>
            <p
              class="font-formula truncate text-sm font-light text-primary-comfy-canvas"
            >
              {{ card.file }}
            </p>
          </div>

          <span
            v-if="card.tag"
            class="font-formula inline-flex h-8 shrink-0 items-center bg-white/20 px-5 text-xs font-extrabold tracking-[0.7px] text-white/60 uppercase"
            style="
              clip-path: polygon(
                0.875rem 0%,
                100% 0%,
                calc(100% - 0.875rem) 100%,
                0% 100%
              );
            "
          >
            {{ card.tag }}
          </span>

          <svg
            class="size-4 shrink-0 text-primary-comfy-canvas/60"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M3 8.5l3 3L13 5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>
