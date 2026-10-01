<script setup lang="ts">
import type {
  DirectionGroup,
  DirectionPart
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const { groups, locale = 'en' } = defineProps<{
  groups: readonly DirectionGroup[]
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
      class="h-9 min-w-0 truncate rounded-lg px-1 text-xs font-semibold text-primary-comfy-canvas hover:bg-transparency-white-t8 aria-pressed:bg-primary-warm-white aria-pressed:text-primary-comfy-ink"
      @click="active = group.part"
    >
      {{ tc(group.title, locale) }}
    </button>
  </div>
</template>
