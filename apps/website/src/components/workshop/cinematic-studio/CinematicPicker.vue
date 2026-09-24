<script setup lang="ts">
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import { onMounted, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  Direction,
  DirectionGroup,
  DirectionPart
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import CinematicOptionGrid from './CinematicOptionGrid.vue'
import CinematicOptionList from './CinematicOptionList.vue'

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

const root = useTemplateRef<HTMLElement>('root')
onKeyStroke('Escape', () => emit('close'), { target: root })
onClickOutside(root, () => emit('close'), {
  ignore: ['[aria-haspopup="dialog"]']
})
onMounted(() => {
  const target =
    root.value?.querySelector<HTMLElement>('[aria-checked="true"]') ??
    root.value?.querySelector<HTMLElement>('button')
  target?.focus()
})

const columns = groups.length > 1

function choose(part: DirectionPart, id: string) {
  emit('choose', part, id)
  if (!columns) emit('close')
}
</script>

<template>
  <section
    ref="root"
    role="dialog"
    :aria-label="title"
    :class="
      cn(
        'flex max-w-[calc(100vw-404px)] flex-col overflow-y-auto rounded-2xl border border-transparency-white-t8 bg-primary-comfy-ink p-3 shadow-[0_24px_64px_rgb(0_0_0/0.5)]',
        columns ? 'w-[980px]' : 'w-[720px]'
      )
    "
    data-testid="cinematic-picker"
  >
    <div v-if="columns" class="grid grid-cols-4 gap-3">
      <CinematicOptionList
        v-for="group in groups"
        :key="group.part"
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
  </section>
</template>
