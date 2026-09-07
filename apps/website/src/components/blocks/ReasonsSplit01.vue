<script setup lang="ts">
export interface Reason {
  id: string
  title: string
  description: string
}

const { highlightClass = 'text-white' } = defineProps<{
  heading: string
  headingHighlight?: string
  highlightClass?: string
  subtitle?: string
  reasons: readonly Reason[]
}>()
</script>

<template>
  <section
    class="max-w-9xl mx-auto flex flex-col gap-4 px-6 py-16 lg:flex-row lg:gap-16 lg:py-24"
  >
    <!-- Left heading -->
    <div
      class="sticky top-20 z-10 w-full shrink-0 self-start bg-primary-comfy-ink py-4 lg:top-28 lg:w-115 lg:py-0"
    >
      <h2
        class="text-4xl/16 font-light whitespace-pre-line text-primary-comfy-canvas lg:text-5xl/16"
      >
        {{ heading
        }}<span v-if="headingHighlight" :class="highlightClass">{{
          headingHighlight
        }}</span>
      </h2>
      <p v-if="subtitle" class="mt-6 text-sm text-primary-comfy-canvas/70">
        {{ subtitle }}
      </p>
    </div>

    <!-- Right reasons list -->
    <div class="flex-1">
      <div
        v-for="reason in reasons"
        :key="reason.id"
        class="flex flex-col gap-4 border-b border-primary-comfy-canvas/20 py-10 first:pt-0 lg:gap-12 xl:flex-row"
      >
        <div class="shrink-0 xl:w-84">
          <h3
            class="text-2xl font-light whitespace-pre-line text-primary-comfy-canvas"
          >
            {{ reason.title }}
          </h3>
          <slot name="reason-extra" :reason="reason" />
        </div>
        <p class="flex-1 text-sm text-primary-comfy-canvas/70">
          {{ reason.description }}
        </p>
      </div>
    </div>
  </section>
</template>
