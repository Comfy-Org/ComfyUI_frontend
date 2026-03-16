<script setup lang="ts">
const steps = [
  {
    number: '1',
    title: 'Download & Sign Up',
    description: 'Get Comfy Desktop for free or create a Cloud account'
  },
  {
    number: '2',
    title: 'Load a Workflow',
    description:
      'Choose from thousands of community workflows or build your own'
  },
  {
    number: '3',
    title: 'Generate',
    description: 'Hit run and watch your AI workflow come to life'
  }
]
</script>

<template>
  <section class="border-t border-white/10 bg-black py-24">
    <div class="mx-auto max-w-7xl px-6 text-center">
      <h2 class="text-3xl font-bold text-white">Get Started in Minutes</h2>
      <p class="mt-4 text-smoke-700">
        From download to your first AI-generated output in three simple steps
      </p>

      <!-- Steps -->
      <div class="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
        <div v-for="(step, index) in steps" :key="step.number" class="relative">
          <!-- Connecting line between steps (desktop only) -->
          <div
            v-if="index < steps.length - 1"
            class="absolute right-0 top-8 hidden w-full translate-x-1/2 border-t border-brand-yellow/20 md:block"
          />

          <div class="relative">
            <span class="text-6xl font-bold text-brand-yellow/20">
              {{ step.number }}
            </span>
            <h3 class="mt-2 text-xl font-semibold text-white">
              {{ step.title }}
            </h3>
            <p class="mt-2 text-sm text-smoke-700">
              {{ step.description }}
            </p>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <a
        href="/download"
        class="mt-12 inline-block rounded-full bg-brand-yellow px-8 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
      >
        DOWNLOAD COMFY
      </a>
    </div>
  </section>
</template>
