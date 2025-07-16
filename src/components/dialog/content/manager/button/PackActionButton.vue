<template>
  <Button
    outlined
    class="!m-0 p-0 rounded-lg text-gray-900 dark-theme:text-gray-50"
    :class="[
      variant === 'black'
        ? 'bg-neutral-900 text-white border-neutral-900'
        : 'border-neutral-700',
      fullWidth ? 'w-full' : 'w-min-content'
    ]"
    :disabled="loading"
    v-bind="$attrs"
    @click="onClick"
  >
    <span class="py-2 px-3 whitespace-nowrap text-xs flex items-center gap-2">
      <i
        v-if="hasWarning && !loading"
        class="pi pi-exclamation-triangle text-yellow-500"
      ></i>
      <template v-if="loading">
        {{ loadingMessage ?? $t('g.loading') }}
      </template>
      <template v-else>
        {{ label }}
      </template>
    </span>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

const {
  label,
  loading = false,
  loadingMessage,
  fullWidth = false,
  variant = 'default',
  hasWarning = false
} = defineProps<{
  label: string
  loading?: boolean
  loadingMessage?: string
  fullWidth?: boolean
  variant?: 'default' | 'black'
  hasWarning?: boolean
}>()

const emit = defineEmits<{
  action: []
}>()

defineOptions({
  inheritAttrs: false
})

const onClick = (): void => {
  emit('action')
}
</script>
