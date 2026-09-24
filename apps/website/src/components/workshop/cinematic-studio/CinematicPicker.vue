<script setup lang="ts">
import { X } from '@lucide/vue'
import { onKeyStroke } from '@vueuse/core'
import { computed } from 'vue'

import type {
  Direction,
  DirectionGroup,
  DirectionPart
} from '../../../lib/workshop/cinematic-studio/catalog'
import { directionOption } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicOptionChips from './CinematicOptionChips.vue'
import CinematicOptionGrid from './CinematicOptionGrid.vue'

const {
  groups,
  direction,
  title,
  locale = 'en'
} = defineProps<{
  groups: readonly DirectionGroup[]
  direction: Direction
  title: string
  locale?: Locale
}>()

const emit = defineEmits<{
  choose: [part: DirectionPart, id: string]
  close: []
}>()

onKeyStroke('Escape', () => emit('close'))

const chips = computed(() => groups.length > 1)
const adds = computed(() =>
  groups
    .map((group) => directionOption(group.part, direction).phrase)
    .filter(Boolean)
    .join(', ')
)
</script>

<template>
  <section
    role="dialog"
    :aria-label="title"
    class="flex h-full w-[480px] flex-col border-r border-transparency-white-t8 bg-primary-comfy-ink shadow-[24px_0_48px_rgb(0_0_0/0.35)]"
    data-testid="cinematic-picker"
  >
    <header class="flex items-start gap-3 px-6 pt-6 pb-4">
      <div class="flex flex-1 flex-col gap-1">
        <h2 class="text-base font-semibold text-primary-warm-white">
          {{ title }}
        </h2>
        <p class="text-xs text-primary-warm-gray">
          {{ tc(groups[0].hint, locale) }}
        </p>
      </div>
      <button
        type="button"
        class="grid size-8 place-items-center rounded-lg text-primary-warm-gray hover:bg-transparency-white-t8"
        :aria-label="tc('cinematic.picker.close', locale)"
        @click="emit('close')"
      >
        <X class="size-4" aria-hidden="true" />
      </button>
    </header>

    <div class="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6">
      <div
        v-for="group in groups"
        :key="group.part"
        role="radiogroup"
        :aria-label="tc(group.title, locale)"
        class="flex flex-col gap-3"
      >
        <span v-if="chips" class="text-xs text-primary-warm-gray">
          {{ tc(group.title, locale) }}
        </span>
        <CinematicOptionChips
          v-if="chips"
          :group
          :selected="direction[group.part]"
          :locale
          @choose="emit('choose', group.part, $event)"
        />
        <CinematicOptionGrid
          v-else
          :group
          :selected="direction[group.part]"
          :locale
          @choose="emit('choose', group.part, $event)"
        />
      </div>
    </div>

    <footer
      class="flex items-center gap-3 border-t border-transparency-white-t8 px-6 pt-4 pb-6"
    >
      <p class="min-w-0 flex-1 truncate text-xs text-primary-warm-gray">
        {{
          adds
            ? tc('cinematic.picker.adds', locale).replace('{words}', adds)
            : tc('cinematic.picker.addsNothing', locale)
        }}
      </p>
      <button
        type="button"
        class="h-9 rounded-lg bg-transparency-white-t8 px-4 text-sm text-primary-warm-white hover:bg-transparency-white-t20"
        @click="emit('close')"
      >
        {{ tc('cinematic.picker.done', locale) }}
      </button>
    </footer>
  </section>
</template>
