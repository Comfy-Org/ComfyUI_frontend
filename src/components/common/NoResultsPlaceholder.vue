<template>
  <div class="no-results-placeholder h-full p-8" :class="props.class">
    <Card>
      <template #content>
        <div class="flex flex-col items-center">
          <i
            v-if="icon"
            :class="icon"
            style="font-size: 3rem; margin-bottom: 1rem"
          />
          <h3 v-if="title">{{ title }}</h3>
          <p :class="textClass" class="text-center whitespace-pre-line">
            {{ message }}
          </p>
          <Button
            v-if="buttonLabel"
            :variant="buttonVariant ?? 'textonly'"
            @click="$emit('action')"
          >
            <i v-if="buttonIcon" :class="buttonIcon" />
            {{ buttonLabel }}
          </Button>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import Card from 'primevue/card'

import Button from '@/components/ui/button/Button.vue'
import type { ButtonVariants } from '../ui/button/button.variants'

const props = defineProps<{
  class?: string
  icon?: string
  title?: string
  message: string
  textClass?: string
  buttonIcon?: string
  buttonLabel?: string
  buttonVariant?: ButtonVariants['variant']
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
  margin-bottom: 1rem;
}
</style>
