<script setup lang="ts">
import { Plus, X } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import type { MoveObject } from '@/lib/workshop/move-anything/arrange'
import { MAX_OBJECTS, isMoved } from '@/lib/workshop/move-anything/arrange'
import { mc } from '@/lib/workshop/move-anything/copy'
import EditorTray from '@/components/workshop/app-editor/EditorTray.vue'

const {
  objects,
  selected,
  locale = 'en'
} = defineProps<{
  objects: readonly MoveObject[]
  selected?: string
  locale?: Locale
}>()

const emit = defineEmits<{
  select: [id: string]
  remove: [id: string]
  add: []
  close: []
}>()
</script>

<template>
  <EditorTray
    :title="mc('move.objects', locale)"
    :close-label="mc('move.close', locale)"
    class="max-w-95"
    @close="emit('close')"
  >
    <template #actions>
      <span class="text-[11px] text-primary-warm-gray">{{
        mc('move.objects.count', locale, {
          n: objects.length,
          max: MAX_OBJECTS
        })
      }}</span>
    </template>
    <p v-if="!objects.length" class="px-2 py-1 text-xs text-primary-warm-gray">
      {{ mc('move.objects.empty', locale) }}
    </p>
    <ul v-else class="flex flex-col gap-px">
      <li
        v-for="(object, index) in objects"
        :key="object.id"
        :class="
          cn(
            'flex h-8.5 items-center gap-2 rounded-lg pr-1 pl-2',
            object.id === selected && 'bg-transparency-white-t8'
          )
        "
      >
        <button
          type="button"
          class="flex flex-1 items-center gap-2 text-left text-xs text-primary-warm-white focus-visible:outline-none"
          @click="emit('select', object.id)"
        >
          <span
            :class="
              cn(
                'flex size-4.5 items-center justify-center rounded-full text-[10px] font-semibold',
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
          :aria-label="
            mc('move.object.remove', locale, { label: object.label })
          "
          class="flex size-6 items-center justify-center rounded-full text-primary-warm-gray hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
          @click="emit('remove', object.id)"
        >
          <X class="size-3" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <button
      type="button"
      :disabled="objects.length >= MAX_OBJECTS"
      class="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-transparency-white-t20 text-[11px] text-primary-warm-gray transition hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-50"
      @click="emit('add')"
    >
      <Plus class="size-3" aria-hidden="true" />
      {{
        objects.length >= MAX_OBJECTS
          ? mc('move.objects.full', locale, { max: MAX_OBJECTS })
          : mc('move.objects.add', locale)
      }}
    </button>
  </EditorTray>
</template>
