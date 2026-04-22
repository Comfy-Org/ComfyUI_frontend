<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

interface CategoryItem {
  label: string
  value: string
}

const { categories, modelValue } = defineProps<{
  categories: CategoryItem[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <nav
    class="flex items-center gap-3 overflow-x-auto md:flex-col"
    aria-label="Category filter"
  >
    <button
      v-for="category in categories"
      :key="category.value"
      type="button"
      :aria-pressed="modelValue === category.value"
      :class="
        cn(
          'shrink-0 cursor-pointer self-start text-xs font-semibold tracking-wide whitespace-nowrap transition-colors',
          modelValue === category.value
            ? 'text-primary-comfy-ink'
            : 'text-primary-warm-gray hover:text-primary-comfy-canvas'
        )
      "
      @click="emit('update:modelValue', category.value)"
    >
      <span v-if="modelValue === category.value" class="relative inline-block">
        <span
          class="bg-primary-comfy-yellow ppformula-text-center inline-flex items-center rounded-lg px-4 py-2"
        >
          {{ category.label }}
        </span>
        <!-- Triangle pointer -->
        <span
          class="border-t-primary-comfy-yellow absolute bottom-0 left-4 translate-y-full border-x-[6px] border-t-[6px] border-x-transparent"
          aria-hidden="true"
        />
      </span>
      <span
        v-else
        class="bg-transparency-white-t4 ppformula-text-center inline-flex items-center rounded-lg px-4 py-2"
      >
        {{ category.label }}
      </span>
    </button>
  </nav>
</template>
