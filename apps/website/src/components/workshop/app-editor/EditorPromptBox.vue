<script setup lang="ts">
import { useId } from 'vue'

/**
 * The one prompt box every app uses: a roomy text area with an optional row
 * underneath for extras such as references or a prompt switch.
 */
const {
  label,
  placeholder,
  disabled = false
} = defineProps<{
  label: string
  placeholder?: string
  disabled?: boolean
}>()
const value = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <section>
    <label :for="id" class="sr-only">{{ label }}</label>
    <div
      class="flex flex-col overflow-hidden rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 focus-within:border-primary-warm-white/60"
    >
      <textarea
        :id
        v-model="value"
        rows="4"
        :placeholder
        :disabled
        class="h-28 resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray disabled:opacity-40"
      />
      <div
        v-if="$slots.default"
        class="flex items-center justify-between gap-2 pr-3 pb-2.5 pl-2.5"
      >
        <slot />
      </div>
    </div>
  </section>
</template>
