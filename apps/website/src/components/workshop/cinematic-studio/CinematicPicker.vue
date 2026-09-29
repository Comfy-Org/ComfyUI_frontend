<script setup lang="ts">
import { ref } from 'vue'

import type {
  Direction,
  DirectionGroup,
  DirectionPart
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import type { StudioImage } from '../../../lib/workshop/cinematic-studio/take-image'
import CinematicGradeImageTile from './CinematicGradeImageTile.vue'
import CinematicOptionGrid from './CinematicOptionGrid.vue'
import CinematicOptionList from './CinematicOptionList.vue'
import CinematicPickerTabs from './CinematicPickerTabs.vue'
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

const palette = defineModel<StudioImage | undefined>('palette')

const multiple = groups.length > 1
const activePart = ref(groups[0].part)

function choose(part: DirectionPart, id: string) {
  if (part === 'grade') palette.value = undefined
  emit('choose', part, id)
  if (!multiple) emit('close')
}

function matchImage() {
  emit('choose', 'grade', 'auto')
  emit('close')
}

const selectedIn = (part: DirectionPart) =>
  part === 'grade' && palette.value ? '' : direction[part]
</script>

<template>
  <CinematicPopover :title :locale @close="emit('close')">
    <CinematicPickerTabs
      v-if="multiple"
      v-model="activePart"
      :groups
      :locale
      class="mb-3 grid-cols-4 sm:hidden"
    />
    <div v-if="multiple" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <CinematicOptionList
        v-for="group in groups"
        :key="group.part"
        :class="activePart !== group.part && 'max-sm:hidden'"
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
        :selected="selectedIn(group.part)"
        :locale
        @choose="choose(group.part, $event)"
      >
        <CinematicGradeImageTile
          v-if="group.part === 'grade'"
          v-model="palette"
          :locale
          @picked="matchImage"
        />
      </CinematicOptionGrid>
    </template>
  </CinematicPopover>
</template>
