<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

const { disabled = false } = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  addNodesFromGraph: []
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 flex items-start px-4 pt-2 pb-3 text-sm text-muted-foreground"
  >
    <p class="mt-1 line-clamp-2 leading-5">
      {{ t('agent.placeholderPrefix') }}
      <button
        type="button"
        :disabled="disabled"
        :class="
          cn(
            'pointer-events-auto inline-flex items-center gap-1 border-0 bg-transparent p-0 align-middle text-sm text-muted-foreground',
            disabled
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer hover:text-base-foreground'
          )
        "
        @click="emit('addNodesFromGraph')"
      >
        <i class="icon-[lucide--mouse-pointer-click] size-3.5" />{{
          t('agent.placeholderAddNodes')
        }}</button
      >{{ t('agent.placeholderSuffix') }}
    </p>
  </div>
</template>
