<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import type { Ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import { useResizeObserver, useTemplateRefsList } from '@vueuse/core'
import { onMounted, ref } from 'vue'

import { t } from '../../i18n/translations'

type TranslationKey = Parameters<typeof t>[0]
type Point = { x: number; y: number }

const {
  reasons,
  rightCardPadding = 'p-6',
  locale = 'en'
} = defineProps<{
  reasons: TranslationKey[]
  rightCardPadding?: string
  locale?: Locale
}>()

const containerRef = ref<HTMLElement>()
const ifYouDotRef = ref<HTMLElement>()
const reasonDots = useTemplateRefsList<HTMLElement>()
const reasonOutputDotRef = ref<HTMLElement>()
const comfyDotRef = ref<HTMLElement>()
const wirePaths = ref<string[]>([])
const comfyWirePath = ref('')

const mobileContainerRef = ref<HTMLElement>()
const mobileIfYouDotRef = ref<HTMLElement>()
const mobileReasonDots = useTemplateRefsList<HTMLElement>()
const mobileOutputDotRef = ref<HTMLElement>()
const mobileComfyDotRef = ref<HTMLElement>()
const mobileWirePaths = ref<string[]>([])
const mobileComfyWirePath = ref('')

function center(el: HTMLElement, container: DOMRect): Point {
  const r = el.getBoundingClientRect()
  return {
    x: r.left + r.width / 2 - container.left,
    y: r.top + r.height / 2 - container.top
  }
}

function computeWireSet(
  container: HTMLElement | undefined,
  sourceDot: HTMLElement | undefined,
  targetDots: HTMLElement[],
  outputDot: HTMLElement | undefined,
  comfyDot: HTMLElement | undefined,
  pathsRef: Ref<string[]>,
  comfyPathRef: Ref<string>,
  reasonCurve: (s: Point, e: Point, i: number) => string,
  comfyCurve: (s: Point, e: Point) => string
) {
  if (!container || !sourceDot) return
  const cRect = container.getBoundingClientRect()
  const s = center(sourceDot, cRect)

  pathsRef.value = targetDots.map((el, i) => {
    const e = center(el, cRect)
    return reasonCurve(s, e, i)
  })

  if (outputDot && comfyDot) {
    const s2 = center(outputDot, cRect)
    const e2 = center(comfyDot, cRect)
    comfyPathRef.value = comfyCurve(s2, e2)
  }
}

function computeDesktopWires() {
  computeWireSet(
    containerRef.value,
    ifYouDotRef.value,
    reasonDots.value,
    reasonOutputDotRef.value,
    comfyDotRef.value,
    wirePaths,
    comfyWirePath,
    (s, e) => {
      const midX = s.x + (e.x - s.x) * 0.45
      return `M${s.x},${s.y} C${midX},${s.y} ${midX},${e.y} ${e.x},${e.y}`
    },
    (s, e) => {
      const midX = s.x + (e.x - s.x) * 0.5
      return `M${s.x},${s.y} C${midX},${s.y} ${midX},${e.y} ${e.x},${e.y}`
    }
  )
}

function computeMobileWires() {
  computeWireSet(
    mobileContainerRef.value,
    mobileIfYouDotRef.value,
    mobileReasonDots.value,
    mobileOutputDotRef.value,
    mobileComfyDotRef.value,
    mobileWirePaths,
    mobileComfyWirePath,
    (s, e, i) => {
      const spread = (i + 1) * 14
      return `M${s.x},${s.y} C${s.x + spread},${s.y + 40} ${e.x + spread},${e.y - 40} ${e.x},${e.y}`
    },
    (s, e) => {
      const midY = s.y + (e.y - s.y) * 0.5
      return `M${s.x},${s.y} C${s.x},${midY} ${e.x},${midY} ${e.x},${e.y}`
    }
  )
}

useResizeObserver(containerRef, computeDesktopWires)
useResizeObserver(mobileContainerRef, computeMobileWires)

onMounted(() => {
  requestAnimationFrame(() => {
    computeDesktopWires()
    computeMobileWires()
  })
})
</script>

<template>
  <!-- Desktop layout -->
  <div ref="containerRef" class="relative mx-auto hidden max-w-6xl lg:block">
    <svg
      class="pointer-events-none absolute inset-0 z-10 size-full overflow-visible"
    >
      <path
        v-for="(d, i) in wirePaths"
        :key="'wire-' + i"
        :d="d"
        class="stroke-primary-comfy-yellow"
        stroke-width="1.5"
        fill="none"
      />
      <path
        v-if="comfyWirePath"
        :d="comfyWirePath"
        class="stroke-primary-comfy-yellow"
        stroke-width="1.5"
        fill="none"
      />
    </svg>

    <div class="flex items-start gap-8">
      <!-- Left column: Why + IF YOU -->
      <div class="flex w-64 shrink-0 flex-col gap-3">
        <div class="rounded-2xl border border-white/10 bg-white/5 px-6 py-5">
          <p class="text-primary-comfy-canvas text-2xl font-light">
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
            class="text-primary-comfy-canvas text-xs font-bold tracking-wider"
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
                :ref="reasonDots.set"
                class="bg-primary-comfy-yellow mt-1.5 size-2.5 shrink-0 rounded-full"
              />
              <p class="text-primary-comfy-canvas text-base">
                {{ t(reason, locale) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column: slot for card content -->
      <div
        :class="
          cn(
            'w-64 shrink-0 rounded-3xl border border-white/10 bg-white/5',
            rightCardPadding
          )
        "
      >
        <span
          class="bg-primary-comfy-yellow inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5"
        >
          <span
            ref="comfyDotRef"
            class="bg-primary-comfy-ink relative z-10 size-1.5 rounded-full"
          />
          <span
            class="bg-primary-comfy-ink h-4 w-20"
            style="mask: url(/icons/logo.svg) no-repeat center / contain"
          />
        </span>
        <slot name="right-card" />
      </div>
    </div>
  </div>

  <!-- Mobile layout -->
  <div
    ref="mobileContainerRef"
    class="relative mx-auto max-w-6xl overflow-x-clip lg:hidden"
  >
    <svg
      class="pointer-events-none absolute inset-0 z-10 size-full overflow-visible"
    >
      <path
        v-for="(d, i) in mobileWirePaths"
        :key="'m-wire-' + i"
        :d="d"
        class="stroke-primary-comfy-yellow"
        stroke-width="1.5"
        fill="none"
      />
      <path
        v-if="mobileComfyWirePath"
        :d="mobileComfyWirePath"
        class="stroke-primary-comfy-yellow"
        stroke-width="1.5"
        fill="none"
      />
    </svg>

    <div class="rounded-2xl border border-white/10 bg-white/5 px-6 py-5">
      <p class="text-primary-comfy-canvas text-2xl font-light">
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
      <span class="text-primary-comfy-canvas text-xs font-bold tracking-wider">
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
          <p class="text-primary-comfy-canvas text-base">
            {{ t(reason, locale) }}
          </p>
          <span
            :ref="mobileReasonDots.set"
            class="bg-primary-comfy-yellow mt-1.5 size-2.5 shrink-0 rounded-full"
          />
        </div>
      </div>
    </div>

    <div
      :class="
        cn(
          'mt-12 rounded-3xl border border-white/10 bg-white/5',
          rightCardPadding
        )
      "
    >
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
      <slot name="right-card-mobile" />
    </div>
  </div>
</template>
