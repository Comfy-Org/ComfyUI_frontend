<script setup lang="ts">
import { X } from '@lucide/vue'
import { onKeyStroke } from '@vueuse/core'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  Direction,
  DirectionGroup,
  DirectionPart
} from '../../../lib/workshop/cinematic-studio/catalog'
import { directionOption } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'

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
          {{ t(groups[0].hint, locale) }}
        </p>
      </div>
      <button
        type="button"
        class="grid size-8 place-items-center rounded-lg text-primary-warm-gray hover:bg-transparency-white-t8"
        :aria-label="t('cinematic.picker.close', locale)"
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
        :aria-label="t(group.title, locale)"
        class="flex flex-col gap-3"
      >
        <span v-if="chips" class="text-xs text-primary-warm-gray">
          {{ t(group.title, locale) }}
        </span>
        <div v-if="chips" class="flex flex-wrap gap-2">
          <button
            v-for="option in group.options"
            :key="option.id"
            type="button"
            role="radio"
            :aria-checked="direction[group.part] === option.id"
            :class="
              cn(
                'h-8 rounded-lg border px-3 text-sm transition-colors',
                direction[group.part] === option.id
                  ? 'border-primary-warm-white bg-primary-warm-white text-primary-comfy-ink'
                  : 'border-transparency-white-t20 text-primary-comfy-canvas hover:border-primary-warm-white/60'
              )
            "
            @click="emit('choose', group.part, option.id)"
          >
            {{ t(option.label, locale) }}
          </button>
        </div>
        <div v-else class="grid grid-cols-2 gap-x-3 gap-y-5">
          <button
            v-for="option in group.options"
            :key="option.id"
            type="button"
            role="radio"
            :aria-checked="direction[group.part] === option.id"
            class="group flex flex-col gap-2 text-left"
            @click="emit('choose', group.part, option.id)"
          >
            <span
              :class="
                cn(
                  'relative flex aspect-8/5 w-full overflow-hidden rounded-xl bg-transparency-white-t4 ring-1 ring-transparency-white-t8 transition-shadow group-hover:ring-transparency-white-t20',
                  direction[group.part] === option.id &&
                    'ring-2 ring-primary-warm-white group-hover:ring-primary-warm-white'
                )
              "
            >
              <img
                v-if="option.preview"
                :src="option.preview"
                alt=""
                loading="lazy"
                class="size-full object-cover"
              />
              <template v-else>
                <span
                  v-for="(color, index) in option.palette"
                  :key="index"
                  class="h-full flex-1"
                  :style="{ backgroundColor: color }"
                />
              </template>
            </span>
            <span class="text-sm font-semibold text-primary-warm-white">
              {{ t(option.label, locale) }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <footer
      class="flex items-center gap-3 border-t border-transparency-white-t8 px-6 pt-4 pb-6"
    >
      <p class="min-w-0 flex-1 truncate text-xs text-primary-warm-gray">
        {{
          adds
            ? t('cinematic.picker.adds', locale).replace('{words}', adds)
            : t('cinematic.picker.addsNothing', locale)
        }}
      </p>
      <button
        type="button"
        class="h-9 rounded-lg bg-transparency-white-t8 px-4 text-sm text-primary-warm-white hover:bg-transparency-white-t20"
        @click="emit('close')"
      >
        {{ t('cinematic.picker.done', locale) }}
      </button>
    </footer>
  </section>
</template>
