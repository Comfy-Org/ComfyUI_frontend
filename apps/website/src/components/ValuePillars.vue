<script setup lang="ts">
const pillars = [
  {
    icon: '⚡',
    title: 'Build',
    description:
      'Design complex AI workflows visually with our node-based editor'
  },
  {
    icon: '🎨',
    title: 'Customize',
    description: 'Fine-tune every parameter across any model architecture'
  },
  {
    icon: '🔧',
    title: 'Refine',
    description:
      'Iterate on outputs with precision controls and real-time preview'
  },
  {
    icon: '⚙️',
    title: 'Automate',
    description:
      'Scale your workflows with batch processing and API integration'
  },
  {
    icon: '🚀',
    title: 'Run',
    description: 'Deploy locally or in the cloud with identical results'
  }
]
</script>

<template>
  <section class="bg-black px-6 py-24">
    <div class="mx-auto max-w-7xl">
      <header class="mb-16 text-center">
        <h2 class="text-3xl font-bold text-white md:text-4xl">
          The Building Blocks of AI Production
        </h2>
        <p class="mt-4 text-smoke-700">
          Five powerful capabilities that give you complete control
        </p>
      </header>

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <article
          v-for="pillar in pillars"
          :key="pillar.title"
          class="rounded-xl border border-white/10 bg-charcoal-600 p-6 transition-colors hover:border-brand-yellow"
        >
          <div
            class="flex h-12 w-12 items-center justify-center rounded-full bg-brand-yellow text-xl"
          >
            {{ pillar.icon }}
          </div>
          <h3 class="mt-4 text-lg font-semibold text-white">
            {{ pillar.title }}
          </h3>
          <p class="mt-2 text-sm text-smoke-700">
            {{ pillar.description }}
          </p>
        </article>
      </div>
    </div>
  </section>
</template>
