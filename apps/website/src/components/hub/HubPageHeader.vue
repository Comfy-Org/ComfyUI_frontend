<script setup lang="ts">
import { computed } from 'vue'

import ModelPrice from '../workshop/ModelPrice.vue'
import TagOverflow from '../workshop/TagOverflow.vue'

// Production's model header, and the only header either half of the Hub uses.
// A model and a workflow answer the same four questions in the same places —
// who stands behind it, what it is called, what it does, what a run costs —
// so a reader crossing between them reads one page shape rather than two.
const {
  eyebrow,
  eyebrowHref,
  useCase,
  useCaseHref,
  title,
  summary,
  price,
  tags = []
} = defineProps<{
  /** Who answers for it: a model's provider, a workflow's model. */
  eyebrow: string
  eyebrowHref?: string
  useCase?: string
  useCaseHref?: string
  title: string
  summary?: string
  price?: string
  tags?: readonly { label: string; href: string }[]
}>()

// Three, as the live model page shows them: past that the row wraps under the
// price and reads as a second paragraph rather than as a footnote to the one
// above it.
const TAGS_SHOWN = 3
const shown = computed(() => tags.slice(0, TAGS_SHOWN))
const rest = computed(() => tags.slice(TAGS_SHOWN))

const eyebrowClass =
  'text-sm leading-none font-medium tracking-widest text-primary-comfy-yellow uppercase'
const pillClass =
  'inline-flex h-7 items-center rounded-full border border-transparency-white-t20 px-3 text-xs leading-none text-primary-comfy-canvas transition-colors hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow'
</script>

<template>
  <header class="mb-12" data-testid="hub-page-header">
    <div
      class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
    >
      <div class="flex max-w-2xl flex-col gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <a
            v-if="eyebrowHref"
            :href="eyebrowHref"
            :class="`${eyebrowClass} transition-opacity hover:opacity-70`"
            data-testid="hub-header-eyebrow"
          >
            {{ eyebrow }}
          </a>
          <p v-else :class="eyebrowClass" data-testid="hub-header-eyebrow">
            {{ eyebrow }}
          </p>
          <a
            v-if="useCase && useCaseHref"
            :href="useCaseHref"
            :class="pillClass"
            data-testid="hub-header-use-case"
          >
            {{ useCase }}
          </a>
        </div>

        <h1 class="text-3xl font-bold text-primary-comfy-canvas lg:text-4xl">
          {{ title }}
        </h1>
        <p v-if="summary" class="text-sm/relaxed text-primary-warm-gray">
          {{ summary }}
        </p>
      </div>

      <div class="flex flex-col gap-4 lg:items-end">
        <ModelPrice :estimate="price" />
        <ul
          v-if="tags.length > 0"
          class="scrollbar-hide flex items-center gap-2 max-sm:overflow-x-auto sm:flex-wrap lg:justify-end"
          data-testid="hub-header-tags"
        >
          <li v-for="tag in shown" :key="tag.href">
            <a
              :href="tag.href"
              class="inline-flex h-7 shrink-0 items-center rounded-full bg-transparency-white-t8 px-3 text-xs/none whitespace-nowrap text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t20 hover:text-primary-comfy-yellow"
            >
              {{ tag.label }}
            </a>
          </li>
          <li v-if="rest.length > 0">
            <TagOverflow :tags="rest" />
          </li>
        </ul>
      </div>
    </div>
  </header>
</template>
