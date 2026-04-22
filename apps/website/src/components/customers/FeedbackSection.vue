<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const feedbacks = [
  {
    quote: 'customers.feedback.quote1' as const,
    name: 'customers.feedback.name1' as const,
    role: 'customers.feedback.role1' as const
  },
  {
    quote: 'customers.feedback.quote2' as const,
    name: 'customers.feedback.name2' as const,
    role: 'customers.feedback.role2' as const
  },
  {
    quote: 'customers.feedback.quote3' as const,
    name: 'customers.feedback.name3' as const,
    role: 'customers.feedback.role3' as const
  }
]

const trackRef = ref<HTMLElement>()
const progress = ref(0)

function updateProgress() {
  const el = trackRef.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  progress.value = max > 0 ? el.scrollLeft / max : 0
}

function scroll(direction: -1 | 1) {
  const el = trackRef.value
  if (!el) return
  el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' })
}

const progressPercent = computed(() => `${progress.value * 100}%`)

onMounted(() => {
  trackRef.value?.addEventListener('scroll', updateProgress, { passive: true })
})

onUnmounted(() => {
  trackRef.value?.removeEventListener('scroll', updateProgress)
})
</script>

<template>
  <section class="px-6 py-16 lg:px-16 lg:py-24">
    <!-- Scrollable track -->
    <div
      ref="trackRef"
      class="scrollbar-none flex snap-x snap-mandatory gap-12 overflow-x-auto lg:gap-20"
    >
      <div
        v-for="(fb, i) in feedbacks"
        :key="i"
        class="bg-transparency-white-t4 flex w-full shrink-0 snap-start flex-col justify-between rounded-3xl p-8 lg:w-3/4 lg:p-12"
      >
        <p class="text-primary-comfy-canvas text-2xl/relaxed font-light">
          "{{ t(fb.quote, locale) }}"
        </p>
        <div class="mt-12">
          <p class="text-primary-comfy-yellow text-base font-medium">
            {{ t(fb.name, locale) }},
          </p>
          <p class="text-primary-comfy-yellow text-base font-medium">
            {{ t(fb.role, locale) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="mt-10 flex items-center gap-4">
      <!-- Progress bar -->
      <div class="h-1 flex-1 rounded-full bg-white/20">
        <div
          class="bg-primary-comfy-yellow h-full rounded-full transition-all duration-200"
          :style="{ width: progressPercent }"
        />
      </div>

      <!-- Prev -->
      <button
        class="flex size-10 items-center justify-center rounded-full border border-white/20 text-white/60 transition-colors hover:border-white/40"
        :aria-label="locale === 'zh-CN' ? '上一条' : 'Previous'"
        @click="scroll(-1)"
      >
        <img
          src="/icons/arrow-right.svg"
          alt=""
          class="size-3 rotate-180 opacity-60 invert"
        />
      </button>

      <!-- Next -->
      <button
        class="bg-primary-comfy-yellow flex size-10 items-center justify-center rounded-full transition-opacity hover:opacity-90"
        :aria-label="locale === 'zh-CN' ? '下一条' : 'Next'"
        @click="scroll(1)"
      >
        <img src="/icons/arrow-right.svg" alt="" class="size-3" />
      </button>
    </div>
  </section>
</template>
