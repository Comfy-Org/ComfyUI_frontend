<template>
  <div class="no-results-placeholder p-8 h-full" :class="props.class">
    <Card>
      <template #content>
        <div class="flex flex-col items-center">
          <i :class="icon" style="font-size: 3rem; margin-bottom: 1rem" />
          <h3>{{ title }}</h3>
          <p :class="textClass" class="whitespace-pre-line text-center">
            {{ message }}
          </p>
          <Button
            v-if="buttonLabel"
            :label="buttonLabel"
            class="p-button-text"
            @click="$emit('action')"
          />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Card from 'primevue/card'

const props = defineProps<{
  class?: string
  icon?: string
  title: string
  message: string
  textClass?: string
  buttonLabel?: string
}>()

defineEmits(['action'])
</script>

<style scoped>
.no-results-placeholder :deep(.p-card) {
  background-color: var(--surface-ground);
  text-align: center;
  box-shadow: unset;
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
