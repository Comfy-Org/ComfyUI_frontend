<script setup lang="ts">
import {
  useDocumentVisibility,
  useElementVisibility,
  useIntervalFn
} from '@vueuse/core'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'

import SectionHeader from '../../components/common/SectionHeader.vue'
import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const stepNumbers = [1, 2, 3] as const

const steps = stepNumbers.map((number) => ({
  number,
  title: t(`platform.howItWorks.${number}.title`, locale),
  description: t(`platform.howItWorks.${number}.description`, locale)
}))

const TEAM = ['JH', 'BF', 'JN']

const APPS = ['Internal tool', 'Application', 'Website', 'Workflow'] as const

// One workflow flows through all three steps; the examples rotate in sync.
const WORKFLOWS = [
  { file: 'virtual-try-on.json', endpoint: 'try-on-x7k2' },
  { file: 'product-photos.json', endpoint: 'product-photos' },
  { file: 'upscale-4k.json', endpoint: 'upscale-4k' }
] as const

const CYCLE_INTERVAL_MS = 5000

const root = useTemplateRef<HTMLElement>('root')
const visible = useElementVisibility(root)
const documentVisibility = useDocumentVisibility()
const workflowIndex = ref(0)

const workflow = computed(() => WORKFLOWS[workflowIndex.value])

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
            class="border-transparency-white-t4 flex min-h-52 items-center justify-center overflow-hidden rounded-2xl border bg-primary-comfy-ink p-4"
          >
            <div
              v-if="step.number === 1"
              class="flex size-full flex-col items-center justify-center gap-1"
            >
              <div
                class="border-transparency-white-t4 bg-transparency-ink-t80 w-full max-w-60 rounded-xl border p-3 font-mono text-sm/relaxed text-primary-comfy-canvas"
              >
                <Transition name="crossfade" mode="out-in">
                  <p :key="workflow.file" class="text-primary-comfy-yellow">
                    {{ workflow.file }}
                  </p>
                </Transition>
                <p class="mt-1 text-smoke-700">{ "nodes": [...],</p>
                <p class="text-smoke-700">&nbsp;&nbsp;"models": [...],</p>
                <p class="text-smoke-700">&nbsp;&nbsp;"deps": [...] }</p>
              </div>
              <svg viewBox="0 0 8 18" class="h-4.5 w-2" aria-hidden="true">
                <line
                  x1="4"
                  y1="0"
                  x2="4"
                  y2="18"
                  class="animate-dash-flow stroke-primary-comfy-yellow/60"
                  stroke-width="1.5"
                  stroke-dasharray="4 5"
                />
              </svg>
              <div
                class="border-primary-comfy-yellow/40 bg-primary-comfy-yellow/5 w-full max-w-60 rounded-xl border px-3 py-1.5 text-center font-mono text-sm text-primary-comfy-canvas"
              >
                <span class="text-primary-comfy-yellow">POST&#32;</span>
                <Transition name="crossfade" mode="out-in">
                  <span :key="workflow.endpoint" class="break-all"
                    >https://{{ workflow.endpoint }}.run.comfy.app</span
                  >
                </Transition>
              </div>
            </div>

            <div
              v-else-if="step.number === 2"
              class="flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap lg:flex-nowrap"
            >
              <div
                class="border-primary-comfy-yellow/40 bg-primary-comfy-yellow/5 max-w-full rounded-full border px-3 py-2 text-center font-mono text-sm text-primary-comfy-canvas"
              >
                <Transition name="crossfade" mode="out-in">
                  <span :key="workflow.endpoint" class="break-all">
                    {{ workflow.endpoint }}
                  </span>
                </Transition>
              </div>
              <svg viewBox="0 0 28 8" class="h-2 w-7" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="28"
                  y2="4"
                  class="animate-dash-flow stroke-primary-comfy-canvas/40"
                  stroke-width="1.5"
                  stroke-dasharray="4 5"
                />
              </svg>
              <div class="flex -space-x-2">
                <span
                  v-for="member in TEAM"
                  :key="member"
                  class="bg-transparency-white-t4 flex size-9 items-center justify-center rounded-full border-2 border-primary-comfy-ink font-mono text-sm text-primary-comfy-canvas"
                >
                  {{ member }}
                </span>
              </div>
            </div>

            <div
              v-else
              class="flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:flex-wrap lg:flex-nowrap"
            >
              <div
                class="border-primary-comfy-yellow/40 bg-primary-comfy-yellow/5 max-w-full shrink-0 rounded-full border px-3 py-2 text-center font-mono text-sm text-primary-comfy-canvas"
              >
                <Transition name="crossfade" mode="out-in">
                  <span :key="workflow.endpoint" class="break-all">
                    {{ workflow.endpoint }}
                  </span>
                </Transition>
              </div>
              <svg
                viewBox="0 0 40 96"
                class="h-20 w-5 shrink-0"
                aria-hidden="true"
              >
                <path
                  v-for="(app, index) in APPS"
                  :key="app"
                  :d="`M 0 48 C 20 48, 20 ${12 + index * 24}, 40 ${12 + index * 24}`"
                  class="animate-dash-flow fill-none stroke-primary-comfy-canvas/40"
                  stroke-width="1.5"
                  stroke-dasharray="4 5"
                />
              </svg>
              <div class="flex flex-col gap-1">
                <span
                  v-for="app in APPS"
                  :key="app"
                  class="border-transparency-white-t4 bg-transparency-white-t4 rounded-md border px-1 py-0.5 font-mono text-sm text-primary-comfy-canvas"
                >
                  {{ app }}
                </span>
              </div>
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
