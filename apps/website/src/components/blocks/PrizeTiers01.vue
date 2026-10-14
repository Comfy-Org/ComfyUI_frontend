<script setup lang="ts">
interface Prize {
  id: string
  title: string
  award: string
  description?: string
}

const { heading, mainLabel, grand, categories, runnerUp, bonusLabel, bonuses } =
  defineProps<{
    heading: string
    mainLabel: string
    grand: Prize
    categories: readonly Prize[]
    runnerUp: Prize
    bonusLabel: string
    bonuses: readonly Prize[]
  }>()
</script>

<template>
  <section class="mx-auto max-w-9xl px-4 py-20 lg:px-20 lg:py-24">
    <h2
      class="text-center text-3xl font-light text-balance text-primary-comfy-canvas lg:text-5xl/tight"
    >
      {{ heading }}
    </h2>

    <h3
      class="mt-12 px-8 text-sm font-bold tracking-widest text-primary-comfy-yellow uppercase lg:mt-16 xl:px-10"
    >
      {{ mainLabel }}
    </h3>
    <ul role="list" class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <li
        class="flex flex-col rounded-5xl bg-primary-comfy-yellow p-8 text-primary-comfy-ink lg:col-span-3 lg:grid lg:grid-cols-3 lg:grid-rows-[1fr_auto] lg:items-end lg:gap-x-20 lg:py-14 xl:gap-x-24 xl:px-10"
      >
        <h4
          class="mt-6 text-2xl/tight font-medium lg:col-start-3 lg:row-start-1 lg:mt-0 xl:text-3xl/tight"
        >
          {{ grand.title }}
        </h4>
        <p
          class="order-first font-formula-narrow text-7xl/none font-semibold tracking-tight wrap-anywhere md:text-8xl/none lg:col-span-2 lg:row-span-2 xl:text-9xl/none"
        >
          {{ grand.award }}
        </p>
        <p
          v-if="grand.description"
          class="mt-3 text-sm/relaxed text-primary-comfy-ink/80 lg:col-start-3 lg:row-start-2 lg:text-base/relaxed"
        >
          {{ grand.description }}
        </p>
      </li>

      <li
        v-for="category in categories"
        :key="category.id"
        class="flex flex-col items-start rounded-5xl border border-primary-comfy-yellow bg-transparency-white-t4 p-8 xl:p-10"
      >
        <h4
          class="mt-6 text-xl/tight font-medium text-primary-warm-white xl:text-2xl/tight"
        >
          {{ category.title }}
        </h4>
        <p
          class="order-first max-w-full -skew-x-12 rounded-lg bg-primary-comfy-yellow px-3 py-1.5 font-formula-narrow text-xl font-semibold text-primary-comfy-ink xl:text-2xl"
        >
          <span class="inline-block skew-x-12 text-balance">{{
            category.award
          }}</span>
        </p>
        <p
          v-if="category.description"
          class="mt-3 text-sm/relaxed text-primary-comfy-canvas"
        >
          {{ category.description }}
        </p>
      </li>

      <li
        class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-5xl border border-primary-comfy-yellow bg-transparency-white-t4 px-8 py-5 lg:col-span-3 xl:px-10"
      >
        <h4 class="text-base/tight font-medium text-primary-warm-white">
          {{ runnerUp.title }}
        </h4>
        <p
          class="font-formula-narrow text-lg font-semibold text-primary-comfy-yellow"
        >
          {{ runnerUp.award }}
        </p>
        <p
          v-if="runnerUp.description"
          class="basis-full text-sm/relaxed text-primary-comfy-canvas"
        >
          {{ runnerUp.description }}
        </p>
      </li>
    </ul>

    <template v-if="bonuses.length">
      <h3
        class="mt-12 px-8 text-sm font-bold tracking-widest text-primary-comfy-yellow uppercase lg:mt-16 xl:px-10"
      >
        {{ bonusLabel }}
      </h3>
      <ul role="list" class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <li
          v-for="bonus in bonuses"
          :key="bonus.id"
          class="flex flex-col gap-1.5 rounded-5xl border border-transparency-white-t20 px-8 py-6 xl:px-10"
        >
          <h4 class="text-base/snug font-medium text-primary-comfy-canvas">
            {{ bonus.title }}
          </h4>
          <p
            class="font-formula-narrow text-base font-semibold text-timeline-neutral"
          >
            {{ bonus.award }}
          </p>
          <p
            v-if="bonus.description"
            class="text-sm/relaxed text-primary-comfy-canvas/70"
          >
            {{ bonus.description }}
          </p>
        </li>
      </ul>
    </template>

    <div
      v-if="$slots.default"
      class="mt-12 flex flex-wrap items-center justify-center gap-4 lg:mt-16"
    >
      <slot />
    </div>
  </section>
</template>
