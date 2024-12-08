<template>
  <div class="context-select">
    <button
      v-for="context in props.contexts"
      :key="context.id"
      :class="{ selected: selectedContext === context.id }"
      @click="selectContext(context.id)"
      class="context-button"
    >
      {{ context.name }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { KeyBindingContextImpl } from '@/stores/keybindingStore'
interface Props {
  contexts: KeyBindingContextImpl[]
}

const props = withDefaults(defineProps<Props>(), {
  contexts: () => []
})

const emit = defineEmits<{
  (e: 'context-changed', contextId: string): void
}>()

const selectedContext = ref(
  props.contexts.find((c) => c.id === 'global')?.id || 'global'
)

const selectContext = (contextId: string) => {
  selectedContext.value = contextId
  emit('context-changed', contextId)
}
</script>

<style scoped>
.context-select {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}

.context-button {
  padding: 6px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: none;
  cursor: pointer;
}

.context-button.selected {
  background: var(--p-highlight-focus-background);
}
</style>
