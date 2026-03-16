<script setup lang="ts">
const cards = [
  {
    icon: '🖥️',
    title: 'Comfy Desktop',
    description: 'Full power on your local machine. Free and open source.',
    cta: 'DOWNLOAD',
    href: '/download',
    outlined: false
  },
  {
    icon: '☁️',
    title: 'Comfy Cloud',
    description: 'Run workflows in the cloud. No GPU required.',
    cta: 'TRY CLOUD',
    href: 'https://app.comfy.org',
    outlined: false
  },
  {
    icon: '⚡',
    title: 'Comfy API',
    description: 'Integrate AI generation into your applications.',
    cta: 'VIEW DOCS',
    href: 'https://docs.comfy.org',
    outlined: true
  }
]
</script>

<template>
  <section class="bg-charcoal-800 py-24">
    <div class="mx-auto max-w-5xl px-6">
      <h2 class="text-center text-3xl font-bold text-white">
        Choose Your Way to Comfy
      </h2>

      <!-- CTA cards -->
      <div class="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        <a
          v-for="card in cards"
          :key="card.title"
          :href="card.href"
          class="flex flex-1 flex-col items-center rounded-xl border border-white/10 bg-charcoal-600 p-8 text-center transition-colors hover:border-brand-yellow"
        >
          <span class="text-4xl" aria-hidden="true">{{ card.icon }}</span>
          <h3 class="mt-4 text-xl font-semibold text-white">
            {{ card.title }}
          </h3>
          <p class="mt-2 text-sm text-smoke-700">
            {{ card.description }}
          </p>
          <span
            class="mt-6 inline-block rounded-full px-6 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            :class="
              card.outlined
                ? 'border border-brand-yellow text-brand-yellow'
                : 'bg-brand-yellow text-black'
            "
          >
            {{ card.cta }}
          </span>
        </a>
      </div>
    </div>
  </section>
</template>
