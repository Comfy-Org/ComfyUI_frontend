<script setup lang="ts">
interface Reason {
  title: string
  description: string
}

const {
  heading,
  headingHighlight = '',
  reasons
} = defineProps<{
  heading: string
  headingHighlight?: string
  reasons: Reason[]
}>()
</script>

<template>
  <section
    class="flex flex-col gap-4 px-4 py-24 md:flex-row md:gap-16 md:px-20 md:py-40"
  >
    <!-- Left heading -->
    <div
      class="bg-primary-comfy-ink sticky top-20 z-10 w-full shrink-0 self-start py-4 md:top-28 md:w-115 md:py-0"
    >
      <h2
        class="text-primary-comfy-canvas text-4xl font-light whitespace-pre-line md:text-5xl"
      >
        {{ heading
        }}<span v-if="headingHighlight" class="text-primary-warm-white">{{
          headingHighlight
        }}</span>
      </h2>
    </div>

    <!-- Right reasons list -->
    <div class="flex-1">
      <div
        v-for="reason in reasons"
        :key="reason.title"
        class="border-primary-comfy-canvas/20 flex flex-col gap-4 border-b py-10 first:pt-0 md:flex-row md:gap-12"
      >
        <h3
          class="text-primary-comfy-canvas shrink-0 text-2xl font-light whitespace-pre-line md:w-52"
        >
          {{ reason.title }}
        </h3>
        <p class="text-primary-comfy-canvas/70 flex-1 text-sm">
          {{ reason.description }}
        </p>
      </div>
    </div>
  </section>
</template>
