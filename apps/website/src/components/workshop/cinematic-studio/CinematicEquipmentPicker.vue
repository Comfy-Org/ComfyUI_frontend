<script setup lang="ts">
import { ChevronLeft, ChevronRight, Check } from '@lucide/vue'
import { computed, nextTick, useTemplateRef } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { DirectionGroup } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import { tcEquipment } from '../../../lib/workshop/cinematic-studio/equipment-copy'
import CinematicEquipmentArt from './CinematicEquipmentArt.vue'

const {
  group,
  selected,
  locale = 'en'
} = defineProps<{
  group: DirectionGroup
  selected: string
  locale?: Locale
}>()
const emit = defineEmits<{ choose: [id: string] }>()
const index = computed(() =>
  Math.max(
    0,
    group.options.findIndex((option) => option.id === selected)
  )
)
const current = computed(() => group.options[index.value])
const options = useTemplateRef<HTMLElement>('options')
const t = (key: Parameters<typeof tcEquipment>[0]) => tcEquipment(key, locale)
const title = computed(() => tc(group.title, locale))
async function chooseIndex(value: number, focus = false) {
  const next = Math.max(0, Math.min(group.options.length - 1, value))
  emit('choose', group.options[next].id)
  if (focus) {
    await nextTick()
    options.value
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next]?.focus()
  }
}
function keyboard(event: KeyboardEvent, position: number) {
  const target =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? group.options.length - 1
        : ['ArrowRight', 'ArrowDown'].includes(event.key)
          ? position + 1
          : ['ArrowLeft', 'ArrowUp'].includes(event.key)
            ? position - 1
            : undefined
  if (target === undefined) return
  event.preventDefault()
  void chooseIndex(target, true)
}
</script>

<template>
  <section
    :aria-label="title"
    class="min-w-0 rounded-xl border border-transparency-white-t8 p-2"
  >
    <h3 class="py-2 text-center text-sm font-semibold text-primary-warm-white">
      {{ title }}
    </h3>
    <div
      class="grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-1 rounded-xl bg-primary-comfy-ink p-2"
    >
      <button
        type="button"
        :aria-label="`${t('previous')} ${title}`"
        :disabled="index === 0"
        class="grid size-9 shrink-0 place-items-center rounded-lg border border-transparency-white-t20 text-primary-warm-white hover:bg-transparency-white-t8 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow disabled:cursor-default disabled:opacity-30"
        @click="chooseIndex(index - 1)"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
      </button>
      <div class="min-w-0 text-center">
        <CinematicEquipmentArt
          :part="group.part"
          :option="current.id"
          class="mx-auto h-28 w-full max-w-44"
        />
      </div>
      <button
        type="button"
        :aria-label="`${t('next')} ${title}`"
        :disabled="index === group.options.length - 1"
        class="grid size-9 shrink-0 place-items-center rounded-lg border border-transparency-white-t20 text-primary-warm-white hover:bg-transparency-white-t8 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow disabled:cursor-default disabled:opacity-30"
        @click="chooseIndex(index + 1)"
      >
        <ChevronRight class="size-4" aria-hidden="true" />
      </button>
      <div class="col-span-3 text-center" aria-live="polite" aria-atomic="true">
        <p
          class="text-sm font-semibold wrap-break-word text-primary-warm-white"
        >
          {{ tc(current.label, locale) }}
        </p>
        <p class="mt-1 mb-2 text-xs text-primary-comfy-canvas">
          {{ index + 1 }} {{ t('of') }} {{ group.options.length }}
        </p>
      </div>
    </div>
    <div
      ref="options"
      role="radiogroup"
      :aria-label="title"
      class="mt-3 flex flex-col gap-1"
    >
      <button
        v-for="(option, position) in group.options"
        :key="option.id"
        type="button"
        role="radio"
        :aria-checked="current.id === option.id"
        :tabindex="current.id === option.id ? 0 : -1"
        :class="
          cn(
            'relative flex min-h-12 items-center gap-2 rounded-lg border p-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow',
            current.id === option.id
              ? 'border-primary-comfy-yellow bg-transparency-white-t8 text-primary-warm-white'
              : 'border-transparent text-primary-comfy-canvas hover:bg-transparency-white-t4'
          )
        "
        @click="emit('choose', option.id)"
        @keydown="keyboard($event, position)"
      >
        <CinematicEquipmentArt
          :part="group.part"
          :option="option.id"
          class="size-8 shrink-0"
        />
        <span class="min-w-0 flex-1 wrap-break-word">{{
          tc(option.label, locale)
        }}</span>
        <Check
          v-if="current.id === option.id"
          class="absolute top-1 right-1 size-3 text-primary-comfy-yellow"
          aria-hidden="true"
        />
      </button>
    </div>
  </section>
</template>
