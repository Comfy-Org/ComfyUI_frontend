<template>
  <tr
    class="border-neutral-700 border-solid border-y"
    :class="{
      'opacity-50': task.resolved,
      'opacity-75': task.loading && !task.resolved
    }"
  >
    <td class="text-center w-16">
      <TaskListStatusIcon :state="task.state" :loading />
    </td>
    <td class="">
      <p>{{ task.name }}</p>
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
import Button from 'primevue/button'
import { computed } from 'vue'

import type { MaintenanceTask } from '@/types/maintenanceTypes'
import { VueSeverity } from '@/types/vueTypes'

import TaskListStatusIcon from './TaskListStatusIcon.vue'

// Properties
const props = defineProps<{
  task: MaintenanceTask
}>()

// Events
defineEmits<{
  execute: [event: PointerEvent]
}>()

// Binding
const severity = computed<VueSeverity>(() =>
  props.task.state === 'error' || props.task.state === 'warning'
    ? 'primary'
    : 'secondary'
)

const loading = computed(() => props.task.loading)
</script>
