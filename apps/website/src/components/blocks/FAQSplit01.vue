<script setup lang="ts">
import Accordion from '../ui/accordion/Accordion.vue'
import AccordionContent from '../ui/accordion/AccordionContent.vue'
import AccordionItem from '../ui/accordion/AccordionItem.vue'
import AccordionTrigger from '../ui/accordion/AccordionTrigger.vue'

type Faq = { id: string; question: string; answer: string }

defineProps<{
  heading: string
  faqs: readonly Faq[]
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-4 py-24 md:px-20 md:py-40">
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
      <Accordion type="multiple" class="flex-1">
        <AccordionItem
          v-for="(faq, index) in faqs"
          :key="faq.id"
          :value="faq.id"
        >
          <AccordionTrigger :class="index === 0 ? 'pt-0' : ''">
            {{ faq.question }}
          </AccordionTrigger>
          <AccordionContent>
            <p class="text-sm whitespace-pre-line text-primary-comfy-canvas/70">
              {{ faq.answer }}
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  </section>
</template>
