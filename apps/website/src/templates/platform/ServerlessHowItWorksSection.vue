<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  useDocumentVisibility,
  useElementVisibility,
  useIntervalFn
} from '@vueuse/core'
import { computed, ref, useId, useTemplateRef, watchEffect } from 'vue'

import TeamSharingChat from './TeamSharingChat.vue'

import SectionHeader from '../../components/common/SectionHeader.vue'
import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const endpointClipId = `how-it-works-clip-${useId()}`
const endpointFadeId = `how-it-works-fade-${useId()}`

const stepNumbers = [1, 2, 3] as const

const steps = stepNumbers.map((number) => ({
  number,
  title: t(`platform.howItWorks.${number}.title`, locale),
  description: t(`platform.howItWorks.${number}.description`, locale)
}))

const APPS = ['internal tool', 'application', 'website', 'workflow'] as const

// One workflow flows through all three steps; the examples rotate in sync.
const WORKFLOWS = [
  { file: 'try-on.json', endpoint: 'try-on-x7k2' },
  { file: 'product-photos.json', endpoint: 'product-photos' },
  { file: 'upscale-4k.json', endpoint: 'upscale-4k' }
] as const

const CYCLE_INTERVAL_MS = 5000

const root = useTemplateRef<HTMLElement>('root')
const visible = useElementVisibility(root)
const documentVisibility = useDocumentVisibility()
const workflowIndex = ref(0)

const workflow = computed(() => WORKFLOWS[workflowIndex.value])
// The dashed connectors animate stroke-dashoffset, which cannot be composited,
// so they are parked on the same condition as the rotation above rather than
// running behind a scrolled-past section. Reduced motion is handled by the
// animate-dash-flow utility itself.
const animated = computed(
  () => visible.value && documentVisibility.value === 'visible'
)

const { pause, resume } = useIntervalFn(
  () => {
    workflowIndex.value = (workflowIndex.value + 1) % WORKFLOWS.length
  },
  CYCLE_INTERVAL_MS,
  { immediate: false }
)

watchEffect(() => {
  if (
    visible.value &&
    documentVisibility.value === 'visible' &&
    !prefersReducedMotion()
  )
    resume()
  else pause()
})
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-10 lg:py-14">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('platform.serverlessDeploy.heading', locale) }}
      <template #subtitle>
        <p class="mx-auto mt-4 max-w-2xl text-sm text-smoke-700">
          {{ t('platform.serverlessDeploy.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <ol
      ref="root"
      class="mt-8 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3"
    >
      <li
        v-for="step in steps"
        :key="step.number"
        class="rounded-3xl bg-transparency-white-t4 p-5 lg:p-6"
      >
        <article class="h-full">
          <div
            aria-hidden="true"
            :class="
              cn(
                'flex h-72 items-center justify-center overflow-hidden rounded-2xl',
                step.number === 2
                  ? 'bg-transparent'
                  : 'border border-transparency-white-t4 bg-primary-comfy-ink p-4'
              )
            "
          >
            <div
              v-if="step.number === 1"
              class="flex size-full items-center justify-center"
            >
              <svg viewBox="0 0 460 357" class="size-full" aria-hidden="true">
                <defs>
                  <clipPath :id="endpointClipId">
                    <rect x=".5" y="312.5" width="459" height="44" rx="21.5" />
                  </clipPath>
                  <linearGradient
                    :id="endpointFadeId"
                    x1="425"
                    y1="0"
                    x2="459"
                    y2="0"
                    gradientUnits="userSpaceOnUse"
                    class="text-primary-comfy-ink-light"
                  >
                    <stop
                      offset="0"
                      stop-color="currentColor"
                      stop-opacity="0"
                    />
                    <stop offset="1" stop-color="currentColor" />
                  </linearGradient>
                </defs>
                <g transform="translate(100)">
                  <rect
                    width="286"
                    height="134"
                    rx="24"
                    transform="matrix(0.866025 0.5 0 1 12 0)"
                    class="fill-primary-comfy-ink stroke-primary-comfy-plum"
                  />
                  <g transform="matrix(0.866025 0.5 0 1 0 8)">
                    <rect
                      width="286"
                      height="134"
                      rx="24"
                      class="fill-site-bg-soft stroke-primary-comfy-plum"
                    />
                    <Transition name="crossfade" mode="out-in">
                      <text
                        :key="workflow.file"
                        class="fill-primary-comfy-yellow font-[Menlo,Monaco,Consolas,monospace] text-xl tracking-[0.7px]"
                      >
                        <tspan x="24" y="34">{{ workflow.file }}</tspan>
                      </text>
                    </Transition>
                    <text
                      class="fill-primary-comfy-canvas font-[Menlo,Monaco,Consolas,monospace] text-sm tracking-[0.7px] opacity-55"
                    >
                      <tspan x="24" y="72">{ "nodes": [...],</tspan>
                      <tspan x="24" y="92">"models": [...],</tspan>
                      <tspan x="24" y="112">"deps": [...] }</tspan>
                    </text>
                    <circle
                      cx="286"
                      cy="80"
                      r="9.285"
                      class="fill-primary-comfy-yellow"
                    />
                  </g>
                  <path
                    d="M247.68315 231C354 292 161.199 282 69 282"
                    :class="
                      cn(
                        'fill-none stroke-primary-comfy-yellow',
                        animated && 'animate-dash-flow'
                      )
                    "
                    stroke-dasharray="6 6"
                  />
                  <rect
                    x=".5"
                    y="262.5"
                    width="68"
                    height="39"
                    rx="15.5"
                    class="fill-transparent stroke-primary-comfy-yellow"
                  />
                  <text
                    x="13"
                    y="287.6"
                    class="fill-primary-comfy-yellow font-formula text-sm font-bold tracking-[0.7px]"
                  >
                    POST
                  </text>
                </g>
                <rect
                  x=".5"
                  y="312.5"
                  width="459"
                  height="44"
                  rx="21.5"
                  class="fill-primary-comfy-ink-light"
                />
                <Transition name="crossfade" mode="out-in">
                  <text
                    :key="workflow.endpoint"
                    x="13"
                    y="339.847"
                    class="fill-primary-comfy-canvas font-[Menlo,Monaco,Consolas,monospace] text-xl tracking-[0.7px]"
                    :clip-path="`url(#${endpointClipId})`"
                  >
                    <tspan>https://</tspan>
                    <tspan class="fill-primary-comfy-yellow">
                      {{ workflow.endpoint }}
                    </tspan>
                    <tspan>.run.comfy.app</tspan>
                  </text>
                </Transition>
                <rect
                  x="425"
                  y="312.5"
                  width="34"
                  height="44"
                  :fill="`url(#${endpointFadeId})`"
                  :clip-path="`url(#${endpointClipId})`"
                />
              </svg>
            </div>

            <div
              v-else-if="step.number === 2"
              class="flex size-full items-center justify-center"
            >
              <TeamSharingChat :locale :endpoint="workflow.endpoint" />
            </div>

            <div v-else class="flex size-full items-center justify-center">
              <svg viewBox="0 0 472 276" class="size-full" aria-hidden="true">
                <rect
                  x="0"
                  y="114"
                  width="246"
                  height="48"
                  rx="24"
                  class="fill-primary-comfy-ink-light"
                />
                <Transition name="crossfade" mode="out-in">
                  <text
                    :key="workflow.endpoint"
                    x="123"
                    y="144"
                    text-anchor="middle"
                    class="fill-primary-comfy-yellow font-[Menlo,Monaco,Consolas,monospace] text-base tracking-[0.7px]"
                  >
                    {{ workflow.endpoint }}
                  </text>
                </Transition>
                <path
                  v-for="(app, index) in APPS"
                  :key="app"
                  :d="`M 246 138 C 270 138, 266 ${22 + index * 76}, 291 ${22 + index * 76}`"
                  :class="
                    cn(
                      'fill-none stroke-primary-comfy-yellow',
                      animated && 'animate-dash-flow'
                    )
                  "
                  stroke-width="1.5"
                  stroke-dasharray="6 6"
                />
                <g v-for="app in APPS" :key="app">
                  <rect
                    x="291"
                    y="0"
                    width="181"
                    height="44"
                    rx="22"
                    class="fill-transparency-white-t4 stroke-primary-comfy-plum"
                    :transform="`translate(0 ${APPS.indexOf(app) * 76})`"
                  />
                  <circle
                    cx="291"
                    :cy="22 + APPS.indexOf(app) * 76"
                    r="8"
                    class="fill-primary-comfy-yellow"
                  />
                  <text
                    x="314"
                    :y="28 + APPS.indexOf(app) * 76"
                    class="fill-primary-comfy-canvas font-[Menlo,Monaco,Consolas,monospace] text-sm tracking-[0.7px]"
                  >
                    {{ app }}
                  </text>
                </g>
              </svg>
            </div>
          </div>

          <h3 class="mt-4 text-base font-normal text-primary-warm-white">
            {{ step.title }}
          </h3>
          <p class="mt-2 text-xs/relaxed font-light text-primary-comfy-canvas">
            {{ step.description }}
          </p>
        </article>
      </li>
    </ol>
  </section>
</template>
