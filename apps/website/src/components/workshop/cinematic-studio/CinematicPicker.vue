<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  Direction,
  DirectionGroup,
  DirectionPart
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import Button from '@/components/ui/button/Button.vue'
import CinematicOptionGrid from './CinematicOptionGrid.vue'
import CinematicOptionList from './CinematicOptionList.vue'
import CinematicEquipmentPicker from './CinematicEquipmentPicker.vue'
import { tcEquipment } from '../../../lib/workshop/cinematic-studio/equipment-copy'
import CinematicPickerTabs from './CinematicPickerTabs.vue'
import CinematicPopover from './CinematicPopover.vue'

const {
  groups,
  direction,
  title,
  start,
  locale = 'en'
} = defineProps<{
  groups: readonly DirectionGroup[]
  direction: Direction
  title: string
  start?: DirectionPart
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
const equipment = groups.every((group) =>
  ['body', 'lens', 'focal', 'aperture'].includes(group.part)
)
const activePart = ref(start ?? groups[0].part)
const activeGroup = computed(
  () => groups.find((group) => group.part === activePart.value) ?? groups[0]
)

function choose(part: DirectionPart, id: string) {
  emit('choose', part, id)
  if (!multiple) emit('close')
  if (tabbed) advance(part)
}

function advance(part: DirectionPart) {
  const next = groups[groups.findIndex((group) => group.part === part) + 1]
  if (next) activePart.value = next.part
}
</script>

<template>
  <CinematicPopover :title :locale @close="emit('close')">
    <CinematicPickerTabs
      v-if="multiple"
      v-model="activePart"
      :groups
      :locale
      :class="cn('mb-3', tabbed ? 'grid-cols-5' : 'grid-cols-4 sm:hidden')"
    />
    <CinematicOptionGrid
      v-if="tabbed"
      :key="activeGroup.part"
      :group="activeGroup"
      :selected="direction[activeGroup.part]"
      :locale
      @choose="choose(activeGroup.part, $event)"
    />
    <div v-if="tabbed" class="mt-3 flex justify-end">
      <Button size="sm" class="rounded-full" @click="emit('close')">
        {{ tc('cinematic.picker.done', locale) }}
      </Button>
    </div>
    <div v-else-if="multiple" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <component
        :is="equipment ? CinematicEquipmentPicker : CinematicOptionList"
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
    <div
      v-if="equipment"
      class="mt-3 flex flex-wrap items-center justify-between gap-3"
    >
      <p class="max-w-2xl text-xs text-primary-comfy-canvas">
        {{ tcEquipment('guidance', locale) }}
      </p>
      <Button size="sm" @click="emit('close')">{{
        tc('cinematic.picker.done', locale)
      }}</Button>
    </div>
  </CinematicPopover>
</template>
