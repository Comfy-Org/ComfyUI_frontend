<template>
  <div class="no-results-placeholder">
    <Card>
      <template #content>
        <div class="flex flex-column align-items-center">
          <i :class="icon" style="font-size: 3rem; margin-bottom: 1rem"></i>
          <h3>{{ title }}</h3>
          <p>{{ message }}</p>
          <Button
            v-if="buttonLabel"
            :label="buttonLabel"
            @click="$emit('action')"
            class="p-button-text"
          />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'

defineProps<{
  icon?: string
  title: string
  message: string
  buttonLabel?: string
}>()

defineEmits(['action'])
</script>

<style scoped>
.no-results-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 2rem;
}

.no-results-placeholder :deep(.p-card) {
  background-color: var(--surface-ground);
  text-align: center;
}

.no-results-placeholder h3 {
  color: var(--text-color);
  margin-bottom: 0.5rem;
}

.no-results-placeholder p {
  color: var(--text-color-secondary);
  margin-bottom: 1rem;
}
</style>
