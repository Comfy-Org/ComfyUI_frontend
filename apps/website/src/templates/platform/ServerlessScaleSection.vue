<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import ServerlessAutoscaleAnimation from './ServerlessAutoscaleAnimation.vue'
import ServerlessLogsAnimation from './ServerlessLogsAnimation.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

type SlotShape = 'circle' | 'square' | 'diamond'

type SlotColumn = {
  duration: number
  offset: number
  shapes: SlotShape[]
  steps: number
}

const slotShapeOrder = ['circle', 'square', 'diamond'] as const
const slotXPositions = [86, 144, 200] as const
const slotFills = ['#3a3161', '#5d4fa3', 'url(#convergence-shape)'] as const

const slotColumns = ref<SlotColumn[]>(
  slotXPositions.map(() => ({
    duration: 0,
    offset: 0,
    shapes: [...slotShapeOrder],
    steps: 0
  }))
)

const slotAnimating = ref(false)
let slotInterval: number | undefined
let slotResetTimeout: number | undefined

function randomShape(): SlotShape {
  return slotShapeOrder[Math.floor(Math.random() * slotShapeOrder.length)]
}

function spinSlots() {
  slotAnimating.value = true
  slotColumns.value = slotColumns.value.map((column, index) => {
    const steps = 3 + Math.floor(Math.random() * 3)
    const incoming = Array.from({ length: steps }, randomShape)

    return {
      duration: 700 + index * 130 + Math.floor(Math.random() * 120),
      offset: steps * -100,
      shapes: [...column.shapes.slice(0, 3), ...incoming],
      steps
    }
  })

  const resetDelay = Math.max(
    ...slotColumns.value.map(({ duration }) => duration)
  )

  slotResetTimeout = window.setTimeout(() => {
    slotAnimating.value = false
    slotColumns.value = slotColumns.value.map(({ shapes, steps }) => ({
      duration: 0,
      offset: 0,
      shapes: shapes.slice(steps, steps + 3),
      steps: 0
    }))
  }, resetDelay + 50)
}

onMounted(() => {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    slotInterval = window.setInterval(spinSlots, 3000)
  }
})

onBeforeUnmount(() => {
  window.clearInterval(slotInterval)
  window.clearTimeout(slotResetTimeout)
})
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:py-14">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('platform.serverlessScale.heading', locale) }}
      <template #subtitle>
        <p class="mx-auto mt-4 max-w-2xl text-sm text-smoke-700">
          {{ t('platform.serverlessScale.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <div class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <!-- Autoscaling: a stepped worker line tracking a dashed demand curve -->
      <article class="bg-transparency-white-t4 rounded-3xl p-5 lg:p-6">
        <div
          aria-hidden="true"
          class="flex aspect-video items-center overflow-hidden rounded-2xl border border-white/10 bg-primary-comfy-ink p-4"
        >
          <ServerlessAutoscaleAnimation />
        </div>
        <h3 class="mt-4 text-base font-normal text-primary-warm-white">
          {{ t('platform.serverlessScale.1.title', locale) }}
        </h3>
        <p class="mt-2 text-xs/relaxed font-light text-primary-comfy-canvas">
          {{ t('platform.serverlessScale.1.description', locale) }}
        </p>
      </article>

      <!-- Logs: a console panel streaming rows -->
      <article class="bg-transparency-white-t4 rounded-3xl p-5 lg:p-6">
        <div
          aria-hidden="true"
          class="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-primary-comfy-ink"
        >
          <ServerlessLogsAnimation />
        </div>
        <h3 class="mt-4 text-base font-normal text-primary-warm-white">
          {{ t('platform.serverlessScale.2.title', locale) }}
        </h3>
        <p class="mt-2 text-xs/relaxed font-light text-primary-comfy-canvas">
          {{ t('platform.serverlessScale.2.description', locale) }}
        </p>
      </article>

      <!-- Any workflow & model: the ecosystem converging on one endpoint -->
      <article class="bg-transparency-white-t4 rounded-3xl p-5 lg:p-6">
        <div
          aria-hidden="true"
          class="flex aspect-video items-center overflow-hidden rounded-2xl border border-white/10 bg-primary-comfy-ink p-4"
        >
          <svg viewBox="0 0 760 420" class="size-full">
            <defs>
              <pattern
                id="convergence-dots"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <circle
                  cx="1.2"
                  cy="1.2"
                  r="1.1"
                  fill="#7a68ce"
                  opacity="0.14"
                />
              </pattern>
              <radialGradient
                id="convergence-dotfade"
                cx="50%"
                cy="50%"
                r="72%"
              >
                <stop offset="0" stop-color="#fff" />
                <stop offset="1" stop-color="#fff" stop-opacity="0.2" />
              </radialGradient>
              <mask id="convergence-dotmask">
                <rect
                  width="760"
                  height="420"
                  fill="url(#convergence-dotfade)"
                />
              </mask>
              <linearGradient
                id="convergence-shape"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" stop-color="#6B5CB8" />
                <stop offset="1" stop-color="#4A3E85" />
              </linearGradient>
              <clipPath
                v-for="(x, index) in slotXPositions"
                :id="`slot-column-${index}`"
                :key="x"
              >
                <rect :x="x - 21" y="80" width="42" height="260" />
              </clipPath>
            </defs>

            <rect
              width="760"
              height="420"
              fill="url(#convergence-dots)"
              mask="url(#convergence-dotmask)"
            />

            <g
              fill="none"
              stroke="#7a68ce"
              stroke-width="2"
              stroke-dasharray="2 10"
              stroke-linecap="round"
              opacity="0.75"
            >
              <path d="M218,110 C340,112 430,180 520,204" />
              <path d="M218,210 C330,210 420,210 520,210" />
              <path d="M218,310 C340,308 430,240 520,216" />
            </g>

            <g
              v-for="(column, columnIndex) in slotColumns"
              :key="slotXPositions[columnIndex]"
              :clip-path="`url(#slot-column-${columnIndex})`"
            >
              <g
                class="slot-reel"
                :class="{ 'slot-reel--animating': slotAnimating }"
                :style="{
                  transform: `translateY(${column.offset}px)`,
                  transitionDuration: `${column.duration}ms`
                }"
              >
                <g
                  v-for="(shape, shapeIndex) in column.shapes"
                  :key="shapeIndex"
                  :transform="`translate(${slotXPositions[columnIndex]} ${110 + shapeIndex * 100})`"
                >
                  <circle
                    v-if="shape === 'circle'"
                    r="17"
                    :fill="slotFills[columnIndex]"
                  />
                  <rect
                    v-else-if="shape === 'square'"
                    x="-16"
                    y="-16"
                    width="32"
                    height="32"
                    rx="9"
                    :fill="slotFills[columnIndex]"
                  />
                  <rect
                    v-else
                    x="-14"
                    y="-14"
                    width="28"
                    height="28"
                    rx="7"
                    :fill="slotFills[columnIndex]"
                    transform="rotate(45)"
                  />
                </g>
              </g>
            </g>

            <g transform="translate(590 210) scale(0.68) translate(-380 -210)">
              <path
                class="convergence-ring"
                d="M406.0,85.0 Q380.0,70.0 354.0,85.0 L284.7,125.0 Q258.8,140.0 258.8,170.0 L258.8,250.0 Q258.8,280.0 284.7,295.0 L354.0,335.0 Q380.0,350.0 406.0,335.0 L475.3,295.0 Q501.2,280.0 501.2,250.0 L501.2,170.0 Q501.2,140.0 475.3,125.0 Z"
                fill="none"
                stroke="var(--color-primary-comfy-yellow)"
                stroke-width="1.6"
              />
            </g>
            <svg
              x="553.5"
              y="170"
              width="73"
              height="80"
              viewBox="0 0 93 102"
              fill="none"
            >
              <path
                d="M51.4104 100.502L84.2773 81.5373C88.6465 79.0163 92.1885 72.8853 92.1885 67.8433V29.9147C92.1885 26.7211 89.6378 22.4511 86.8717 20.8551L54.0046 1.89075C49.6354 -0.630226 42.5516 -0.630241 38.1824 1.89075L5.31545 20.8549C2.54929 22.451 0 26.721 0 29.9147V67.8433C9.41183e-07 72.8853 3.54197 79.0163 7.91116 81.5373L40.778 100.502C43.5497 102.101 48.6388 102.101 51.4104 100.502Z"
                fill="var(--color-primary-comfy-yellow)"
              />
            </svg>
            <circle
              cx="520"
              cy="210"
              r="4"
              fill="var(--color-primary-comfy-yellow)"
            />
          </svg>
        </div>
        <h3 class="mt-4 text-base font-normal text-primary-warm-white">
          {{ t('platform.serverlessScale.3.title', locale) }}
        </h3>
        <p class="mt-2 text-xs/relaxed font-light text-primary-comfy-canvas">
          {{ t('platform.serverlessScale.3.description', locale) }}
        </p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.slot-reel {
  transform-box: view-box;
  will-change: transform;
}

.slot-reel--animating {
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.22, 0.8, 0.24, 1);
}

.convergence-ring {
  transform-box: fill-box;
  transform-origin: center;
  animation: convergence-ringload 7s ease-in-out infinite;
}

@keyframes convergence-ringload {
  0%,
  100% {
    transform: scale(0.9);
    opacity: 0.5;
  }
  30%,
  62% {
    transform: scale(1);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .slot-reel {
    transition: none;
  }

  .convergence-ring {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
