<script setup lang="ts">
import NodeUnionIcon from '@/components/icons/NodeUnionIcon.vue'

interface Fact {
  id: string
  term: string
  description: string
}

interface Deliverable {
  id: string
  title: string
  description: string
}

const {
  heading,
  facts,
  intro,
  deliverables,
  requirementsHeading,
  requirements,
  note
} = defineProps<{
  heading: string
  facts: readonly Fact[]
  intro: string
  deliverables: readonly Deliverable[]
  requirementsHeading: string
  requirements: readonly string[]
  note: string
}>()

function stepNumber(index: number) {
  return String(index + 1).padStart(2, '0')
}
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-16 lg:py-24">
    <h2
      class="text-center text-3xl font-light text-balance text-primary-comfy-canvas lg:text-5xl/tight"
    >
      {{ heading }}
    </h2>

    <dl class="mt-12 border-t border-primary-comfy-canvas/20 lg:mt-23">
      <div
        v-for="fact in facts"
        :key="fact.id"
        class="flex flex-col gap-4 border-b border-primary-comfy-canvas/20 py-10 lg:flex-row lg:gap-6"
      >
        <dt
          class="shrink-0 text-2xl font-light text-primary-comfy-canvas lg:w-1/3"
        >
          {{ fact.term }}
        </dt>
        <dd
          class="flex-1 text-base font-light text-primary-comfy-canvas/70 lg:max-w-4xl lg:text-xl/9"
        >
          {{ fact.description }}
        </dd>
      </div>
    </dl>

    <p
      class="mt-16 text-center text-base text-primary-comfy-canvas/60 lg:mt-24 lg:text-xl"
    >
      {{ intro }}
    </p>

    <ol class="mt-8 flex flex-col gap-4 lg:mt-14 lg:flex-row lg:gap-3.5">
      <li
        v-for="(deliverable, index) in deliverables"
        :key="deliverable.id"
        class="relative flex min-w-0 flex-1 flex-col gap-4 rounded-[40px] border-2 border-primary-comfy-yellow bg-primary-comfy-ink p-10"
      >
        <span
          v-if="index > 0"
          class="absolute top-1/2 right-full z-10 hidden -translate-x-px -translate-y-1/2 lg:flex"
          aria-hidden="true"
        >
          <NodeUnionIcon
            class="size-4 scale-x-150 rotate-90 text-primary-comfy-yellow"
          />
        </span>
        <div>
          <p
            class="text-xs font-bold tracking-widest text-primary-comfy-yellow"
          >
            {{ stepNumber(index) }}
          </p>
          <h3
            class="mt-1 text-2xl font-medium tracking-widest text-primary-comfy-canvas uppercase"
          >
            {{ deliverable.title }}
          </h3>
        </div>
        <p class="wrap-anywhere text-primary-comfy-canvas">
          {{ deliverable.description }}
        </p>
      </li>
    </ol>

    <div class="mx-auto mt-16 max-w-6xl lg:mt-30">
      <details open class="group border-y border-primary-comfy-canvas/20">
        <summary
          class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-8 py-5 pr-5 text-xl font-medium text-primary-comfy-canvas group-open:text-primary-comfy-yellow hover:text-primary-comfy-yellow lg:pt-12 lg:pb-9 lg:text-2xl [&::-webkit-details-marker]:hidden"
        >
          {{ requirementsHeading }}
          <img
            src="/icons/plus.svg"
            alt=""
            width="32"
            height="32"
            class="size-8 shrink-0 transition-transform group-open:rotate-45"
          />
        </summary>
        <ul
          class="list-disc space-y-4 pb-8 pl-7 text-base/relaxed text-primary-comfy-canvas/70 marker:text-primary-comfy-yellow lg:space-y-4.5 lg:pb-11 lg:text-xl/relaxed"
        >
          <li v-for="requirement in requirements" :key="requirement">
            {{ requirement }}
          </li>
        </ul>
      </details>
      <p
        class="mt-8 text-base font-light text-primary-comfy-canvas/60 lg:mt-11"
      >
        {{ note }}
      </p>
    </div>
  </section>
</template>
