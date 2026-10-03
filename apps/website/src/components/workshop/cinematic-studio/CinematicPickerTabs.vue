<script setup lang="ts">
import { translationsFor } from '../../../i18n/translations'
import type {
  DirectionGroup,
  DirectionPart
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'

const { groups, locale = 'en' } = defineProps<{
  groups: readonly DirectionGroup[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

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
      {{ t(group.title) }}
    </button>
  </div>
</template>
