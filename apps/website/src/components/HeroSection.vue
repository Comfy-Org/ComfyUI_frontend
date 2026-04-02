<script setup lang="ts">
const ctaButtons = [
  {
    label: 'GET STARTED',
    href: 'https://app.comfy.org',
    variant: 'solid' as const
  },
  {
    label: 'LEARN MORE',
    href: '/about',
    variant: 'outline' as const
  }
]
</script>

<template>
  <section
    class="relative flex min-h-screen items-center overflow-hidden bg-black pt-16"
  >
    <div
      class="mx-auto flex w-full max-w-7xl flex-col items-center gap-12 px-6 md:flex-row md:gap-0"
    >
      <!-- Left: C Monogram -->
      <div class="flex w-full items-center justify-center md:w-[55%]">
        <div class="relative -ml-12 -rotate-15 md:-ml-24" aria-hidden="true">
          <div
            class="h-64 w-64 rounded-full border-[40px] border-brand-yellow md:h-[28rem] md:w-[28rem] md:border-[64px] lg:h-[36rem] lg:w-[36rem] lg:border-[80px]"
          >
            <!-- Gap on the right side to form "C" shape -->
            <div
              class="absolute right-0 top-1/2 h-32 w-24 -translate-y-1/2 translate-x-1/2 bg-black md:h-48 md:w-36 lg:h-64 lg:w-48"
            />
          </div>
        </div>
      </div>

      <!-- Right: Text content -->
      <div class="flex w-full flex-col items-start md:w-[45%]">
        <h1
          class="text-5xl font-bold leading-tight tracking-tight text-white md:text-6xl lg:text-7xl"
        >
          Professional Control of Visual AI
        </h1>

        <p class="mt-6 max-w-lg text-lg text-smoke-700">
          Comfy is the AI creation engine for visual professionals who demand
          control over every model, every parameter, and every output.
        </p>

        <div class="mt-8 flex flex-wrap gap-4">
          <a
            v-for="btn in ctaButtons"
            :key="btn.label"
            :href="btn.href"
            class="rounded-full px-8 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            :class="
              btn.variant === 'solid'
                ? 'bg-brand-yellow text-black'
                : 'border border-brand-yellow text-brand-yellow'
            "
          >
            {{ btn.label }}
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
