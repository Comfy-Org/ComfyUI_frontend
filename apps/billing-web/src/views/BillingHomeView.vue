<script setup lang="ts">
import TopUpCreditsCard from '@/components/TopUpCreditsCard.vue'
</script>

<template>
  <main
    class="dark-theme fixed inset-0 overflow-auto bg-charcoal-950 px-4 py-8 font-inter sm:px-6 sm:py-12"
  >
    <section class="mx-auto flex min-h-full max-w-xl items-center">
      <TopUpCreditsCard :checkout-enabled="false" />
    </section>
  </main>
</template>
