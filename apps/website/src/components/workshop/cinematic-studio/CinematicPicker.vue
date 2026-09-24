<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  Direction,
  DirectionGroup,
  DirectionPart
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicOptionGrid from './CinematicOptionGrid.vue'
import CinematicOptionList from './CinematicOptionList.vue'
import CinematicPopover from './CinematicPopover.vue'

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

const columns = groups.length > 1
const phonePart = ref(groups[0].part)

function choose(part: DirectionPart, id: string) {
  emit('choose', part, id)
  if (!columns) emit('close')
}
</script>

<template>
  <CinematicPopover :title :locale @close="emit('close')">
    <div
      v-if="columns"
      class="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-transparency-white-t4 p-1 sm:hidden"
    >
      <button
        v-for="group in groups"
        :key="group.part"
        type="button"
        :aria-pressed="phonePart === group.part"
        :class="
          cn(
            'h-9 truncate rounded-lg px-1 text-xs font-semibold',
            phonePart === group.part
              ? 'bg-primary-warm-white text-primary-comfy-ink'
              : 'text-primary-comfy-canvas'
          )
        "
        @click="phonePart = group.part"
      >
        {{ tc(group.title, locale) }}
      </button>
    </div>
    <div v-if="columns" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <CinematicOptionList
        v-for="group in groups"
        :key="group.part"
        :class="phonePart !== group.part && 'max-sm:hidden'"
        :group
        :selected="direction[group.part]"
        :locale
        @choose="choose(group.part, $event)"
      />
    </div>
    <template v-else>
      <CinematicOptionGrid
        v-for="group in groups"
        :key="group.part"
        :group
        :selected="direction[group.part]"
        :locale
        @choose="choose(group.part, $event)"
      />
    </template>
  </CinematicPopover>
</template>
