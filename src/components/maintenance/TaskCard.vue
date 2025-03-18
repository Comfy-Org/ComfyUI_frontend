<template>
  <div
    class="task-div max-w-48 min-h-52 grid relative"
    :class="{ 'opacity-75': isLoading }"
  >
    <Card
      class="max-w-48 relative h-full overflow-hidden"
      :class="{ 'opacity-65': runner.state !== 'error' }"
      v-bind="(({ onClick, ...rest }) => rest)($attrs)"
    >
      <template #header>
        <i
          v-if="runner.state === 'error'"
          class="pi pi-exclamation-triangle text-red-500 absolute m-2 top-0 -right-14 opacity-15"
          style="font-size: 10rem"
        />
        <img
          v-if="task.headerImg"
          :src="task.headerImg"
          class="object-contain w-full h-full opacity-25 pt-4 px-4"
        />
      </template>
      <template #title>{{ task.name }}</template>
      <template #content>{{ description }}</template>
      <template #footer>
        <div class="flex gap-4 mt-1">
          <Button
            :icon="task.button?.icon"
            :label="task.button?.text"
            class="w-full"
            raised
            icon-pos="right"
            @click="(event) => $emit('execute', event)"
            :loading="isExecuting"
          />
        </div>
      </template>
    </Card>

    <i
      v-if="!isLoading && runner.state === 'OK'"
      class="task-card-ok pi pi-check"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Card from 'primevue/card'
import { computed } from 'vue'

import { useMaintenanceTaskStore } from '@/stores/maintenanceTaskStore'
import type { MaintenanceTask } from '@/types/desktop/maintenanceTypes'
import { useMinLoadingDurationRef } from '@/utils/refUtil'

const taskStore = useMaintenanceTaskStore()
const runner = computed(() => taskStore.getRunner(props.task))

// Properties
const props = defineProps<{
  task: MaintenanceTask
}>()

// Events
defineEmits<{
  execute: [event: MouseEvent]
}>()

// Bindings
const description = computed(() =>
  runner.value.state === 'error'
    ? props.task.errorDescription ?? props.task.shortDescription
    : props.task.shortDescription
)

// Use a minimum run time to ensure tasks "feel" like they have run
const reactiveLoading = computed(() => !!runner.value.refreshing)
const reactiveExecuting = computed(() => !!runner.value.executing)

const isLoading = useMinLoadingDurationRef(reactiveLoading, 250)
const isExecuting = useMinLoadingDurationRef(reactiveExecuting, 250)
</script>

<style scoped>
.task-card-ok {
  @apply text-green-500 absolute -right-4 -bottom-4 opacity-100 row-span-full col-span-full transition-opacity;

  font-size: 4rem;
  text-shadow: 0.25rem 0 0.5rem black;
  z-index: 10;
}

.p-card {
  @apply transition-opacity;

  --p-card-background: var(--p-button-secondary-background);
  opacity: 0.9;

  &.opacity-65 {
    opacity: 0.4;
  }

  &:hover {
    opacity: 1;
  }
}

:deep(.p-card-header) {
  z-index: 0;
}

:deep(.p-card-body) {
  z-index: 1;
  flex-grow: 1;
  justify-content: space-between;
}

.task-div {
  > i {
    pointer-events: none;
  }

  &:hover > i {
    opacity: 0.2;
  }
}
</style>
