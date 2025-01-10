<template>
  <!-- Tasks -->
  <section class="my-4">
    <template v-if="filter.tasks.length === 0">
      <!-- Empty filter -->
      <Divider />
      <p class="text-neutral-400 w-full text-center">
        {{ $t('maintenance.allOk') }}
      </p>
    </template>

    <template v-else>
      <!-- Display: List -->
      <table
        v-if="displayAsList === PrimeIcons.LIST"
        class="w-full border-collapse border-hidden"
      >
        <TaskListItem
          v-for="task in filter.tasks"
          :key="task.id"
          :task
          @execute="(event) => confirmButton(event, task)"
        />
      </table>

      <!-- Display: Cards -->
      <template v-else>
        <div class="flex flex-wrap justify-evenly gap-8 pad-y my-4">
          <TaskCard
            v-for="task in filter.tasks"
            :key="task.id"
            :task
            @execute="(event) => confirmButton(event, task)"
          />
        </div>
      </template>
    </template>
    <ConfirmPopup />
  </section>
</template>

<script setup lang="ts">
import type {
  MaintenanceFilter,
  MaintenanceTask
} from '@/types/maintenanceTypes'
import Divider from 'primevue/divider'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { PrimeIcons } from '@primevue/core/api'
import { t } from '@/i18n'
import TaskCard from './TaskCard.vue'
import TaskListItem from './TaskListItem.vue'
import ConfirmPopup from 'primevue/confirmpopup'

const confirm = useConfirm()
const toast = useToast()

// Properties
const props = defineProps<{
  displayAsList: string
  filter: MaintenanceFilter
  isRefreshing: boolean
}>()

// Commands
const confirmButton = async (event: PointerEvent, task: MaintenanceTask) => {
  if (!task.requireConfirm) {
    await task.onClick()
    return
  }

  confirm.require({
    target: event.currentTarget as HTMLElement,
    message: task.confirmText ?? t('maintenance.confirmTitle'),
    icon: 'pi pi-exclamation-circle',
    rejectProps: {
      label: t('g.cancel'),
      severity: 'secondary',
      outlined: true
    },
    acceptProps: {
      label: task.button?.text ?? t('g.save'),
      severity: task.severity ?? 'primary'
    },
    // TODO: Not awaited.
    accept: async () => {
      toast.add({
        severity: 'info',
        summary: 'Running task',
        life: 3000
      })
      await task.onClick()
    }
  })
}
</script>
