<script setup lang="ts">
import { Eye, EyeOff, Trash2 } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import EditorIconButton from '@/components/workshop/app-editor/EditorIconButton.vue'

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
        'group flex h-9 items-center gap-0.5 rounded-lg pr-0.5 pl-2 transition',
        checked ? 'bg-transparency-white-t8' : 'hover:bg-transparency-white-t4'
      )
    "
  >
    <button
      type="button"
      role="radio"
      :aria-checked="checked"
      :class="
        cn(
          'flex h-full min-w-0 flex-1 items-center gap-2.5 text-left text-xs text-primary-warm-gray focus-visible:outline-none disabled:opacity-40',
          checked && 'text-primary-warm-white'
        )
      "
      @click="emit('pick')"
    >
      <span
        :class="
          cn(
            'flex size-3.5 shrink-0 items-center justify-center rounded-full border border-transparency-white-t20',
            checked && 'border-primary-warm-white'
          )
        "
        aria-hidden="true"
      >
        <span
          v-if="checked"
          class="size-1.5 rounded-full bg-primary-warm-white"
        />
      </span>
      <span class="truncate">{{ label }}</span>
    </button>
    <span
      v-if="labels"
      :class="
        cn(
          'flex items-center opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100',
          (checked || shown) && 'opacity-100'
        )
      "
    >
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
    </span>
  </div>
</template>
