<!-- PLACEHOLDER: Awaiting real quotes and case study content from Baira -->
<script setup lang="ts">
const studies = [
  {
    title: 'New Pipelines with Chord Mode',
    body: 'For AI-assisted texture and environment generation across studio pipelines.',
    size: 'tall' as const
  },
  {
    title: 'AI-Assisted Texture and Environment',
    body: 'For AI-assisted texture and environment generation across studio pipelines.',
    size: 'wide' as const
  },
  {
    title: 'Open-sourced the Chord Mode',
    body: 'For AI-assisted texture and environment generation across studio pipelines.',
    size: 'small' as const
  },
  {
    title: 'Environment Generation',
    body: 'For AI-assisted texture and environment generation across studio pipelines.',
    size: 'highlight' as const
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
        <!-- Decorative node dots at grid intersections -->
        <div
          class="pointer-events-none absolute left-1/3 top-0 hidden h-1 w-1 rounded-full bg-brand-yellow lg:block"
        />
        <div
          class="pointer-events-none absolute left-2/3 top-0 hidden h-1 w-1 rounded-full bg-brand-yellow lg:block"
        />
        <div
          class="pointer-events-none absolute left-1/3 top-1/2 hidden h-1 w-1 rounded-full bg-brand-yellow lg:block"
        />
        <div
          class="pointer-events-none absolute left-2/3 top-1/2 hidden h-1 w-1 rounded-full bg-brand-yellow lg:block"
        />

        <!-- Tall card (left, spans 2 rows) -->
        <article
          class="flex flex-col justify-end rounded-2xl border border-brand-yellow/30 bg-charcoal-600 p-6 md:row-span-2"
        >
          <h3 class="font-semibold text-white">{{ studies[0].title }}</h3>
          <p class="mt-2 text-sm text-smoke-700">{{ studies[0].body }}</p>
          <a href="#" class="mt-4 text-sm text-brand-yellow underline">
            READ CASE STUDY
          </a>
        </article>

        <!-- Wide card (right top) -->
        <article
          class="flex min-h-[300px] flex-col justify-end rounded-2xl border border-brand-yellow/30 bg-charcoal-600 p-6 lg:col-span-2"
        >
          <h3 class="font-semibold text-white">{{ studies[1].title }}</h3>
          <p class="mt-2 text-sm text-smoke-700">{{ studies[1].body }}</p>
          <a href="#" class="mt-4 text-sm text-brand-yellow underline">
            READ CASE STUDY
          </a>
        </article>

        <!-- Bottom-right: 2 small cards side by side -->
        <article
          class="flex min-h-[200px] flex-col justify-end rounded-2xl border border-brand-yellow/30 bg-charcoal-600 p-6"
        >
          <h3 class="font-semibold text-white">{{ studies[2].title }}</h3>
          <p class="mt-2 text-sm text-smoke-700">{{ studies[2].body }}</p>
          <a href="#" class="mt-4 text-sm text-brand-yellow underline">
            READ CASE STUDY
          </a>
        </article>

        <!-- Highlight card (brand-yellow bg) -->
        <article
          class="flex min-h-[200px] flex-col justify-end rounded-2xl border border-brand-yellow/30 bg-brand-yellow p-6"
        >
          <h3 class="font-semibold text-black">{{ studies[3].title }}</h3>
          <p class="mt-2 text-sm text-black/70">{{ studies[3].body }}</p>
          <a href="#" class="mt-4 text-sm text-black underline">
            READ CASE STUDY
          </a>
        </article>
      </div>
    </div>
  </section>
</template>
