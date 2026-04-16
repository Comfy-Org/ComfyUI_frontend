<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { onMounted, ref } from 'vue'

import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

type TranslationKey = Parameters<typeof t>[0]

const reasons: TranslationKey[] = [
  'about.careers.reason1',
  'about.careers.reason2',
  'about.careers.reason3',
  'about.careers.reason4'
]

const containerRef = ref<HTMLElement>()
const ifYouDotRef = ref<HTMLElement>()
const reasonDots = ref<HTMLElement[]>([])
const reasonOutputDotRef = ref<HTMLElement>()
const comfyDotRef = ref<HTMLElement>()
const wirePaths = ref<string[]>([])
const comfyWirePath = ref('')

function center(el: HTMLElement, container: DOMRect) {
  const r = el.getBoundingClientRect()
  return {
    x: r.left + r.width / 2 - container.left,
    y: r.top + r.height / 2 - container.top
  }
}

function computeWires() {
  const c = containerRef.value
  const dot = ifYouDotRef.value
  if (!c || !dot) return

  const cRect = c.getBoundingClientRect()
  const s = center(dot, cRect)

  wirePaths.value = reasonDots.value.map((el) => {
    const e = center(el, cRect)
    const midX = s.x + (e.x - s.x) * 0.45
    return `M${s.x},${s.y} C${midX},${s.y} ${midX},${e.y} ${e.x},${e.y}`
  })

  const outputDot = reasonOutputDotRef.value
  const comfyDot = comfyDotRef.value
  if (outputDot && comfyDot) {
    const s2 = center(outputDot, cRect)
    const e2 = center(comfyDot, cRect)
    const midX = s2.x + (e2.x - s2.x) * 0.5
    comfyWirePath.value = `M${s2.x},${s2.y} C${midX},${s2.y} ${midX},${e2.y} ${e2.x},${e2.y}`
  }
}

onMounted(() => {
  requestAnimationFrame(computeWires)
})
</script>

<template>
  <section class="px-6 py-24 lg:px-20 lg:py-32">
    <!-- Desktop layout -->
    <div ref="containerRef" class="relative mx-auto hidden max-w-6xl lg:block">
      <!-- SVG wires overlay -->
      <svg
        class="pointer-events-none absolute inset-0 z-10 size-full overflow-visible"
      >
        <path
          v-for="(d, i) in wirePaths"
          :key="'wire-' + i"
          :d="d"
          stroke="#F2FF59"
          stroke-width="1.5"
          fill="none"
        />
        <path
          v-if="comfyWirePath"
          :d="comfyWirePath"
          stroke="#F2FF59"
          stroke-width="1.5"
          fill="none"
        />
      </svg>

      <div class="flex items-start gap-8">
        <!-- Left column: Why + IF YOU -->
        <div class="flex w-64 shrink-0 flex-col gap-3">
          <div class="rounded-2xl border border-white/10 bg-white/5 px-6 py-5">
            <p class="text-primary-warm-white text-2xl font-light">
              {{ t('about.careers.whyTitleBefore', locale) }}
              <br />
              <span
                class="bg-primary-comfy-yellow mb-0.5 inline-block h-5 w-16 align-middle"
                style="mask: url(/icons/logo.svg) no-repeat center / contain"
              />{{ t('about.careers.whyTitleAfter', locale) }}
            </p>
          </div>
          <div
            class="flex items-center justify-end rounded-xl bg-white/5 px-5 py-3"
          >
            <span
              class="text-primary-warm-white text-xs font-bold tracking-wider"
            >
              {{ t('about.careers.whyLabel', locale) }}
            </span>
            <span
              ref="ifYouDotRef"
              class="bg-primary-comfy-yellow ml-3 size-3 shrink-0 rounded-full"
            />
          </div>
        </div>

        <!-- Center column: Reasons card -->
        <div class="relative flex-1">
          <span
            ref="reasonOutputDotRef"
            class="bg-primary-comfy-yellow absolute top-1/3 right-0 z-20 size-3 translate-x-1/2 -translate-y-1/2 rounded-full"
          />
          <div class="rounded-3xl border border-white/10 bg-white/5 px-10 py-8">
            <div class="flex flex-col gap-6">
              <div
                v-for="reason in reasons"
                :key="reason"
                class="flex items-start gap-3"
              >
                <span
                  :ref="
                    (el) => {
                      if (el) reasonDots.push(el as HTMLElement)
                    }
                  "
                  class="bg-primary-comfy-yellow mt-1.5 size-2.5 shrink-0 rounded-full"
                />
                <p class="text-primary-warm-white text-base">
                  {{ t(reason, locale) }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Right column: Comfy logo card -->
        <div
          class="w-64 shrink-0 rounded-3xl border border-white/10 bg-white/5 p-6"
        >
          <span
            class="bg-primary-comfy-yellow inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5"
          >
            <span
              ref="comfyDotRef"
              class="bg-primary-comfy-ink size-1.5 rounded-full"
            />
            <span
              class="bg-primary-comfy-ink h-4 w-20"
              style="mask: url(/icons/logo.svg) no-repeat center / contain"
            />
          </span>
          <img
            src="/images/about/c.webp"
            alt="Comfy logo"
            class="mt-6 w-full"
          />
        </div>
      </div>
    </div>

    <!-- Mobile layout -->
    <div class="mx-auto max-w-6xl lg:hidden">
      <div class="rounded-2xl border border-white/10 bg-white/5 px-6 py-5">
        <p class="text-primary-warm-white text-2xl font-light">
          {{ t('about.careers.whyTitleBefore', locale) }}
          <br />
          <span
            class="bg-primary-comfy-yellow mb-0.5 inline-block h-5 w-16 align-middle"
            style="mask: url(/icons/logo.svg) no-repeat center / contain"
          />{{ t('about.careers.whyTitleAfter', locale) }}
        </p>
      </div>

      <div
        class="mt-3 flex items-center justify-end rounded-xl bg-white/5 px-5 py-3"
      >
        <span class="text-primary-warm-white text-xs font-bold tracking-wider">
          {{ t('about.careers.whyLabel', locale) }}
        </span>
        <span
          class="bg-primary-comfy-yellow ml-3 size-3 shrink-0 rounded-full"
        />
      </div>

      <div class="mt-12 rounded-3xl border border-white/10 bg-white/5 p-8">
        <div class="flex flex-col gap-6">
          <div
            v-for="reason in reasons"
            :key="reason"
            class="flex items-start justify-between gap-4"
          >
            <p class="text-primary-warm-white text-base">
              {{ t(reason, locale) }}
            </p>
            <span
              class="bg-primary-comfy-yellow mt-1.5 size-2.5 shrink-0 rounded-full"
            />
          </div>
        </div>
      </div>

      <div class="mt-12 rounded-3xl border border-white/10 bg-white/5 p-6">
        <span
          class="bg-primary-comfy-yellow inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5"
        >
          <span class="bg-primary-comfy-ink size-1.5 rounded-full" />
          <span
            class="bg-primary-comfy-ink h-4 w-20"
            style="mask: url(/icons/logo.svg) no-repeat center / contain"
          />
        </span>
        <img
          src="/images/about/c.webp"
          alt="Comfy logo"
          class="mt-6 w-full max-w-xs"
        />
      </div>
    </div>
  </section>
</template>
