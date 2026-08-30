<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import ServerlessAutoscaleAnimation from './ServerlessAutoscaleAnimation.vue'
import ServerlessLogsAnimation from './ServerlessLogsAnimation.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
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
              <radialGradient
                id="convergence-core-glow"
                cx="50%"
                cy="50%"
                r="50%"
              >
                <stop offset="0" stop-color="#EFF75A" stop-opacity="0.30" />
                <stop offset="0.55" stop-color="#EFF75A" stop-opacity="0.08" />
                <stop offset="1" stop-color="#EFF75A" stop-opacity="0" />
              </radialGradient>
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

            <g>
              <circle cx="86" cy="110" r="17" fill="#3a3161" />
              <circle cx="144" cy="110" r="17" fill="#5d4fa3" />
              <circle cx="200" cy="110" r="17" fill="url(#convergence-shape)" />
            </g>

            <g>
              <rect
                x="70"
                y="194"
                width="32"
                height="32"
                rx="9"
                fill="#3a3161"
              />
              <rect
                x="128"
                y="194"
                width="32"
                height="32"
                rx="9"
                fill="#5d4fa3"
              />
              <rect
                x="184"
                y="194"
                width="32"
                height="32"
                rx="9"
                fill="url(#convergence-shape)"
              />
            </g>

            <g>
              <rect
                x="72"
                y="296"
                width="28"
                height="28"
                rx="7"
                fill="#3a3161"
                transform="rotate(45 86 310)"
              />
              <rect
                x="130"
                y="296"
                width="28"
                height="28"
                rx="7"
                fill="#5d4fa3"
                transform="rotate(45 144 310)"
              />
              <rect
                x="186"
                y="296"
                width="28"
                height="28"
                rx="7"
                fill="url(#convergence-shape)"
                transform="rotate(45 200 310)"
              />
            </g>

            <circle
              cx="590"
              cy="210"
              r="150"
              fill="url(#convergence-core-glow)"
            />
            <circle
              cx="590"
              cy="210"
              r="86"
              fill="none"
              stroke="var(--color-primary-comfy-yellow)"
              stroke-width="1.5"
              opacity="0.85"
            />
            <circle
              cx="590"
              cy="210"
              r="40"
              fill="var(--color-primary-comfy-yellow)"
            />
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
