<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

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
        :class="
          cn(
            'max-sm:col-start-1 max-sm:row-start-1',
            activePart !== group.part && 'max-sm:invisible'
          )
        "
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
        <template v-if="group.part === 'grade'" #row>
          <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="-translate-y-2 opacity-0"
            leave-active-class="transition duration-150 ease-in"
            leave-to-class="-translate-y-2 opacity-0"
          >
            <CinematicColors
              v-if="editing && colors.length"
              v-model="colors"
              v-model:main="mainColor"
              :locale
              class="col-span-2"
            >
              <button
                type="button"
                class="h-10 w-full rounded-xl bg-primary-warm-white text-sm font-semibold text-primary-comfy-ink transition-colors hover:bg-primary-comfy-yellow"
                @click="finishEditing"
              >
                {{ tc('cinematic.grade.done', locale) }}
              </button>
            </CinematicColors>
          </Transition>
        </template>
      </CinematicOptionGrid>
    </div>
  </CinematicPopover>
</template>
