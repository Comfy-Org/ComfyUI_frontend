<script setup lang="ts">
import { reactive } from 'vue'

interface FAQItem {
  question: string
  answer: string
}

const { heading, items } = defineProps<{
  heading: string
  items: FAQItem[]
}>()

const expanded = reactive(items.map(() => true))

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
          {{ heading }}
        </h2>
      </div>

      <!-- Right FAQ list -->
      <div class="flex-1">
        <div
          v-for="(faq, index) in items"
          :key="index"
          class="border-primary-comfy-canvas/20 border-b"
        >
          <button
            :aria-expanded="expanded[index]"
            :aria-controls="`faq-panel-${index}`"
            class="flex w-full cursor-pointer items-center justify-between text-left"
            :class="index === 0 ? 'pb-6' : 'py-6'"
            @click="toggle(index)"
          >
            <span
              class="text-lg font-light md:text-xl"
              :class="
                expanded[index]
                  ? 'text-primary-comfy-yellow'
                  : 'text-primary-comfy-canvas'
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
          <div
            v-if="expanded[index]"
            :id="`faq-panel-${index}`"
            role="region"
            class="pb-6"
          >
            <p class="text-primary-comfy-canvas/70 text-sm">
              {{ faq.answer }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
