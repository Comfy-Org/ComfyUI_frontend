<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  useDocumentVisibility,
  useElementVisibility,
  useIntervalFn
} from '@vueuse/core'
import { computed, ref, useId, useTemplateRef, watchEffect } from 'vue'

import SectionHeader from '../../components/common/SectionHeader.vue'
import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const outerTrackId = useId()
const innerTrackId = useId()
const endpointClipId = useId()
const endpointFadeId = useId()

const stepNumbers = [1, 2, 3] as const

const steps = stepNumbers.map((number) => ({
  number,
  title: t(`platform.howItWorks.${number}.title`, locale),
  description: t(`platform.howItWorks.${number}.description`, locale)
}))

const TEAM_OUTER_PATH =
  'M188 -43.68 C204.64 -43.68 221.28 -38.56 235.36 -29.6 L385.12 57.44 C403.04 67.68 413.28 86.88 413.28 107.36 V268.64 C413.28 289.12 403.04 308.32 385.12 318.56 L235.36 405.6 C205.92 422.24 170.08 422.24 140.64 405.6 L-9.12 318.56 C-27.04 308.32 -37.28 289.12 -37.28 268.64 V107.36 C-37.28 86.88 -27.04 67.68 -9.12 57.44 L140.64 -29.6 C154.72 -38.56 171.36 -43.68 188 -43.68 Z'
const TEAM_INNER_PATH =
  'M188 22.8 C201.2 22.8 213.1 26.7 225 33.3 L317.5 87.5 C332 95.5 341.3 111.4 341.3 128.5 V247.5 C341.3 264.6 332 280.5 317.5 288.5 L225 342.7 C202.6 356 173.4 356 151 342.7 L58.5 288.5 C44 280.5 34.7 264.6 34.7 247.5 V128.5 C34.7 111.4 44 95.5 58.5 87.5 L151 33.3 C162.1 26.7 174.8 22.8 188 22.8 Z'

const TEAM = [
  {
    initials: 'JP',
    x: -37.28,
    y: 188,
    track: `#${outerTrackId}`,
    delay: '-13.5s'
  },
  {
    initials: 'JN',
    x: 310.24,
    y: 13.92,
    track: `#${outerTrackId}`,
    delay: '-1.8s'
  },
  {
    initials: 'BH',
    x: 271.25,
    y: 315.6,
    track: `#${innerTrackId}`,
    delay: '-7.2s'
  }
] as const

const TEAM_OUTLINES = [
  ['dotted', 'yellow', 'purple'],
  ['dotted', 'purple', 'yellow'],
  ['yellow', 'dotted', 'purple'],
  ['yellow', 'purple', 'dotted'],
  ['purple', 'dotted', 'yellow'],
  ['purple', 'yellow', 'dotted']
] as const

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
const outlineIndex = ref(0)

const workflow = computed(() => WORKFLOWS[workflowIndex.value])
const team = computed(() =>
  TEAM.map((member, index) => ({
    ...member,
    outline: TEAM_OUTLINES[outlineIndex.value][index]
  }))
)

// The dashed connectors animate stroke-dashoffset, which cannot be composited,
// so they are parked on the same condition as the rotation above rather than
// running behind a scrolled-past section. Reduced motion is handled by the
// animate-dash-flow utility itself.
const animated = computed(
  () => visible.value && documentVisibility.value === 'visible'
)
const orbiting = computed(() => animated.value && !prefersReducedMotion())

const { pause, resume } = useIntervalFn(
  () => {
    workflowIndex.value = (workflowIndex.value + 1) % WORKFLOWS.length
    outlineIndex.value =
      (outlineIndex.value +
        1 +
        Math.floor(Math.random() * (TEAM_OUTLINES.length - 1))) %
      TEAM_OUTLINES.length
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
  <section class="max-w-9xl mx-auto px-6 py-10 lg:py-14">
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
        class="bg-transparency-white-t4 rounded-3xl p-5 lg:p-6"
      >
        <article class="h-full">
          <div
            aria-hidden="true"
            class="border-transparency-white-t4 flex h-72 items-center justify-center overflow-hidden rounded-2xl border bg-primary-comfy-ink p-4"
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
                    class="stroke-primary-comfy-plum fill-primary-comfy-ink"
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
                        :key="workflow.endpoint"
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
                        'stroke-primary-comfy-yellow fill-none',
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
                    class="stroke-primary-comfy-yellow fill-transparent"
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
                    :key="workflow.file"
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
              <svg
                viewBox="-72 -78 520 532"
                class="size-full"
                aria-hidden="true"
              >
                <path
                  :id="outerTrackId"
                  :d="TEAM_OUTER_PATH"
                  class="stroke-primary-comfy-plum fill-none"
                />
                <path
                  :id="innerTrackId"
                  :d="TEAM_INNER_PATH"
                  class="stroke-primary-comfy-plum fill-none"
                />
                <g
                  v-for="member in team"
                  :key="member.initials"
                  :transform="
                    orbiting ? undefined : `translate(${member.x} ${member.y})`
                  "
                >
                  <animateMotion
                    v-if="orbiting"
                    dur="18s"
                    :begin="member.delay"
                    repeatCount="indefinite"
                  >
                    <mpath :href="member.track" />
                  </animateMotion>
                  <circle
                    cx="0"
                    cy="0"
                    r="28"
                    :class="
                      cn(
                        'fill-primary-comfy-ink transition-[stroke] duration-700 motion-reduce:transition-none',
                        member.outline === 'purple'
                          ? 'stroke-primary-comfy-plum'
                          : 'stroke-primary-comfy-yellow',
                        animated &&
                          member.outline === 'dotted' &&
                          'animate-dash-flow'
                      )
                    "
                    :stroke-width="member.outline === 'purple' ? 1 : 2.5"
                    :stroke-dasharray="
                      member.outline === 'dotted' ? '7 6' : undefined
                    "
                  />
                  <text
                    x="0"
                    y="5"
                    text-anchor="middle"
                    class="fill-primary-comfy-yellow font-[Menlo,Monaco,Consolas,monospace] text-base"
                  >
                    {{ member.initials }}
                  </text>
                </g>
                <rect
                  x="74"
                  y="163"
                  width="228"
                  height="48"
                  rx="24"
                  class="fill-primary-comfy-ink-light"
                />
                <Transition name="crossfade" mode="out-in">
                  <text
                    :key="workflow.endpoint"
                    x="188"
                    y="193"
                    text-anchor="middle"
                    class="fill-primary-comfy-yellow font-[Menlo,Monaco,Consolas,monospace] text-2xl tracking-[0.7px]"
                  >
                    {{ workflow.endpoint }}
                  </text>
                </Transition>
              </svg>
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
                      'stroke-primary-comfy-yellow fill-none',
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
