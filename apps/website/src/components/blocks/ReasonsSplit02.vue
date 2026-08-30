<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import { resolveRel } from '../../utils/cta'

export interface SplitReason {
  id: string
  title: string
  description: string
  /** Renders a large accent numeral in a column of its own. */
  number?: string
  link?: {
    label: string
    href: string
    target?: '_blank' | '_self' | '_parent' | '_top'
  }
}

const {
  heading,
  lead,
  reasons,
  headingPosition = 'side',
  class: className
} = defineProps<{
  heading: string
  lead?: string
  reasons: readonly SplitReason[]
  headingPosition?: 'side' | 'top'
  class?: HTMLAttributes['class']
}>()

/*
 * Numbered rows carry the design's taller rhythm (64/56 against 40/40) and a
 * rule under the last row; plain rows only rule between themselves.
 */
const numbered = computed(() => reasons.some((reason) => reason.number))

const rowTopClass = computed(() => (numbered.value ? 'pt-10 lg:pt-16' : 'pt-8'))
const rowBottomClass = computed(() =>
  numbered.value ? 'pb-10 lg:pb-14' : 'pb-8'
)

/*
 * The design gives the title column 312px when a numeral precedes it and 300px
 * when it does not, both measured to where the description starts — so the
 * column itself is that width less the 48px gutter.
 */
const titleWidthClass = computed(() => (numbered.value ? 'xl:w-66' : 'xl:w-75'))

function bodyClass(index: number): string {
  const last = index === reasons.length - 1
  return cn(
    'border-page-fg/15 flex flex-1 flex-col gap-4 border-b xl:flex-row xl:gap-12',
    rowBottomClass.value,
    last && !numbered.value && 'border-b-0'
  )
}
</script>

<template>
  <section
    :class="
      cn(
        'max-w-9xl mx-auto px-6 py-16 lg:px-20 lg:py-24',
        headingPosition === 'side' && 'lg:flex lg:gap-30',
        className
      )
    "
  >
    <div
      :class="
        cn(
          headingPosition === 'side'
            ? 'lg:sticky lg:top-28 lg:w-110 lg:shrink-0 lg:self-start'
            : ''
        )
      "
    >
      <h2
        class="text-page-fg lg:text-6.5xl text-4xl leading-[1.3] font-medium tracking-[-0.03em] text-pretty md:text-5xl"
      >
        {{ heading }}
      </h2>
      <p
        v-if="lead"
        class="text-page-fg mt-6 text-[17px] leading-[1.6] font-light"
      >
        {{ lead }}
      </p>
    </div>

    <div
      :class="headingPosition === 'side' ? 'mt-12 lg:mt-0 lg:flex-1' : 'mt-14'"
    >
      <div
        v-for="(reason, index) in reasons"
        :key="reason.id"
        :class="cn('flex gap-6 lg:gap-0', index > 0 && rowTopClass)"
      >
        <!-- Outside the ruled column: the design's rules start at the title. -->
        <span
          v-if="reason.number"
          class="text-primary-comfy-plum lg:text-6.5xl w-16 shrink-0 text-5xl leading-none font-light lg:w-30"
          aria-hidden="true"
        >
          {{ reason.number }}
        </span>

        <div :class="bodyClass(index)">
          <h3
            :class="
              cn(
                'text-page-fg shrink-0 text-2xl leading-[1.4] font-medium whitespace-pre-line',
                titleWidthClass
              )
            "
          >
            {{ reason.title }}
          </h3>
          <div class="flex-1">
            <p class="text-page-fg text-[17px] leading-[1.6] font-light">
              {{ reason.description }}
            </p>
            <a
              v-if="reason.link"
              :href="reason.link.href"
              :target="reason.link.target"
              :rel="resolveRel(reason.link)"
              class="text-page-fg text-[17px] leading-[1.6] font-light uppercase underline-offset-4 hover:underline"
            >
              {{ reason.link.label }}
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
