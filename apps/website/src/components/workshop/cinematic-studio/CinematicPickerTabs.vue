<script setup lang="ts">
import type {
  Direction,
  DirectionGroup,
  DirectionPart
} from '../../../lib/workshop/cinematic-studio/catalog'
import { directionOption } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const {
  groups,
  direction,
  showChoice,
  locale = 'en'
} = defineProps<{
  groups: readonly DirectionGroup[]
  direction: Direction
  showChoice: boolean
  locale?: Locale
}>()

const active = defineModel<DirectionPart>({ required: true })
</script>

<template>
  <div class="grid gap-1 rounded-xl bg-transparency-white-t4 p-1">
    <button
      v-for="group in groups"
      :key="group.part"
      type="button"
      :aria-pressed="active === group.part"
      class="group flex min-w-0 flex-col items-center justify-center rounded-lg px-1 py-1.5 text-xs font-semibold text-primary-comfy-canvas hover:bg-transparency-white-t8 aria-pressed:bg-primary-warm-white aria-pressed:text-primary-comfy-ink"
      @click="active = group.part"
    >
      <span class="max-w-full truncate">{{ tc(group.title, locale) }}</span>
      <span
        v-if="showChoice"
        class="max-w-full truncate text-[11px] font-normal text-primary-warm-gray group-aria-pressed:text-primary-comfy-ink/70"
      >
        {{ tc(directionOption(group.part, direction).label, locale) }}
      </span>
    </button>
  </div>
</template>
