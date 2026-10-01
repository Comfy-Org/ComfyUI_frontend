<script setup lang="ts">
import { X } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import type { MoveObject } from '../../../lib/workshop/move-anything/arrange'
import { isMoved } from '../../../lib/workshop/move-anything/arrange'
import { mc } from '../../../lib/workshop/move-anything/copy'

const {
  objects,
  selected,
  locale = 'en'
} = defineProps<{
  objects: readonly MoveObject[]
  selected?: string
  locale?: Locale
}>()

const emit = defineEmits<{ select: [id: string]; remove: [id: string] }>()
</script>

<template>
  <p v-if="!objects.length" class="px-1 text-xs text-primary-warm-gray">
    {{ mc('move.objects.empty', locale) }}
  </p>
  <ul
    v-else
    class="flex flex-col gap-0.5"
    :aria-label="mc('move.objects', locale)"
  >
    <li
      v-for="(object, index) in objects"
      :key="object.id"
      :class="
        cn(
          'group flex h-9 items-center gap-2 rounded-lg pr-0.5 pl-2 transition',
          object.id === selected
            ? 'bg-transparency-white-t8'
            : 'hover:bg-transparency-white-t4'
        )
      "
    >
      <button
        type="button"
        :aria-pressed="object.id === selected"
        class="flex h-full min-w-0 flex-1 items-center gap-2.5 text-left text-xs text-primary-warm-white focus-visible:outline-none"
        @click="emit('select', object.id)"
      >
        <span
          :class="
            cn(
              'flex size-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
              object.id === selected
                ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                : 'bg-transparency-white-t20 text-primary-warm-white'
            )
          "
          >{{ index + 1 }}</span
        >
        <span class="flex-1 truncate">{{ object.label }}</span>
        <span
          :class="
            cn(
              'text-[10px]',
              isMoved(object)
                ? 'text-primary-comfy-yellow'
                : 'text-primary-warm-gray'
            )
          "
          >{{
            mc(
              isMoved(object) ? 'move.object.moved' : 'move.object.inPlace',
              locale
            )
          }}</span
        >
      </button>
      <button
        type="button"
        :aria-label="mc('move.object.remove', locale, { label: object.label })"
        :class="
          cn(
            'flex size-7 items-center justify-center rounded-full text-primary-warm-gray opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none',
            object.id === selected && 'opacity-100'
          )
        "
        @click="emit('remove', object.id)"
      >
        <X class="size-3" aria-hidden="true" />
      </button>
    </li>
  </ul>
</template>
