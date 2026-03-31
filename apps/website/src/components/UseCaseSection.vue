<!-- TODO: Wire category content swap when final assets arrive -->
<script setup lang="ts">
import { ref } from 'vue'

const categories = [
  'VFX & Animation',
  'Creative Agencies',
  'Gaming',
  'eCommerce & Fashion',
  'Community & Hobbyists'
]

const activeCategory = ref(0)
</script>

<template>
  <section class="bg-charcoal-800 px-6 py-24">
    <div class="mx-auto max-w-7xl">
      <div class="flex flex-col items-center gap-12 lg:flex-row lg:gap-8">
        <!-- Left placeholder image (desktop only) -->
        <div class="hidden flex-1 lg:block">
          <div
            class="aspect-[2/3] rounded-full border border-white/10 bg-charcoal-600"
          />
        </div>

        <!-- Center content -->
        <div class="flex flex-col items-center text-center lg:flex-[2]">
          <h2 class="text-3xl font-bold text-white">
            Built for Every Creative Industry
          </h2>

          <nav
            class="mt-10 flex flex-col items-center gap-4"
            aria-label="Industry categories"
          >
            <button
              v-for="(category, index) in categories"
              :key="category"
              class="transition-colors"
              :class="
                index === activeCategory
                  ? 'text-2xl text-white'
                  : 'text-xl text-ash-500 hover:text-white/70'
              "
              @click="activeCategory = index"
            >
              {{ category }}
            </button>
          </nav>

          <p class="mt-10 max-w-lg text-smoke-700">
            Powered by 60,000+ nodes, thousands of workflows, and a community
            that builds faster than any one company could.
          </p>

          <a
            href="/workflows"
            class="mt-8 rounded-full border border-brand-yellow px-8 py-3 text-sm font-semibold text-brand-yellow transition-colors hover:bg-brand-yellow hover:text-black"
          >
            EXPLORE WORKFLOWS
          </a>
        </div>

        <!-- Right placeholder image (desktop only) -->
        <div class="hidden flex-1 lg:block">
          <div
            class="aspect-[2/3] rounded-3xl border border-white/10 bg-charcoal-600"
          />
        </div>
      </div>
    </div>
  </section>
</template>
