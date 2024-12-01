<template>
  <div
    class="flex flex-wrap content-around justify-around gap-4 p-4"
    data-testid="troubleshooting-content"
  >
    <Card v-for="task in tasks" :key="task.id">
      <template #content>
        <section class="relative w-48 h-48 overflow-hidden rounded-lg">
          <component :is="task.component" />
        </section>
      </template>
      <template #footer>
        <span>{{ $t(`troubleshooting.tasks.${task.id}`) }}</span>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import Card from 'primevue/card'
import RestoreCustomNodes from './RestoreCustomNodes.vue'
import { isElectron } from '@/utils/envUtil'

const electronTasks = [
  {
    id: 'restoreCustomNodes',
    component: RestoreCustomNodes
  }
]

const tasks = isElectron() ? [...electronTasks] : []
</script>

<style lang="css" scoped>
.p-card {
  --p-card-body-padding: 0;
}

:deep(.p-card-footer) {
  text-align: center;
}
</style>
