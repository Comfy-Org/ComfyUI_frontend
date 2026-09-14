<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { resolveRel } from '../../utils/cta'

import Accordion from '../ui/accordion/Accordion.vue'
import AccordionContent from '../ui/accordion/AccordionContent.vue'
import AccordionItem from '../ui/accordion/AccordionItem.vue'
import AccordionTrigger from '../ui/accordion/AccordionTrigger.vue'
import Button from '../ui/button/Button.vue'

export type AccordionStep = { id: string; title: string }

const {
  steps,
  cta,
  defaultOpen,
  titleClass,
  class: className
} = defineProps<{
  id?: string
  title: string
  /** Overrides the heading's default weight/size for callers that need it. */
  titleClass?: HTMLAttributes['class']
  lead?: string
  cta?: { label: string; href: string; newTab?: boolean }
  /** Triggers are numbered from their position, so callers pass titles only. */
  steps: readonly AccordionStep[]
  /** Step id to open on load; the first step unless overridden. */
  defaultOpen?: string
  class?: HTMLAttributes['class']
}>()

// FAQSplit01's split layout, but each step body is a named slot instead of a
// parsed string — these steps carry checklists and sub-headings, which a flat
// answer string cannot express.
</script>

<template>
  <section :id :class="cn('max-w-9xl mx-auto px-6 py-16 lg:py-24', className)">
    <div class="flex flex-col gap-12 lg:flex-row lg:gap-24">
      <div class="shrink-0 lg:w-80">
        <h2
          :class="
            cn(
              'text-3xl font-light tracking-tight text-primary-warm-white lg:text-5xl',
              titleClass
            )
          "
        >
          {{ title }}
        </h2>
        <p
          v-if="lead"
          class="mt-6 text-base font-light text-primary-comfy-canvas"
        >
          {{ lead }}
        </p>
        <Button
          v-if="cta"
          as="a"
          :href="cta.href"
          :target="cta.newTab ? '_blank' : undefined"
          :rel="cta.newTab ? resolveRel({ target: '_blank' }) : undefined"
          class="mt-8"
        >
          {{ cta.label }}
        </Button>
      </div>

      <Accordion
        type="single"
        collapsible
        :default-value="defaultOpen ?? steps[0]?.id"
        class="min-w-0 flex-1"
      >
        <AccordionItem
          v-for="(step, index) in steps"
          :key="step.id"
          :value="step.id"
        >
          <AccordionTrigger
            :class="
              cn(
                'data-[state=open]:text-primary-warm-white',
                index === 0 && 'pt-0'
              )
            "
          >
            <!-- One flex child: the trigger is justify-between, so a bare
            number beside the title would be pushed to the far end. -->
            <span>{{ index + 1 }}. {{ step.title }}</span>
          </AccordionTrigger>
          <AccordionContent>
            <slot :name="step.id" />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  </section>
</template>
