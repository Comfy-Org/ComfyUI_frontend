<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import { parseFaqAnswer } from '../../utils/faqAnswer'
import Accordion from '../ui/accordion/Accordion.vue'
import AccordionContent from '../ui/accordion/AccordionContent.vue'
import AccordionItem from '../ui/accordion/AccordionItem.vue'
import AccordionTrigger from '../ui/accordion/AccordionTrigger.vue'

type Faq = { id: string; question: string; answer: string }

const { faqs, compact = false } = defineProps<{
  id?: string
  heading: string
  faqs: readonly Faq[]
  compact?: boolean
}>()

const parsedFaqs = computed(() =>
  faqs.map((faq) => ({ ...faq, answerParts: parseFaqAnswer(faq.answer) }))
)
</script>

<template>
  <section :id class="max-w-9xl mx-auto px-4 py-16 lg:px-20 lg:py-24">
    <div class="flex flex-col gap-6 md:flex-row md:gap-16">
      <div
        class="sticky top-20 z-10 w-full shrink-0 self-start bg-primary-comfy-ink py-4 md:top-28 md:w-80 md:py-0"
      >
        <h2
          :class="
            cn(
              'font-light text-primary-comfy-canvas',
              compact ? 'text-2xl md:text-3xl' : 'text-4xl md:text-5xl'
            )
          "
        >
          {{ heading }}
        </h2>
      </div>

      <Accordion type="multiple" :unmount-on-hide="false" class="flex-1">
        <AccordionItem
          v-for="(faq, index) in parsedFaqs"
          :key="faq.id"
          :value="faq.id"
        >
          <AccordionTrigger
            :id="`faq-trigger-${faq.id}`"
            :class="cn(index === 0 && 'pt-0')"
          >
            {{ faq.question }}
          </AccordionTrigger>
          <AccordionContent>
            <p
              class="text-sm wrap-break-word whitespace-pre-line text-primary-comfy-canvas/70"
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
                  class="text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 rounded-sm underline underline-offset-2 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:outline-none"
                  >{{ part.label ?? part.value }}</a
                >
                <template v-else>{{ part.value }}</template>
              </template>
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  </section>
</template>
