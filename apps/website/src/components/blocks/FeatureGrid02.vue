<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

import SectionHeader from '../common/SectionHeader.vue'
import NodeUnionIcon from '../icons/NodeUnionIcon.vue'

type Cta = { label: string; href: string; target?: '_blank' }

export interface FeatureStep {
  id: string
  number: string
  title: string
  description: string
}

defineProps<{
  heading: string
  steps: readonly FeatureStep[]
  primaryCta?: Cta
  secondaryCta?: Cta
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <SectionHeader>{{ heading }}</SectionHeader>

    <!-- Step cards in a row, joined by node-union connectors on desktop -->
    <div
      class="mt-12 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-0"
    >
      <template v-for="(step, i) in steps" :key="step.id">
        <div
          v-if="i > 0"
          class="relative z-10 -mx-px hidden shrink-0 items-center justify-center self-stretch lg:flex"
          aria-hidden="true"
        >
          <NodeUnionIcon
            class="text-primary-comfy-yellow size-4 scale-x-150 rotate-90"
          />
        </div>

        <div
          class="border-primary-comfy-yellow flex flex-1 flex-col rounded-[40px] border-2 bg-primary-comfy-ink p-2"
        >
          <div class="flex flex-1 flex-col gap-4 p-8">
            <div>
              <p
                class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
              >
                {{ step.number }}
              </p>
              <h3
                class="mt-1 text-2xl font-medium tracking-widest text-primary-comfy-canvas uppercase"
              >
                {{ step.title }}
              </h3>
            </div>
            <p class="text-primary-comfy-canvas">
              {{ step.description }}
            </p>
          </div>
        </div>
      </template>
    </div>

    <div
      v-if="primaryCta || secondaryCta"
      class="mt-12 flex flex-col items-center gap-4 lg:flex-row lg:justify-center"
    >
      <Button
        v-if="primaryCta"
        as="a"
        :href="primaryCta.href"
        :target="primaryCta.target"
        :rel="
          primaryCta.target === '_blank' ? 'noopener noreferrer' : undefined
        "
        size="lg"
        class="w-full lg:w-auto lg:min-w-48"
      >
        {{ primaryCta.label }}
      </Button>
      <Button
        v-if="secondaryCta"
        as="a"
        :href="secondaryCta.href"
        :target="secondaryCta.target"
        :rel="
          secondaryCta.target === '_blank' ? 'noopener noreferrer' : undefined
        "
        variant="outline"
        size="lg"
        class="w-full lg:w-auto lg:min-w-48"
      >
        {{ secondaryCta.label }}
      </Button>
    </div>
  </section>
</template>
