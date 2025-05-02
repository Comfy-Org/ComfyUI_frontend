<template>
  <div class="template-workflow-view h-full flex flex-col">
    <div class="view-toggle-controls mb-4 flex justify-end">
      <div class="flex p-buttonset">
        <Button
          icon="pi pi-th-large"
          :class="{
            'p-button-secondary': viewMode === 'card',
            'p-button-outlined': viewMode !== 'card'
          }"
          tooltip="Card View"
          tooltip-options="{ position: 'bottom' }"
          data-testid="card-view-button"
          @click="viewMode = 'card'"
        />
        <Button
          icon="pi pi-list"
          :class="{
            'p-button-secondary': viewMode === 'list',
            'p-button-outlined': viewMode !== 'list'
          }"
          tooltip="List View"
          tooltip-options="{ position: 'bottom' }"
          data-testid="list-view-button"
          @click="viewMode = 'list'"
        />
      </div>
    </div>

    <div
      v-if="viewMode === 'card'"
      class="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] auto-rows-fr gap-8 justify-items-center flex-1 overflow-auto"
    >
      <div v-for="template in templates" :key="template.name" class="h-full">
        <TemplateWorkflowCard
          :source-module="sourceModule"
          :template="template"
          :loading="loading === template.name"
          :category-title="categoryTitle"
          @load-workflow="onLoadWorkflow"
        />
      </div>
    </div>

    <div v-if="viewMode === 'list'" class="w-full flex-1 overflow-auto">
      <TemplateWorkflowList
        :source-module="sourceModule"
        :templates="templates"
        :loading="loading"
        :category-title="categoryTitle"
        @load-workflow="onLoadWorkflow"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import Button from 'primevue/button'
import { watch } from 'vue'

import TemplateWorkflowCard from '@/components/templates/TemplateWorkflowCard.vue'
import TemplateWorkflowList from '@/components/templates/TemplateWorkflowList.vue'
import { TemplateInfo } from '@/types/workflowTemplateTypes'

defineProps<{
  sourceModule: string
  categoryTitle: string
  loading: string | null
  templates: TemplateInfo[]
}>()

const viewMode = useLocalStorage<'card' | 'list'>(
  'Comfy.TemplateWorkflow.ViewMode',
  'card'
)

const emit = defineEmits<{
  loadWorkflow: [name: string]
  viewModeChange: [mode: 'card' | 'list']
}>()

const onLoadWorkflow = (name: string) => {
  emit('loadWorkflow', name)
}

watch(
  viewMode,
  (newMode) => {
    emit('viewModeChange', newMode)
  },
  { immediate: true }
)
</script>
