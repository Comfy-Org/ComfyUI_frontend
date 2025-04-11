<template>
  <Button
    outlined
    class="m-0 p-0 rounded-lg border-neutral-700"
    :class="{
      'w-full': fullWidth,
      'w-min-content': !fullWidth
    }"
    :disabled="loading"
    v-bind="$attrs"
    @click="onClick"
  >
    <span class="py-2.5 px-3">
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
  loadingMessage,
  fullWidth = false
} = defineProps<{
  label: string
  loading?: boolean
  loadingMessage?: string
  fullWidth?: boolean
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
