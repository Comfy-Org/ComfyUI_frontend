<script setup lang="ts">
import GlassCard from '../common/GlassCard.vue'
import CheckIcon from '../icons/CheckIcon.vue'

type Criterion = { id: string; label: string }

defineProps<{
  heading: string
  subheading: string
  eyebrow?: string
  criteria: readonly Criterion[]
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <h2
      class="mb-12 text-center text-4xl font-light tracking-tight text-primary-comfy-canvas lg:mb-16 lg:text-6xl"
    >
      {{ heading }}
    </h2>

    <GlassCard class="px-6 py-10 lg:px-16 lg:py-14">
      <div
        class="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16"
      >
        <h3 class="text-2xl font-light text-primary-comfy-canvas lg:text-4xl">
          {{ subheading }}
        </h3>

        <div class="flex flex-col gap-6">
          <span
            v-if="eyebrow"
            class="text-xs font-bold tracking-widest text-primary-comfy-canvas uppercase"
          >
            {{ eyebrow }}
          </span>
          <ul class="flex flex-col gap-4">
            <li
              v-for="criterion in criteria"
              :key="criterion.id"
              class="flex items-start gap-3"
            >
              <CheckIcon
                class="text-primary-comfy-yellow mt-0.5 size-5 shrink-0"
              />
              <span class="text-sm text-primary-comfy-canvas lg:text-base">
                {{ criterion.label }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </GlassCard>
  </section>
</template>
