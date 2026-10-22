<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  Direction,
  DirectionGroup,
  DirectionPart
} from '@/lib/workshop/cinematic-studio/catalog'
import type { Locale } from '@/i18n/translations'
import CinematicOptionList from './CinematicOptionList.vue'
import CinematicPickerTabs from './CinematicPickerTabs.vue'

const {
  groups,
  direction,
  locale = 'en'
} = defineProps<{
  groups: readonly DirectionGroup[]
  direction: Direction
  locale?: Locale
}>()

const emit = defineEmits<{ choose: [part: DirectionPart, id: string] }>()

const activePart = ref(groups[0].part)
</script>

<template>
  <CinematicPickerTabs
    v-model="activePart"
    :groups
    :locale
    class="mb-3 grid-cols-4 sm:hidden"
  />
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <CinematicOptionList
      v-for="group in groups"
      :key="group.part"
      :class="
        cn(
          'max-sm:col-start-1 max-sm:row-start-1',
          activePart !== group.part && 'max-sm:invisible'
        )
      "
      :group
      :selected="direction[group.part]"
      :locale
      @choose="emit('choose', group.part, $event)"
    />
  </div>
</template>
