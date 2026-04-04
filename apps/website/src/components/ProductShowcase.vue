<!-- TODO: Replace with actual workflow demo content -->
<script setup lang="ts">
const features = ['Node-Based Editor', 'Real-Time Preview', 'Version Control']
</script>

<template>
  <section class="bg-charcoal-800 py-24">
    <div class="mx-auto max-w-7xl px-6">
      <!-- Section header -->
      <div class="text-center">
        <h2 class="text-3xl font-bold text-white">See Comfy in Action</h2>
        <p class="mx-auto mt-4 max-w-2xl text-smoke-700">
          Watch how professionals build AI workflows with unprecedented control
        </p>
      </div>

      <!-- Placeholder video area -->
      <div
        class="mt-12 flex aspect-video items-center justify-center rounded-2xl border border-white/10 bg-charcoal-600"
      >
        <div class="flex flex-col items-center gap-4">
          <!-- Play button triangle -->
          <div
            class="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/20"
            aria-hidden="true"
          >
            <div
              class="ml-1 h-0 w-0 border-y-8 border-l-[14px] border-y-transparent border-l-white"
            />
          </div>
          <p class="text-sm text-smoke-700">Workflow Demo Coming Soon</p>
        </div>
      </div>

      <!-- Feature labels -->
      <div class="mt-8 flex flex-wrap items-center justify-center gap-6">
        <div
          v-for="feature in features"
          :key="feature"
          class="flex items-center gap-2"
        >
          <span
            class="h-2 w-2 rounded-full bg-brand-yellow"
            aria-hidden="true"
          />
          <span class="text-sm text-smoke-700">{{ feature }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
