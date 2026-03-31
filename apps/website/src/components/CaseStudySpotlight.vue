<!-- TODO: Replace placeholder content with real quotes and case studies -->
<script setup lang="ts">
const studies = [
  {
    title: 'New Pipelines with Chord Mode',
    body: 'For AI-assisted texture and environment generation across studio pipelines.',
    highlight: false,
    gridClass: 'md:row-span-2'
  },
  {
    title: 'AI-Assisted Texture and Environment',
    body: 'For AI-assisted texture and environment generation across studio pipelines.',
    highlight: false,
    gridClass: 'min-h-[300px] lg:col-span-2'
  },
  {
    title: 'Open-sourced the Chord Mode',
    body: 'For AI-assisted texture and environment generation across studio pipelines.',
    highlight: false,
    gridClass: 'min-h-[200px]'
  },
  {
    title: 'Environment Generation',
    body: 'For AI-assisted texture and environment generation across studio pipelines.',
    highlight: true,
    gridClass: 'min-h-[200px]'
  }
]
</script>

<template>
  <section class="bg-black px-6 py-24">
    <div class="mx-auto max-w-7xl">
      <header class="mb-12">
        <h2 class="text-3xl font-bold text-white">Customer Stories</h2>
        <p class="mt-2 text-smoke-700">
          See how leading studios use Comfy in production
        </p>
      </header>

      <!-- Bento grid -->
      <div
        class="relative grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        <article
          v-for="study in studies"
          :key="study.title"
          class="flex flex-col justify-end rounded-2xl border border-brand-yellow/30 p-6"
          :class="[
            study.gridClass,
            study.highlight ? 'bg-brand-yellow' : 'bg-charcoal-600'
          ]"
        >
          <h3
            class="font-semibold"
            :class="study.highlight ? 'text-black' : 'text-white'"
          >
            {{ study.title }}
          </h3>
          <p
            class="mt-2 text-sm"
            :class="study.highlight ? 'text-black/70' : 'text-smoke-700'"
          >
            {{ study.body }}
          </p>
          <a
            href="/case-studies"
            class="mt-4 text-sm underline"
            :class="study.highlight ? 'text-black' : 'text-brand-yellow'"
          >
            READ CASE STUDY
          </a>
        </article>
      </div>
    </div>
  </section>
</template>
