<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { Minus } from '@lucide/vue'
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import { parseFaqAnswer } from '../../utils/faqAnswer'
import Accordion from '../ui/accordion/Accordion.vue'
import AccordionContent from '../ui/accordion/AccordionContent.vue'
import AccordionItem from '../ui/accordion/AccordionItem.vue'
import AccordionTrigger from '../ui/accordion/AccordionTrigger.vue'

export type SplitFaq = { id: string; question: string; answer: string }

/*
 * The subbrand-surface sibling of FAQSplit01, which stays as it is for the five
 * dark pages already shipping it.
 */
const {
  faqs,
  defaultOpen,
  class: className
} = defineProps<{
  id?: string
  heading: string
  faqs: readonly SplitFaq[]
  /** Item ids expanded on load. Defaults to the first, as the design shows. */
  defaultOpen?: readonly string[]
  class?: HTMLAttributes['class']
}>()

const parsedFaqs = computed(() =>
  faqs.map((faq) => ({ ...faq, answerParts: parseFaqAnswer(faq.answer) }))
)

const openIds = computed(() =>
  defaultOpen ? [...defaultOpen] : faqs.slice(0, 1).map((faq) => faq.id)
)
</script>

<template>
  <section
    :id
    :class="
      cn(
        'max-w-9xl mx-auto px-6 py-16 lg:flex lg:gap-20 lg:px-20 lg:py-24',
        className
      )
    "
  >
    <div
      class="bg-page-bg sticky top-20 z-10 w-full shrink-0 self-start py-4 lg:top-28 lg:w-110 lg:pt-6 lg:pb-0"
    >
      <h2
        class="text-page-fg text-4xl/tight font-light tracking-[-0.03em] md:text-5xl/tight"
      >
        {{ heading }}
      </h2>
    </div>

    <Accordion
      type="multiple"
      :default-value="openIds"
      class="mt-8 flex flex-1 flex-col gap-16 lg:mt-0"
    >
      <AccordionItem
        v-for="faq in parsedFaqs"
        :key="faq.id"
        :value="faq.id"
        class="flex flex-col border-b border-primary-comfy-canvas/40 pb-8 last:border-b data-[state=open]:border-primary-comfy-canvas"
      >
        <AccordionTrigger
          :id="`faq-trigger-${faq.id}`"
          class="data-[state=open]:text-page-fg focus-visible:border-primary-comfy-plum/50 focus-visible:ring-primary-comfy-plum/50 text-page-fg gap-8 py-0 text-xl leading-[1.4] font-medium md:text-2xl"
        >
          {{ faq.question }}
          <template #icon>
            <span
              aria-hidden="true"
              class="text-primary-comfy-plum relative size-6 shrink-0"
            >
              <Minus class="pointer-events-none absolute inset-0 size-6" />
              <Minus
                class="pointer-events-none absolute inset-0 size-6 rotate-90 transition-transform duration-300 ease-out in-data-[state=open]:rotate-0"
              />
            </span>
          </template>
        </AccordionTrigger>
        <AccordionContent class="pt-10 pb-0">
          <p
            class="text-page-fg text-sm leading-[1.6] font-light wrap-break-word whitespace-pre-line"
          >
            <template
              v-for="(part, partIndex) in faq.answerParts"
              :key="partIndex"
            >
              <a
                v-if="part.type === 'link'"
                :href="part.value"
                target="_blank"
                rel="noopener noreferrer"
                class="text-page-fg focus-visible:ring-primary-comfy-plum/50 rounded-sm underline underline-offset-2 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:outline-none"
                >{{ part.label ?? part.value }}</a
              >
              <template v-else>{{ part.value }}</template>
            </template>
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </section>
</template>
