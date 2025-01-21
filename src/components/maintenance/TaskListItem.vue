<template>
  <tr
    class="border-neutral-700 border-solid border-y"
    :class="{
      'opacity-50': state.resolved,
      'opacity-75': state.loading && !state.resolved
    }"
  >
    <td class="text-center w-16">
      <TaskListStatusIcon :state="state.state" :loading="state.loading" />
    </td>
    <td>
      <p class="inline-block">{{ task.name }}</p>
      <Button
        class="inline-block mx-2"
        type="button"
        :icon="PrimeIcons.INFO_CIRCLE"
        severity="secondary"
        :text="true"
        @click="toggle"
      />

      <Popover ref="infoPopover" class="block m-1 max-w-64 min-w-32">
        <span class="whitespace-pre-line">{{ task.description }}</span>
      </Popover>
    </td>
    <td class="text-right px-4">
      <Button
        :icon="task.button?.icon"
        :label="task.button?.text"
        :severity
        icon-pos="right"
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
import { VueSeverity } from '@/types/primeVueTypes'

import TaskListStatusIcon from './TaskListStatusIcon.vue'

const taskStore = useMaintenanceTaskStore()
const state = computed(() => taskStore.getState(props.task))

// Properties
const props = defineProps<{
  task: MaintenanceTask
}>()

// Events
defineEmits<{
  execute: [event: MouseEvent]
}>()

// Binding
const severity = computed<VueSeverity>(() =>
  state.value.state === 'error' || state.value.state === 'warning'
    ? 'primary'
    : 'secondary'
)

const infoPopover = ref()

const toggle = (event: Event) => {
  infoPopover.value.toggle(event)
}
</script>
