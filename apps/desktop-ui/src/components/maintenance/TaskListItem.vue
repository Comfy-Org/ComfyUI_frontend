<template>
  <tr
    class="border-y border-solid border-neutral-700"
    :class="{
      'opacity-50': runner.resolved,
      'opacity-75': isLoading && runner.resolved
    }"
  >
    <td class="w-16 text-center">
      <TaskListStatusIcon
        :state="runner.state"
        :loading="isLoading"
      />
    </td>
    <td>
      <p class="inline-block">
        {{ task.name }}
      </p>
      <Button
        class="mx-2 inline-block"
        type="button"
        :icon="PrimeIcons.INFO_CIRCLE"
        severity="secondary"
        :text="true"
        @click="toggle"
      />

      <Popover
        ref="infoPopover"
        class="m-1 block max-w-64 min-w-32"
      >
        <span class="whitespace-pre-line">{{ task.description }}</span>
      </Popover>
    </td>
    <td class="px-4 text-right">
      <Button
        :icon="task.button?.icon"
        :label="task.button?.text"
        :severity
        icon-pos="right"
        :loading="isExecuting"
        @click="(event) => $emit('execute', event)"
      />
    </td>
  </tr>
</template>

<script setup lang="ts">
import { PrimeIcons } from '@primevue/core/api'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'

import { useMaintenanceTaskStore } from '@/stores/maintenanceTaskStore'
import type { MaintenanceTask } from '@/types/desktop/maintenanceTypes'
import type { PrimeVueSeverity } from '@/types/primeVueTypes'
import { useMinLoadingDurationRef } from '@/utils/refUtil'

import TaskListStatusIcon from './TaskListStatusIcon.vue'

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

// Binding
const severity = computed<PrimeVueSeverity>(() =>
  runner.value.state === 'error' || runner.value.state === 'warning'
    ? 'primary'
    : 'secondary'
)

// Use a minimum run time to ensure tasks "feel" like they have run
const reactiveLoading = computed(() => !!runner.value.refreshing)
const reactiveExecuting = computed(() => !!runner.value.executing)

const isLoading = useMinLoadingDurationRef(reactiveLoading, 250)
const isExecuting = useMinLoadingDurationRef(reactiveExecuting, 250)

// Popover
const infoPopover = ref<InstanceType<typeof Popover> | null>(null)

const toggle = (event: Event) => {
  infoPopover.value?.toggle(event)
}
</script>
