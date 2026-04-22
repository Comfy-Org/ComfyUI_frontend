<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { onMounted, ref } from 'vue'

import { t } from '../../i18n/translations'

type TranslationKey = Parameters<typeof t>[0]

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const reasons: TranslationKey[] = [
  'careers.whyJoin.reason1',
  'careers.whyJoin.reason2',
  'careers.whyJoin.reason3',
  'careers.whyJoin.reason4',
  'careers.whyJoin.reason5'
]

const containerRef = ref<HTMLElement>()
const ifYouDotRef = ref<HTMLElement>()
const reasonDots = ref<HTMLElement[]>([])
const reasonOutputDotRef = ref<HTMLElement>()
const comfyDotRef = ref<HTMLElement>()
const wirePaths = ref<string[]>([])
const comfyWirePath = ref('')

const mobileContainerRef = ref<HTMLElement>()
const mobileIfYouDotRef = ref<HTMLElement>()
const mobileReasonDots = ref<HTMLElement[]>([])
const mobileOutputDotRef = ref<HTMLElement>()
const mobileComfyDotRef = ref<HTMLElement>()
const mobileWirePaths = ref<string[]>([])
const mobileComfyWirePath = ref('')

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

function computeMobileWires() {
  const c = mobileContainerRef.value
  const dot = mobileIfYouDotRef.value
  if (!c || !dot) return

  const cRect = c.getBoundingClientRect()
  const s = center(dot, cRect)

  mobileWirePaths.value = mobileReasonDots.value.map((el, i) => {
    const e = center(el, cRect)
    const spread = (i + 1) * 14
    return `M${s.x},${s.y} C${s.x + spread},${s.y + 40} ${e.x + spread},${e.y - 40} ${e.x},${e.y}`
  })

  const outputDot = mobileOutputDotRef.value
  const comfyDot = mobileComfyDotRef.value
  if (outputDot && comfyDot) {
    const s2 = center(outputDot, cRect)
    const e2 = center(comfyDot, cRect)
    const midY = s2.y + (e2.y - s2.y) * 0.5
    mobileComfyWirePath.value = `M${s2.x},${s2.y} C${s2.x},${midY} ${e2.x},${midY} ${e2.x},${e2.y}`
  }
}

onMounted(() => {
  requestAnimationFrame(() => {
    computeWires()
    computeMobileWires()
  })
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

        <!-- Right column: Team photo card -->
        <div
          class="w-64 shrink-0 rounded-3xl border border-white/10 bg-white/5 p-2"
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
            src="/images/about/team.webp"
            alt="Comfy team"
            class="mt-2 w-full rounded-2xl object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </div>

    <!-- Mobile layout -->
    <div ref="mobileContainerRef" class="relative mx-auto max-w-6xl lg:hidden">
      <svg
        class="pointer-events-none absolute inset-0 z-10 size-full overflow-visible"
      >
        <path
          v-for="(d, i) in mobileWirePaths"
          :key="'m-wire-' + i"
          :d="d"
          stroke="#F2FF59"
          stroke-width="1.5"
          fill="none"
        />
        <path
          v-if="mobileComfyWirePath"
          :d="mobileComfyWirePath"
          stroke="#F2FF59"
          stroke-width="1.5"
          fill="none"
        />
      </svg>

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
          ref="mobileIfYouDotRef"
          class="bg-primary-comfy-yellow ml-3 size-3 shrink-0 rounded-full"
        />
      </div>

      <div
        class="relative mt-12 rounded-3xl border border-white/10 bg-white/5 p-8"
      >
        <span
          ref="mobileOutputDotRef"
          class="bg-primary-comfy-yellow absolute right-1/3 bottom-0 z-20 size-3 translate-y-1/2 rounded-full"
        />
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
              :ref="
                (el) => {
                  if (el) mobileReasonDots.push(el as HTMLElement)
                }
              "
              class="bg-primary-comfy-yellow mt-1.5 size-2.5 shrink-0 rounded-full"
            />
          </div>
        </div>
      </div>

      <div class="mt-12 rounded-3xl border border-white/10 bg-white/5 p-2">
        <span
          class="bg-primary-comfy-yellow inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5"
        >
          <span
            ref="mobileComfyDotRef"
            class="bg-primary-comfy-ink size-1.5 rounded-full"
          />
          <span
            class="bg-primary-comfy-ink h-4 w-20"
            style="mask: url(/icons/logo.svg) no-repeat center / contain"
          />
        </span>
        <img
          src="/images/about/team.webp"
          alt="Comfy team"
          class="mt-2 w-full rounded-2xl object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  </section>
</template>
