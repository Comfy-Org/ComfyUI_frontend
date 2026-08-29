<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import FeatureCard from './FeatureCard.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// Log-stream mock: [timestamp width, message width, highlighted?]
const logRows = [
  [48, 120, false],
  [48, 168, true],
  [48, 96, false],
  [48, 144, false],
  [48, 112, true]
] as const

// Ecosystem clusters feeding the endpoint: models, custom nodes, partner models
const clusterYs = [22, 60, 98]
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
      <FeatureCard
        :title="t('platform.serverlessScale.1.title', locale)"
        :description="t('platform.serverlessScale.1.description', locale)"
      >
        <template #visual>
          <div
            aria-hidden="true"
            class="flex aspect-video items-center overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4"
          >
            <svg viewBox="0 0 240 120" class="size-full">
              <path
                d="M 8 96 C 48 88, 64 44, 96 36 C 128 28, 144 60, 176 52 C 200 46, 216 24, 232 20"
                class="animate-dash-flow fill-none stroke-primary-comfy-canvas/40"
                stroke-width="1.5"
                stroke-dasharray="5 5"
              />
              <path
                d="M 8 104 H 48 V 72 H 88 V 48 H 128 V 64 H 168 V 40 H 208 V 28 H 232"
                class="stroke-primary-comfy-yellow fill-none"
                stroke-width="2"
              />
              <path
                d="M 8 104 H 48 V 72 H 88 V 48 H 128 V 64 H 168 V 40 H 208 V 28 H 232 V 112 H 8 Z"
                class="fill-primary-comfy-yellow/10"
              />
            </svg>
          </div>
        </template>
      </FeatureCard>

      <!-- Logs: a console panel streaming rows -->
      <FeatureCard
        :title="t('platform.serverlessScale.2.title', locale)"
        :description="t('platform.serverlessScale.2.description', locale)"
      >
        <template #visual>
          <div
            aria-hidden="true"
            class="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black/40"
          >
            <div
              class="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5"
            >
              <span class="size-2 rounded-full bg-white/15" />
              <span class="size-2 rounded-full bg-white/15" />
              <span class="size-2 rounded-full bg-white/15" />
            </div>
            <div class="space-y-2.5 px-4 py-3">
              <div
                v-for="([stamp, message, highlighted], index) in logRows"
                :key="index"
                class="animate-gpu-pulse flex items-center gap-2"
                :style="{
                  animationDelay: `${index * 0.45}s`,
                  animationDuration: '3.2s'
                }"
              >
                <span
                  class="h-1.5 rounded-full bg-white/15"
                  :style="{ width: `${stamp}px` }"
                />
                <span
                  class="size-1.5 shrink-0 rounded-full"
                  :class="
                    highlighted ? 'bg-primary-comfy-yellow' : 'bg-white/25'
                  "
                />
                <span
                  class="h-1.5 rounded-full"
                  :class="
                    highlighted ? 'bg-primary-comfy-yellow/50' : 'bg-white/15'
                  "
                  :style="{ width: `${message}px` }"
                />
              </div>
            </div>
          </div>
        </template>
      </FeatureCard>

      <!-- Any workflow & model: the ecosystem converging on one endpoint -->
      <FeatureCard
        :title="t('platform.serverlessScale.3.title', locale)"
        :description="t('platform.serverlessScale.3.description', locale)"
      >
        <template #visual>
          <div
            aria-hidden="true"
            class="flex aspect-video items-center overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4"
          >
            <svg viewBox="0 0 240 120" class="size-full">
              <g v-for="y in clusterYs" :key="y">
                <path
                  :d="`M 64 ${y} C 110 ${y}, 130 60, 168 60`"
                  class="animate-dash-flow fill-none stroke-primary-comfy-canvas/40"
                  stroke-width="1.5"
                  stroke-dasharray="5 5"
                />
              </g>
              <circle
                cx="24"
                cy="22"
                r="5"
                class="fill-primary-comfy-canvas/60"
              />
              <circle
                cx="40"
                cy="22"
                r="5"
                class="fill-primary-comfy-canvas/35"
              />
              <circle
                cx="56"
                cy="22"
                r="5"
                class="fill-primary-comfy-canvas/80"
              />
              <rect
                x="20"
                y="56"
                width="9"
                height="9"
                rx="2"
                class="fill-primary-comfy-canvas/60"
              />
              <rect
                x="36"
                y="56"
                width="9"
                height="9"
                rx="2"
                class="fill-primary-comfy-canvas/35"
              />
              <rect
                x="52"
                y="56"
                width="9"
                height="9"
                rx="2"
                class="fill-primary-comfy-canvas/80"
              />
              <polygon
                points="24,92 30,98 24,104 18,98"
                class="fill-primary-comfy-canvas/60"
              />
              <polygon
                points="40,92 46,98 40,104 34,98"
                class="fill-primary-comfy-canvas/35"
              />
              <polygon
                points="56,92 62,98 56,104 50,98"
                class="fill-primary-comfy-canvas/80"
              />
              <circle
                cx="188"
                cy="60"
                r="24"
                class="animate-ripple stroke-primary-comfy-yellow/40 fill-none"
              />
              <circle
                cx="188"
                cy="60"
                r="11"
                class="fill-primary-comfy-yellow"
              />
            </svg>
          </div>
        </template>
      </FeatureCard>
    </div>
  </section>
</template>
