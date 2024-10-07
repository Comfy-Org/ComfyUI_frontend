<template>
  <div class="extension-panel">
    <DataTable
      :value="extensionStore.extensions"
      stripedRows
      size="small"
      scrollable
      scrollHeight="800px"
    >
      <Column field="name" :header="$t('extensionName')" sortable></Column>
      <Column
        :pt="{
          bodyCell: 'flex items-center justify-end'
        }"
      >
        <template #body="slotProps">
          <ToggleSwitch
            v-model="editingEnabledExtensions[slotProps.data.name]"
            @change="updateExtensionStatus(slotProps.data.name)"
          />
        </template>
      </Column>
    </DataTable>
    <div class="mt-4">
      <Message v-if="hasChanges" severity="info">
        {{ $t('extensionChangesDetected') }}
      </Message>
      <Button
        :label="$t('reloadToApplyChanges')"
        icon="pi pi-refresh"
        @click="applyChanges"
        :disabled="!hasChanges"
        text
        fluid
        severity="danger"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useExtensionStore } from '@/stores/extensionStore'
import { useSettingStore } from '@/stores/settingStore'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Message from 'primevue/message'

const extensionStore = useExtensionStore()
const settingStore = useSettingStore()

const editingEnabledExtensions = ref<Record<string, boolean>>({})

onMounted(() => {
  extensionStore.extensions.forEach((ext) => {
    editingEnabledExtensions.value[ext.name] =
      extensionStore.isExtensionEnabled(ext.name)
  })
})

const hasChanges = computed(() => {
  return extensionStore.enabledExtensions.some(
    (ext) =>
      editingEnabledExtensions.value[ext.name] !==
      extensionStore.isExtensionEnabled(ext.name)
  )
})

const updateExtensionStatus = (name: string) => {
  settingStore.set(
    'Comfy.Extension.Disabled',
    Object.entries(editingEnabledExtensions.value)
      .filter(([_, enabled]) => !enabled)
      .map(([name]) => name)
  )
}

const applyChanges = () => {
  // Refresh the page to apply changes
  window.location.reload()
}
</script>
