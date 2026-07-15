<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { reactive, watch } from 'vue'

import { resolveRel } from '../../utils/cta'

type FaqLink = { href: string; label: string; target?: '_blank' }
type Faq = { id: string; question: string; answer: string; link?: FaqLink }

const { faqs } = defineProps<{
  heading: string
  faqs: readonly Faq[]
}>()

const expanded = reactive<boolean[]>(faqs.map(() => false))

watch(
  () => faqs.length,
  (length) => {
    if (length === expanded.length) return
    expanded.length = 0
    for (let i = 0; i < length; i += 1) expanded.push(false)
  }
)

function toggle(index: number) {
  expanded[index] = !expanded[index]
}
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <div class="flex flex-col gap-6 md:flex-row md:gap-16">
      <!-- Left heading -->
      <div
        class="sticky top-20 z-10 w-full shrink-0 self-start bg-primary-comfy-ink py-4 md:top-28 md:w-80 md:py-0"
      >
        <h2 class="text-4xl font-light text-primary-comfy-canvas md:text-5xl">
          {{ heading }}
        </h2>
      </div>

      <!-- Right FAQ list -->
      <div class="flex-1">
        <div
          v-for="(faq, index) in faqs"
          :key="faq.id"
          class="border-b border-primary-comfy-canvas/20"
        >
          <button
            :id="`faq-trigger-${faq.id}`"
            type="button"
            :aria-expanded="expanded[index]"
            :aria-controls="`faq-panel-${faq.id}`"
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
            v-show="expanded[index]"
            :id="`faq-panel-${faq.id}`"
            role="region"
            :aria-labelledby="`faq-trigger-${faq.id}`"
            class="pb-6"
          >
            <p class="text-sm whitespace-pre-line text-primary-comfy-canvas/70">
              {{ faq.answer }}
            </p>
            <a
              v-if="faq.link"
              :href="faq.link.href"
              :target="faq.link.target"
              :rel="resolveRel(faq.link)"
              class="text-primary-comfy-yellow mt-4 inline-block text-sm hover:underline"
            >
              {{ faq.link.label }}
            </a>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>
