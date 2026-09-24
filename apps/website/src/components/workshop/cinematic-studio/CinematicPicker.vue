<script setup lang="ts">
import { X } from '@lucide/vue'
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import { onMounted, ref, useTemplateRef } from 'vue'

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
const phonePart = ref(groups[0].part)

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
    class="flex flex-col overflow-y-auto overscroll-contain rounded-2xl border border-transparency-white-t8 bg-primary-comfy-ink p-3 shadow-[0_24px_64px_rgb(0_0_0/0.5)]"
    data-testid="cinematic-picker"
  >
    <header
      class="sticky -top-3 z-10 -mx-3 -mt-3 mb-3 flex items-center justify-between border-b border-transparency-white-t8 bg-primary-comfy-ink px-4 py-3 lg:hidden"
    >
      <h2 class="text-sm font-semibold text-primary-warm-white">
        {{ title }}
      </h2>
      <button
        type="button"
        class="grid size-9 place-items-center rounded-lg text-primary-comfy-canvas hover:bg-transparency-white-t8"
        :aria-label="tc('cinematic.picker.close', locale)"
        @click="emit('close')"
      >
        <X class="size-4" aria-hidden="true" />
      </button>
    </header>
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
    <div v-if="columns" class="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
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
  </section>
</template>
