<script setup lang="ts">
import { useElementVisibility, useMounted, whenever } from '@vueuse/core'
import { computed, ref, useId, useTemplateRef } from 'vue'

import type { PlaygroundExample } from '@/config/workshop-playground'
import { exampleAlt } from '@/config/workshop-playground'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import ExampleCard from './ExampleCard.vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  examples,
  galleryLabel,
  activeId,
  locale = 'en',
  disabled = false,
  headingTag = 'h2'
} = defineProps<{
  examples: readonly PlaygroundExample[]
  galleryLabel: string
  activeId?: string
  locale?: Locale
  disabled?: boolean
  headingTag?: 'h2' | 'h3'
}>()
const { t } = translationsFor(locale)
const headingId = useId()

const emit = defineEmits<{ open: [example: PlaygroundExample] }>()

const altOf = (example: PlaygroundExample) =>
  exampleAlt(galleryLabel, example.title, locale)
const gallery = useTemplateRef<HTMLUListElement>('gallery')
const galleryNear = useElementVisibility(gallery, {
  rootMargin: '20% 0px'
})
const galleryReached = ref(false)
whenever(galleryNear, () => (galleryReached.value = true), { once: true })
const mounted = useMounted()
const videoPreload = computed(() =>
  galleryReached.value || (mounted.value && !('IntersectionObserver' in window))
    ? 'metadata'
    : 'none'
)
const samplesOnly = computed(
  () => examples.length > 0 && examples.every((example) => example.sampleOnly)
)
const desktopGridColumns = computed(() =>
  examples.length === 3
    ? 'sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]'
    : 'sm:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]'
)
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="flex flex-col gap-4"
    data-testid="examples-tab"
  >
    <div class="flex flex-col gap-1">
      <component
        :is="headingTag"
        :id="headingId"
        class="text-sm font-bold text-primary-warm-white"
      >
        {{
          t(
            samplesOnly
              ? 'workshop.examples.samples'
              : 'workshop.examples.start'
          )
        }}
      </component>
    </div>

    <p v-if="!examples.length" class="text-sm text-primary-warm-gray">
      {{ t('workshop.examples.empty') }}
    </p>

    <ul
      v-else
      ref="gallery"
      :class="
        cn(
          'scrollbar-hide flex snap-x gap-3 overflow-x-auto max-sm:-mx-6 max-sm:-my-1 max-sm:scroll-px-6 max-sm:px-6 max-sm:py-1 sm:grid sm:max-w-5xl sm:justify-start sm:overflow-visible',
          desktopGridColumns
        )
      "
    >
      <li
        v-for="example in examples"
        :key="example.id"
        class="w-4/5 shrink-0 snap-start max-sm:max-w-72 sm:w-auto"
        data-testid="example-item"
      >
        <ExampleCard
          :example
          :active="example.id === activeId"
          :alt="altOf(example)"
          :video-preload
          :locale
          :disabled
          @open="emit('open', example)"
        />
      </li>
    </ul>
  </section>
</template>
