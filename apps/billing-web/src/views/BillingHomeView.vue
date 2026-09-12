<script setup lang="ts">
import EmbeddedCheckout from '@/components/EmbeddedCheckout.vue'
</script>

<template>
  <main
    class="dark-theme fixed inset-0 overflow-auto bg-charcoal-950 px-4 py-6 font-inter sm:px-6 sm:py-10"
  >
    <section class="mx-auto flex min-h-full max-w-7xl items-center">
      <EmbeddedCheckout
        plan-name="Creator"
        :monthly-price-cents="2800"
        :amount-due-cents="33600"
        :credits-per-month="6900"
        billing-cycle="yearly"
        :checkout-enabled="false"
      />
    </section>
  </main>
</template>
