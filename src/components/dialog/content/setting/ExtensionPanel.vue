<template>
  <PanelTemplate value="Extension" class="extension-panel">
    <template #header>
      <SearchBox
        v-model="filters['global'].value"
        :placeholder="$t('g.searchExtensions') + '...'"
      />
      <Message v-if="hasChanges" severity="info" pt:text="w-full">
        <ul>
          <li v-for="ext in changedExtensions" :key="ext.name">
            <span>
              {{ extensionStore.isExtensionEnabled(ext.name) ? '[-]' : '[+]' }}
            </span>
            {{ ext.name }}
          </li>
        </ul>
        <div class="flex justify-end">
          <Button
            :label="$t('g.reloadToApplyChanges')"
            @click="applyChanges"
            outlined
            severity="danger"
          />
        </div>
      </Message>
    </template>
    <DataTable
      :value="extensionStore.extensions"
      stripedRows
      size="small"
      :filters="filters"
    >
      <Column field="name" :header="$t('g.extensionName')" sortable></Column>
      <Column
        :pt="{
          headerCell: 'flex items-center justify-end',
          bodyCell: 'flex items-center justify-end'
        }"
      >
        <template #header>
          <Button
            icon="pi pi-ellipsis-h"
            text
            severity="secondary"
            @click="menu.show($event)"
          />
          <ContextMenu ref="menu" :model="contextMenuItems" />
        </template>
        <template #body="slotProps">
          <ToggleSwitch
            :disabled="
              extensionStore.isExtensionAlwaysEnabled(slotProps.data.name)
            "
            v-model="editingEnabledExtensions[slotProps.data.name]"
            @change="updateExtensionStatus"
          />
        </template>
      </Column>
    </DataTable>
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
import ContextMenu from 'primevue/contextmenu'
import Message from 'primevue/message'
import { FilterMatchMode } from '@primevue/core/api'
import PanelTemplate from './PanelTemplate.vue'
import SearchBox from '@/components/common/SearchBox.vue'

const filters = ref({
  global: { value: '', matchMode: FilterMatchMode.CONTAINS }
})

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

const enableAllExtensions = () => {
  extensionStore.extensions.forEach((ext) => {
    editingEnabledExtensions.value[ext.name] = true
  })
  updateExtensionStatus()
}

const disableAllExtensions = () => {
  extensionStore.extensions.forEach((ext) => {
    if (extensionStore.isExtensionAlwaysEnabled(ext.name)) return

    editingEnabledExtensions.value[ext.name] = false
  })
  updateExtensionStatus()
}

const applyChanges = () => {
  // Refresh the page to apply changes
  window.location.reload()
}

const menu = ref<InstanceType<typeof ContextMenu>>()
const contextMenuItems = [
  {
    label: 'Enable All',
    icon: 'pi pi-check',
    command: enableAllExtensions
  },
  {
    label: 'Disable All',
    icon: 'pi pi-times',
    command: disableAllExtensions
  }
]
</script>
