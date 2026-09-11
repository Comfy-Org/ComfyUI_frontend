<script setup lang="ts">
import { Check, Music2 } from '@lucide/vue'
import { computed } from 'vue'

import type { PlaygroundExample } from '../../config/workshop-playground'
import { isVideoUrl } from '../../config/workshop-playground'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

import { cn } from '@comfyorg/tailwind-utils'

const {
  examples,
  activeId,
  locale = 'en'
} = defineProps<{
  examples: readonly PlaygroundExample[]
  activeId?: string
  locale?: Locale
}>()

const emit = defineEmits<{ open: [example: PlaygroundExample] }>()

const specsOf = (example: PlaygroundExample) => example.specs.join(' · ')
const samplesOnly = computed(
  () => examples.length > 0 && examples.every((example) => example.sampleOnly)
)

function actionFor(example: PlaygroundExample, active = false) {
  const key = example.sampleOnly
    ? active
      ? 'workshop.examples.viewing'
      : 'workshop.examples.view'
    : active
      ? 'workshop.examples.using'
      : 'workshop.examples.use'
  return t(key, locale)
}
</script>

<template>
  <section class="flex flex-col gap-4" data-testid="examples-tab">
    <div class="flex flex-col gap-1">
      <h2 class="text-sm font-bold text-primary-warm-white">
        {{
          t(
            samplesOnly
              ? 'workshop.examples.samples'
              : 'workshop.examples.start',
            locale
          )
        }}
      </h2>
      <p class="text-sm text-primary-warm-gray">
        {{
          t(
            samplesOnly
              ? 'workshop.examples.samplesSubtitle'
              : examples.length === 1
                ? 'workshop.examples.subtitleOne'
                : 'workshop.examples.subtitle',
            locale
          )
        }}
      </p>
    </div>

    <p v-if="!examples.length" class="text-sm text-primary-warm-gray">
      {{ t('workshop.examples.empty', locale) }}
    </p>

    <!-- A phone scrolls the examples sideways, edge to edge; from a tablet up
      they fit in a row of their own. -->
    <ul
      v-else
      class="flex scrollbar-hide snap-x gap-3 overflow-x-auto max-sm:-mx-6 max-sm:-my-1 max-sm:scroll-px-6 max-sm:px-6 max-sm:py-1 sm:grid sm:max-w-2xl sm:grid-cols-3 sm:overflow-visible"
    >
      <li
        v-for="example in examples"
        :key="example.id"
        class="w-36 shrink-0 snap-start sm:w-auto"
      >
        <button
          type="button"
          :aria-label="
            example.sampleOnly
              ? actionFor(example)
              : t('workshop.examples.open', locale)
          "
          :aria-current="example.id === activeId ? 'true' : undefined"
          class="group flex w-full cursor-pointer flex-col gap-2 text-left outline-none"
          data-testid="example-card"
          :title="actionFor(example, example.id === activeId)"
          @click="emit('open', example)"
        >
          <span
            :class="
              cn(
                'bg-primary-comfy-ink-light relative block aspect-video overflow-hidden rounded-lg ring-1 transition-[box-shadow,transform,filter]',
                example.id === activeId
                  ? 'ring-primary-comfy-yellow ring-2'
                  : 'group-focus-visible:ring-primary-comfy-yellow ring-transparency-white-t8 group-hover:-translate-y-0.5 group-hover:ring-transparency-white-t20 group-hover:brightness-110'
              )
            "
          >
            <video
              v-if="
                example.mediaKind === 'video' || isVideoUrl(example.outputUrl)
              "
              :src="example.outputUrl"
              class="size-full object-cover"
              muted
              playsinline
              preload="metadata"
            />
            <Music2
              v-else-if="example.mediaKind === 'audio'"
              class="size-full px-3"
              aria-hidden="true"
            />
            <img
              v-else-if="example.outputUrl"
              :src="example.outputUrl"
              :alt="example.title"
              class="size-full object-cover"
              loading="lazy"
              decoding="async"
            />

            <span
              v-if="example.id === activeId"
              class="bg-primary-comfy-yellow absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full text-primary-comfy-ink"
              data-testid="example-chosen"
            >
              <Check class="size-3" :stroke-width="3" aria-hidden="true" />
            </span>
            <span
              v-else
              class="absolute inset-x-0 bottom-0 truncate bg-black/70 px-2 py-1 text-center text-[11px] font-medium text-primary-warm-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden="true"
            >
              {{ actionFor(example) }}
            </span>
          </span>

          <span class="flex flex-col gap-0.5">
            <span
              :class="
                cn(
                  'line-clamp-2 text-xs transition-colors',
                  example.id === activeId
                    ? 'text-primary-warm-white'
                    : 'text-primary-comfy-canvas group-hover:text-primary-warm-white'
                )
              "
            >
              {{ example.title }}
            </span>
            <span
              v-if="specsOf(example)"
              class="text-[11px] text-primary-warm-gray"
              data-testid="example-specs"
            >
              {{ specsOf(example) }}
            </span>
          </span>
        </button>
        <audio
          v-if="example.mediaKind === 'audio'"
          :src="example.outputUrl"
          :aria-label="example.title"
          controls
          preload="metadata"
          class="mt-2 w-full"
        />
      </li>
    </ul>
  </section>
</template>
