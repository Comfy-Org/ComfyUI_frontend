<template>
  <span>
    <div class="mb-1 flex justify-start">
      <div class="max-w-[80%] rounded-xl px-4 py-1">
        <div class="text-[12px] break-words">
          <slot />
        </div>
      </div>
    </div>
    <div class="ml-1 flex justify-start">
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
