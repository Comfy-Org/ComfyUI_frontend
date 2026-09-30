<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

import type {
  Direction,
  DirectionGroup,
  DirectionPart
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import CinematicGradeImageTile from './CinematicGradeImageTile.vue'
import CinematicOptionGrid from './CinematicOptionGrid.vue'
import CinematicPaletteEditor from './CinematicPaletteEditor.vue'
import CinematicPickerLists from './CinematicPickerLists.vue'
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

const colors = defineModel<readonly string[]>('colors', { required: true })
const mainColor = defineModel<number | undefined>('mainColor')

const multiple = groups.length > 1
const editing = defineModel<boolean>('editing', { default: false })

function choose(part: DirectionPart, id: string) {
  if (part === 'grade') {
    colors.value = []
    mainColor.value = undefined
    editing.value = false
  }
  emit('choose', part, id)
  if (!multiple) emit('close')
}

const sideBySide = useMediaQuery('(min-width: 1024px)')

function finishEditing() {
  editing.value = false
  if (!sideBySide.value) emit('close')
}

function usePalette(sampled: readonly string[]) {
  colors.value = sampled
  mainColor.value = undefined
  emit('choose', 'grade', 'auto')
}

const selectedIn = (part: DirectionPart) =>
  part === 'grade' && colors.value.length ? '' : direction[part]
</script>

<template>
  <CinematicPopover :title :locale @close="emit('close')">
    <CinematicPickerLists
      v-if="multiple"
      :groups
      :direction
      :locale
      @choose="choose"
    />
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
          :colors
          :locale
          @picked="usePalette"
          @edit="editing = true"
        />
        <template v-if="group.part === 'grade'" #row>
          <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="-translate-y-2 opacity-0"
            leave-active-class="transition duration-150 ease-in"
            leave-to-class="-translate-y-2 opacity-0"
          >
            <CinematicPaletteEditor
              v-if="editing && colors.length"
              v-model:colors="colors"
              v-model:main="mainColor"
              :locale
              class="col-span-2"
              @done="finishEditing"
            />
          </Transition>
        </template>
      </CinematicOptionGrid>
    </template>
  </CinematicPopover>
</template>
