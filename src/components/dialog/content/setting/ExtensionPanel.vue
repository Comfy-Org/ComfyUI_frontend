<template>
  <PanelTemplate value="Extension" class="extension-panel">
    <template #header>
      <SearchBox
        v-model="filters['global'].value"
        :placeholder="$t('g.searchExtensions') + '...'"
      />
      <Message
        v-if="hasChanges"
        severity="info"
        pt:text="w-full"
        class="max-h-96 overflow-y-auto"
      >
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
            outlined
            severity="danger"
            @click="applyChanges"
          />
        </div>
      </Message>
    </template>
    <DataTable
      :value="extensionStore.extensions"
      striped-rows
      size="small"
      :filters="filters"
    >
      <Column :header="$t('g.extensionName')" sortable field="name">
        <template #body="slotProps">
          {{ slotProps.data.name }}
          <Tag
            v-if="extensionStore.isCoreExtension(slotProps.data.name)"
            value="Core"
          />
        </template>
      </Column>
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
            @click="menu?.show($event)"
          />
          <ContextMenu ref="menu" :model="contextMenuItems" />
        </template>
        <template #body="slotProps">
          <ToggleSwitch
            v-model="editingEnabledExtensions[slotProps.data.name]"
            :disabled="extensionStore.isExtensionReadOnly(slotProps.data.name)"
            @change="updateExtensionStatus"
          />
        </template>
      </Column>
    </DataTable>
  </PanelTemplate>
</template>

<script setup lang="ts">
import { FilterMatchMode } from '@primevue/core/api'
import Button from 'primevue/button'
import Column from 'primevue/column'
import ContextMenu from 'primevue/contextmenu'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, onMounted, ref } from 'vue'

import SearchBox from '@/components/common/SearchBox.vue'
import { useExtensionStore } from '@/stores/extensionStore'
import { useSettingStore } from '@/stores/settingStore'

import PanelTemplate from './PanelTemplate.vue'

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

const updateExtensionStatus = async () => {
  const editingDisabledExtensionNames = Object.entries(
    editingEnabledExtensions.value
  )
    .filter(([_, enabled]) => !enabled)
    .map(([name]) => name)

  await settingStore.set('Comfy.Extension.Disabled', [
    ...extensionStore.inactiveDisabledExtensionNames,
    ...editingDisabledExtensionNames
  ])
}

const enableAllExtensions = async () => {
  extensionStore.extensions.forEach((ext) => {
    if (extensionStore.isExtensionReadOnly(ext.name)) return

    editingEnabledExtensions.value[ext.name] = true
  })
  await updateExtensionStatus()
}

const disableAllExtensions = async () => {
  extensionStore.extensions.forEach((ext) => {
    if (extensionStore.isExtensionReadOnly(ext.name)) return

    editingEnabledExtensions.value[ext.name] = false
  })
  await updateExtensionStatus()
}

const disableThirdPartyExtensions = async () => {
  extensionStore.extensions.forEach((ext) => {
    if (extensionStore.isCoreExtension(ext.name)) return

    editingEnabledExtensions.value[ext.name] = false
  })
  await updateExtensionStatus()
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
  },
  {
    label: 'Disable 3rd Party',
    icon: 'pi pi-times',
    command: disableThirdPartyExtensions,
    disabled: !extensionStore.hasThirdPartyExtensions
  }
]
</script>
