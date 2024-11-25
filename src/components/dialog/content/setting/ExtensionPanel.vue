<template>
  <PanelTemplate value="Extension" class="extension-panel">
    <template #header>
      <SearchBox
        v-model="filters['global'].value"
        :placeholder="$t('searchExtensions') + '...'"
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
            :label="$t('reloadToApplyChanges')"
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

const applyChanges = () => {
  // Refresh the page to apply changes
  window.location.reload()
}
</script>
