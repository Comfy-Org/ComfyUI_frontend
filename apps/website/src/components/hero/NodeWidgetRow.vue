<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { Shuffle } from '@lucide/vue'

import { ref } from 'vue'

const {
  label,
  value,
  labelWidth,
  fill = 0,
  shuffle = false,
  notch = false
} = defineProps<{
  label: string
  value: string
  labelWidth?: string
  fill?: number
  shuffle?: boolean
  notch?: boolean
}>()

const emit = defineEmits<{
  step: [direction: 1 | -1]
  commit: [raw: string]
  shuffle: []
}>()

const editing = ref(false)
const draft = ref('')

function startEditing() {
  draft.value = value
  editing.value = true
}

function commit() {
  if (!editing.value) return
  editing.value = false
  emit('commit', draft.value)
}

function focusInput(el: unknown) {
  if (el instanceof HTMLInputElement) el.select()
}
</script>

<template>
  <div
    class="relative flex h-[1.625em] items-center gap-[0.625em] text-[0.75em]"
  >
    <span
      v-if="notch"
      class="bg-primary-comfy-ink-light absolute top-1/2 left-[-0.85em] h-[0.85em] w-[0.35em] -translate-y-1/2 rounded-[0.2em] border border-white/25"
    />
    <span :class="cn('shrink-0 text-white/60', labelWidth)">{{ label }}</span>
    <div
      class="relative flex h-full min-w-0 flex-1 items-center gap-[0.5em] overflow-hidden rounded-[0.375em] bg-black/25 px-[0.625em]"
    >
      <span
        v-if="fill > 0 && !editing"
        class="absolute inset-y-0 left-0 bg-[#3d4c63]"
        :style="{ width: `${fill * 100}%` }"
      />
      <button
        type="button"
        class="relative cursor-pointer text-white/40 hover:text-white/90"
        :aria-label="`Decrease ${label}`"
        @click="emit('step', -1)"
      >
        —
      </button>
      <input
        v-if="editing"
        :ref="focusInput"
        v-model="draft"
        class="relative min-w-0 flex-1 bg-transparent text-white outline-none"
        :aria-label="label"
        @blur="commit"
        @keydown.enter="commit"
        @keydown.escape="editing = false"
      />
      <button
        v-else
        type="button"
        class="relative min-w-0 flex-1 cursor-text truncate text-left text-white/90"
        :aria-label="`Edit ${label}`"
        @click="startEditing"
      >
        {{ value }}
      </button>
      <button
        v-if="shuffle"
        type="button"
        class="relative flex h-[1.125em] w-[1.375em] shrink-0 cursor-pointer items-center justify-center rounded-[0.25em] bg-[#4a90d9] hover:bg-[#5ba0e5]"
        :aria-label="`Randomize ${label}`"
        @click="emit('shuffle')"
      >
        <Shuffle
          class="size-[0.75em] text-primary-comfy-ink"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        class="relative cursor-pointer text-white/40 hover:text-white/90"
        :aria-label="`Increase ${label}`"
        @click="emit('step', 1)"
      >
        +
      </button>
    </div>
  </div>
</template>
