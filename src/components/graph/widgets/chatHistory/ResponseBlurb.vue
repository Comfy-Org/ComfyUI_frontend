<template>
  <span>
    <div class="flex justify-start mb-1">
      <div class="rounded-xl px-4 py-1 max-w-[80%]">
        <div class="break-words text-[12px]">
          <slot />
        </div>
      </div>
    </div>
    <div class="flex justify-start ml-1">
      <CopyButton :text="text" />
    </div>
  </span>
</template>

<script setup lang="ts">
import CopyButton from '@/components/graph/widgets/chatHistory/CopyButton.vue'

defineProps<{
  text: string
}>()
</script>
