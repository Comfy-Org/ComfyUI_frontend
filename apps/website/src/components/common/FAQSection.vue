<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { reactive } from 'vue'

import type { Locale, TranslationKey } from '../../i18n/translations'

import { t } from '../../i18n/translations'

const {
  locale = 'en',
  headingKey,
  faqPrefix,
  faqCount
} = defineProps<{
  locale?: Locale
  headingKey: TranslationKey
  faqPrefix: string
  faqCount: number
}>()

const faqKeys: Array<{ q: TranslationKey; a: TranslationKey }> = Array.from(
  { length: faqCount },
  (_, i) => ({
    q: `${faqPrefix}.${i + 1}.q` as TranslationKey,
    a: `${faqPrefix}.${i + 1}.a` as TranslationKey
  })
)

const faqs = faqKeys.map(({ q, a }) => ({
  question: t(q, locale),
  answer: t(a, locale)
}))

const expanded = reactive(faqs.map(() => true))

function toggle(index: number) {
  expanded[index] = !expanded[index]
}
</script>

<template>
  <section class="px-4 py-24 md:px-20 md:py-40">
    <div class="flex flex-col gap-6 md:flex-row md:gap-16">
      <!-- Left heading -->
      <div
        class="bg-primary-comfy-ink sticky top-20 z-10 w-full shrink-0 self-start py-4 md:top-28 md:w-80 md:py-0"
      >
        <h2 class="text-primary-comfy-canvas text-4xl font-light md:text-5xl">
          {{ t(headingKey, locale) }}
        </h2>
      </div>

      <!-- Right FAQ list -->
      <div class="flex-1">
        <div
          v-for="(faq, index) in faqs"
          :key="index"
          class="border-primary-comfy-canvas/20 border-b"
        >
          <button
            :id="`faq-trigger-${index}`"
            :aria-expanded="expanded[index]"
            :aria-controls="`faq-panel-${index}`"
            :class="
              cn(
                'flex w-full cursor-pointer items-center justify-between text-left',
                index === 0 ? 'pb-6' : 'py-6'
              )
            "
            @click="toggle(index)"
          >
            <span
              :class="
                cn(
                  'text-lg font-light md:text-xl',
                  expanded[index]
                    ? 'text-primary-comfy-yellow'
                    : 'text-primary-comfy-canvas'
                )
              "
            >
              {{ faq.question }}
            </span>
            <span
              class="text-primary-comfy-yellow ml-4 shrink-0 text-2xl"
              aria-hidden="true"
            >
              {{ expanded[index] ? '−' : '+' }}
            </span>
          </button>
          <section
            v-if="expanded[index]"
            :id="`faq-panel-${index}`"
            :aria-labelledby="`faq-trigger-${index}`"
            class="pb-6"
          >
            <p class="text-primary-comfy-canvas/70 text-sm whitespace-pre-line">
              {{ faq.answer }}
            </p>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>
