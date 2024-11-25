<template>
  <PanelTemplate value="Extension" class="extension-panel">
    <DataTable :value="extensionStore.extensions" stripedRows size="small">
      <Column field="name" :header="$t('extensionName')" sortable></Column>
      <Column
        :pt="{
          bodyCell: 'flex items-center justify-end'
        }"
      >
        <template #body="slotProps">
          <ToggleSwitch
            v-model="editingEnabledExtensions[slotProps.data.name]"
            @change="updateExtensionStatus"
          />
        </template>
      </Column>
    </DataTable>
    <div class="mt-4">
      <Message v-if="hasChanges" severity="info">
        <ul>
          <li v-for="ext in changedExtensions" :key="ext.name">
            <span>
              {{ extensionStore.isExtensionEnabled(ext.name) ? '[-]' : '[+]' }}
            </span>
            {{ ext.name }}
          </li>
        </ul>
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
  </PanelTemplate>
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
import PanelTemplate from './PanelTemplate.vue'

const extensionStore = useExtensionStore()
const settingStore = useSettingStore()

const editingEnabledExtensions = ref<Record<string, boolean>>({})

onMounted(() => {
  extensionStore.extensions.forEach((ext) => {
    editingEnabledExtensions.value[ext.name] =
      extensionStore.isExtensionEnabled(ext.name)
  })
})

const changedExtensions = computed(() => {
  return extensionStore.extensions.filter(
    (ext) =>
      editingEnabledExtensions.value[ext.name] !==
      extensionStore.isExtensionEnabled(ext.name)
  )
})

const hasChanges = computed(() => {
  return changedExtensions.value.length > 0
})

const updateExtensionStatus = () => {
  const editingDisabledExtensionNames = Object.entries(
    editingEnabledExtensions.value
  )
    .filter(([_, enabled]) => !enabled)
    .map(([name]) => name)

  settingStore.set('Comfy.Extension.Disabled', [
    ...extensionStore.inactiveDisabledExtensionNames,
    ...editingDisabledExtensionNames
  ])
}

const applyChanges = () => {
  // Refresh the page to apply changes
  window.location.reload()
}
</script>
