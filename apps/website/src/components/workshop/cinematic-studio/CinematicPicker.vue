<script setup lang="ts">
import { ref } from 'vue'

import type {
  Direction,
  DirectionGroup,
  DirectionPart
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicColors from './CinematicColors.vue'
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

const colors = defineModel<readonly string[]>('colors', { required: true })
const mainColor = defineModel<number | undefined>('mainColor')

const multiple = groups.length > 1
const activePart = ref(groups[0].part)
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
    <div v-else class="flex flex-col gap-4 lg:flex-row lg:items-start">
      <CinematicOptionGrid
        v-for="group in groups"
        :key="group.part"
        :group
        :selected="selectedIn(group.part)"
        :locale
        class="min-w-0 flex-1"
        @choose="choose(group.part, $event)"
      >
        <CinematicGradeImageTile
          v-if="group.part === 'grade'"
          :colors
          :locale
          @picked="usePalette"
          @edit="editing = true"
        />
      </CinematicOptionGrid>
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-x-4 opacity-0"
        leave-active-class="transition duration-200 ease-in"
        leave-to-class="translate-x-4 opacity-0"
      >
        <div
          v-if="editing && colors.length"
          class="flex shrink-0 flex-col gap-3 lg:sticky lg:top-0 lg:w-80"
        >
          <CinematicColors v-model="colors" v-model:main="mainColor" :locale />
          <button
            type="button"
            class="h-10 w-full rounded-xl bg-primary-warm-white text-sm font-semibold text-primary-comfy-ink transition-colors hover:bg-primary-comfy-yellow"
            @click="editing = false"
          >
            {{ tc('cinematic.grade.done', locale) }}
          </button>
        </div>
      </Transition>
    </div>
  </CinematicPopover>
</template>
