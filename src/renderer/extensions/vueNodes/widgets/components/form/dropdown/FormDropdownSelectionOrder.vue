<script setup lang="ts">
import { inject, nextTick, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { AssetKindKey } from './types'
import type { FormDropdownItem } from './types'

const { items } = defineProps<{
  items: readonly FormDropdownItem[]
}>()

const emit = defineEmits<{
  reorder: [ids: string[]]
}>()

const assetKind = inject(AssetKindKey)
const listRef = useTemplateRef<HTMLOListElement>('listRef')
const draggedIndex = ref<number>()

function moveTo(from: number, to: number) {
  if (from === to || to < 0 || to >= items.length) return
  const ids = items.map((item) => item.id)
  const [moved] = ids.splice(from, 1)
  ids.splice(to, 0, moved)
  emit('reorder', ids)
}

async function moveWithKeyboard(event: KeyboardEvent, index: number) {
  const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key]
  if (step === undefined) return
  event.preventDefault()
  const id = items[index].id
  moveTo(index, index + step)
  await nextTick()
  const newIndex = items.findIndex((item) => item.id === id)
  const entry = listRef.value?.children[newIndex]
  if (entry instanceof HTMLElement) entry.focus()
}

function dropOn(index: number) {
  if (draggedIndex.value !== undefined) moveTo(draggedIndex.value, index)
  draggedIndex.value = undefined
}
</script>

<template>
  <div class="px-4 pt-2" data-testid="form-dropdown-selection-order">
    <p class="mb-1 text-xs text-muted-foreground">
      {{ $t('widgets.uploadSelect.reorderHint') }}
    </p>
    <ol
      ref="listRef"
      class="flex gap-2 overflow-x-auto pb-1"
      :aria-label="$t('widgets.uploadSelect.selectionOrder')"
    >
      <li
        v-for="(item, index) in items"
        :key="item.id"
        draggable="true"
        tabindex="0"
        aria-keyshortcuts="ArrowLeft ArrowRight"
        :aria-label="`${index + 1}. ${item.label ?? item.name}`"
        :title="item.label ?? item.name"
        :class="
          cn(
            'relative size-12 shrink-0 cursor-grab overflow-hidden rounded-sm bg-muted outline-offset-1 focus-visible:outline-2 focus-visible:outline-foreground',
            draggedIndex === index && 'opacity-50'
          )
        "
        @dragstart="draggedIndex = index"
        @dragend="draggedIndex = undefined"
        @dragover.prevent
        @drop.prevent="dropOn(index)"
        @keydown="moveWithKeyboard($event, index)"
      >
        <video
          v-if="assetKind === 'video' && item.preview_url"
          :src="item.preview_url"
          muted
          preload="metadata"
          class="pointer-events-none size-full object-cover"
        />
        <img
          v-else-if="item.preview_url"
          :src="item.preview_url"
          alt=""
          draggable="false"
          class="size-full object-cover"
        />
        <span
          v-else
          class="flex size-full items-center justify-center p-1 text-center text-xs break-all text-muted-foreground"
        >
          {{ item.label ?? item.name }}
        </span>
        <span
          class="absolute top-0.5 left-0.5 flex size-4 items-center justify-center rounded-full bg-foreground text-xs leading-none text-background"
          aria-hidden="true"
        >
          {{ index + 1 }}
        </span>
      </li>
    </ol>
  </div>
</template>
