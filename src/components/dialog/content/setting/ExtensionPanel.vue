<template>
  <div class="extension-panel">
    <DataTable
      :value="extensions"
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
            v-model="enabledExtensions[slotProps.data.name]"
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
        :label="$t('applyChanges')"
        icon="pi pi-refresh"
        @click="applyChanges"
        :disabled="!hasChanges"
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

const extensions = computed(() => extensionStore.extensions)
const enabledExtensions = ref<Record<string, boolean>>({})
const originalEnabledExtensions = ref<Record<string, boolean>>({})

onMounted(() => {
  const disabledExtensions = new Set(
    settingStore.get('Comfy.Extension.Disabled')
  )
  extensions.value.forEach((ext) => {
    enabledExtensions.value[ext.name] = !disabledExtensions.has(ext.name)
    originalEnabledExtensions.value[ext.name] = !disabledExtensions.has(
      ext.name
    )
  })
})

const hasChanges = computed(() => {
  return Object.keys(enabledExtensions.value).some(
    (name) =>
      enabledExtensions.value[name] !== originalEnabledExtensions.value[name]
  )
})

const updateExtensionStatus = (name: string) => {
  // This function is called when a ToggleButton is changed
  // No need to do anything here as the v-model will update enabledExtensions
}

const applyChanges = () => {
  const disabledExtensions = Object.keys(enabledExtensions.value).filter(
    (name) => !enabledExtensions.value[name]
  )

  settingStore.set('Comfy.Extension.Disabled', disabledExtensions)

  // Refresh the page to apply changes
  window.location.reload()
}
</script>
