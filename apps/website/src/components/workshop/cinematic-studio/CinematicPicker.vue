<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  Direction,
  DirectionGroup,
  DirectionPart
} from '../../../lib/workshop/cinematic-studio/catalog'
import { directionOption } from '../../../lib/workshop/cinematic-studio/catalog'
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

const multiple = groups.length > 1
const visual = groups.some((group) =>
  group.options.some((option) => option.preview || option.palette)
)
const tabbed = multiple && visual
const activePart = ref(groups[0].part)
const activeGroup = computed(
  () => groups.find((group) => group.part === activePart.value) ?? groups[0]
)

function choose(part: DirectionPart, id: string) {
  emit('choose', part, id)
  if (!multiple) emit('close')
}
</script>

<template>
  <CinematicPopover :title :locale @close="emit('close')">
    <div
      v-if="multiple"
      :class="
        cn(
          'mb-3 grid gap-1 rounded-xl bg-transparency-white-t4 p-1',
          tabbed ? 'grid-cols-5' : 'grid-cols-4 sm:hidden'
        )
      "
    >
      <button
        v-for="group in groups"
        :key="group.part"
        type="button"
        :aria-pressed="activePart === group.part"
        :class="
          cn(
            'flex min-w-0 flex-col items-center justify-center rounded-lg px-1 py-1.5 text-xs font-semibold',
            activePart === group.part
              ? 'bg-primary-warm-white text-primary-comfy-ink'
              : 'text-primary-comfy-canvas hover:bg-transparency-white-t8'
          )
        "
        @click="activePart = group.part"
      >
        <span class="max-w-full truncate">{{ tc(group.title, locale) }}</span>
        <span
          v-if="tabbed"
          :class="
            cn(
              'max-w-full truncate text-[11px] font-normal',
              activePart === group.part
                ? 'text-primary-comfy-ink/70'
                : 'text-primary-warm-gray'
            )
          "
        >
          {{ tc(directionOption(group.part, direction).label, locale) }}
        </span>
      </button>
    </div>
    <CinematicOptionGrid
      v-if="tabbed"
      :key="activeGroup.part"
      :group="activeGroup"
      :selected="direction[activeGroup.part]"
      :locale
      @choose="choose(activeGroup.part, $event)"
    />
    <div v-else-if="multiple" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        :selected="direction[group.part]"
        :locale
        @choose="choose(group.part, $event)"
      />
    </template>
  </CinematicPopover>
</template>
