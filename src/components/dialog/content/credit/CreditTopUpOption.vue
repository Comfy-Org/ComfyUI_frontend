<template>
  <div
    class="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-200"
    :class="[
      selected
        ? 'bg-surface-secondary border-2 border-primary'
        : 'bg-surface-tertiary border border-border-primary hover:bg-surface-secondary'
    ]"
    @click="$emit('select')"
  >
    <div class="flex flex-col">
      <span class="text-base font-medium text-foreground-primary">
        {{ formattedCredits }}
      </span>
      <span class="text-sm text-foreground-secondary">
        {{ description }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCredits } from '@/base/credits/comfyCredits'

const { credits, description, selected } = defineProps<{
  credits: number
  description: string
  selected: boolean
}>()

defineEmits<{
  select: []
}>()

const { locale } = useI18n()

const formattedCredits = computed(() => {
  return formatCredits({ value: credits, locale: locale.value })
})
</script>
