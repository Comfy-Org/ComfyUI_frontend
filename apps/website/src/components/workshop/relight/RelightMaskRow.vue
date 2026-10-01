<script setup lang="ts">
import { Eye, EyeOff, Trash2 } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import EditorIconButton from '../app-editor/EditorIconButton.vue'

const { label, checked, shown, labels } = defineProps<{
  label: string
  checked: boolean
  /** Whether the mask is drawn on the photo; undefined for no mask. */
  shown?: boolean
  labels?: { show: string; hide: string; remove: string }
}>()

const emit = defineEmits<{ pick: []; toggle: []; remove: [] }>()
</script>

<template>
  <div
    :class="
      cn(
        'flex h-10 items-center gap-0.5 rounded-lg border pr-1 pl-2.5 transition',
        checked
          ? 'border-primary-comfy-yellow/40 bg-transparency-white-t8'
          : 'border-transparency-white-t8'
      )
    "
  >
    <button
      type="button"
      role="radio"
      :aria-checked="checked"
      class="flex h-full min-w-0 flex-1 items-center gap-2 text-left text-xs text-primary-warm-white focus-visible:outline-none disabled:opacity-40"
      @click="emit('pick')"
    >
      <span
        :class="
          cn(
            'flex size-3.5 shrink-0 items-center justify-center rounded-full border border-transparency-white-t20',
            checked && 'border-primary-comfy-yellow'
          )
        "
        aria-hidden="true"
      >
        <span
          v-if="checked"
          class="size-1.5 rounded-full bg-primary-comfy-yellow"
        />
      </span>
      <span class="truncate">{{ label }}</span>
    </button>
    <template v-if="labels">
      <EditorIconButton
        :icon="shown ? Eye : EyeOff"
        :label="shown ? labels.hide : labels.show"
        @click="emit('toggle')"
      />
      <EditorIconButton
        :icon="Trash2"
        :label="labels.remove"
        @click="emit('remove')"
      />
    </template>
  </div>
</template>
