<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

interface Props {
  filterIndex: number
}

defineProps<Props>()

const emit = defineEmits<{
  'update:filterIndex': [index: number]
}>()

const filterButtonStyle =
  'px-4 py-2 rounded-md inline-flex justify-center items-center cursor-pointer hover:text-black hover:dark-theme:text-white'

const handleFilterClick = (index: number) => {
  emit('update:filterIndex', index)
}
</script>

<template>
  <!-- TODO: remove this ⬇️ -->
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <div class="flex gap-1 text-zinc-400 px-4 mb-4">
    <div
      :class="
        cn(
          filterButtonStyle,
          filterIndex === 0
            ? '!bg-zinc-500/20 text-black dark-theme:text-white'
            : 'bg-transparent'
        )
      "
      @click="handleFilterClick(0)"
    >
      Inputs
    </div>
    <div
      :class="
        cn(
          filterButtonStyle,
          filterIndex === 1
            ? '!bg-zinc-500/20 text-black dark-theme:text-white'
            : 'bg-transparent'
        )
      "
      @click="handleFilterClick(1)"
    >
      Outputs
    </div>
  </div>
</template>
