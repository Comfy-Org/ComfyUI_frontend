<template>
  <DataView
    :value="templates"
    :layout="layout"
    data-key="name"
    :lazy="true"
    pt:root="h-full grid grid-rows-[auto_1fr]"
    pt:content="p-2 overflow-auto"
  >
    <template #header>
      <div class="flex justify-between items-center">
        <h2 class="text-lg">{{ title }}</h2>
        <SelectButton
          v-model="layout"
          :options="['grid', 'list']"
          :allow-empty="false"
        >
          <template #option="{ option }">
            <i :class="[option === 'list' ? 'pi pi-bars' : 'pi pi-table']" />
          </template>
        </SelectButton>
      </div>
    </template>

    <template #list="{ items }">
      <TemplateWorkflowList
        :source-module="sourceModule"
        :templates="items"
        :loading="loading"
        :category-title="categoryTitle"
        @load-workflow="onLoadWorkflow"
      />
    </template>

    <template #grid="{ items }">
      <div
        class="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-x-4 gap-y-8 px-4 justify-items-center"
      >
        <TemplateWorkflowCard
          v-for="template in items"
          :key="template.name"
          :source-module="sourceModule"
          :template="template"
          :loading="loading === template.name"
          :category-title="categoryTitle"
          @load-workflow="onLoadWorkflow"
        />
      </div>
    </template>
  </DataView>
</template>

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import DataView from 'primevue/dataview'
import SelectButton from 'primevue/selectbutton'

import TemplateWorkflowCard from '@/components/templates/TemplateWorkflowCard.vue'
import TemplateWorkflowList from '@/components/templates/TemplateWorkflowList.vue'
import type { TemplateInfo } from '@/types/workflowTemplateTypes'

defineProps<{
  title: string
  sourceModule: string
  categoryTitle: string
  loading: string | null
  templates: TemplateInfo[]
}>()

const layout = useLocalStorage<'grid' | 'list'>(
  'Comfy.TemplateWorkflow.Layout',
  'grid'
)

const emit = defineEmits<{
  loadWorkflow: [name: string]
}>()

const onLoadWorkflow = (name: string) => {
  emit('loadWorkflow', name)
}
</script>
