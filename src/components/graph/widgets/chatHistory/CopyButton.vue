<template>
  <Button
    v-tooltip="
      copied ? $t('chatHistory.copiedTooltip') : $t('chatHistory.copyTooltip')
    "
    text
    rounded
    class="!p-1 !h-4 !w-6 text-gray-400 hover:text-gray-600 dark-theme:hover:text-gray-200 transition"
    pt:icon:class="!text-xs"
    :icon="copied ? 'pi pi-check' : 'pi pi-copy'"
    :aria-label="
      copied ? $t('chatHistory.copiedTooltip') : $t('chatHistory.copyTooltip')
    "
    @click="handleCopy"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { ref } from 'vue'

const { text } = defineProps<{
  text: string
}>()

const copied = ref(false)

const handleCopy = async () => {
  if (!text) return
  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1024)
}
</script>
