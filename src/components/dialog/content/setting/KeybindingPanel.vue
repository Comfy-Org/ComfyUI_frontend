<template>
  <PanelTemplate value="Keybinding" class="keybinding-panel">
    <template #header>
      <SearchBox
        v-model="filters['global'].value"
        :placeholder="$t('g.searchKeybindings') + '...'"
      />
    </template>

    <DataTable
      v-model:selection="selectedCommandData"
      :value="commandsData"
      :global-filter-fields="['id', 'label']"
      :filters="filters"
      selection-mode="single"
      striped-rows
      :pt="{
        header: 'px-0'
      }"
      @row-dblclick="editKeybinding($event.data)"
    >
      <Column field="actions" header="">
        <template #body="slotProps">
          <div class="actions invisible flex flex-row">
            <Button
              icon="pi pi-pencil"
              class="p-button-text"
              @click="editKeybinding(slotProps.data)"
            />
            <Button
              icon="pi pi-replay"
              class="p-button-text p-button-warn"
              :disabled="
                !keybindingStore.isCommandKeybindingModified(slotProps.data.id)
              "
              @click="resetKeybinding(slotProps.data)"
            />
            <Button
              icon="pi pi-trash"
              class="p-button-text p-button-danger"
              :disabled="!slotProps.data.keybinding"
              @click="removeKeybinding(slotProps.data)"
            />
          </div>
        </template>
      </Column>
      <Column
        field="id"
        :header="$t('g.command')"
        sortable
        class="max-w-64 2xl:max-w-full"
      >
        <template #body="slotProps">
          <div
            class="overflow-hidden text-ellipsis whitespace-nowrap"
            :title="slotProps.data.id"
          >
            {{ slotProps.data.label }}
          </div>
        </template>
      </Column>
      <Column field="keybinding" :header="$t('g.keybinding')">
        <template #body="slotProps">
          <KeyComboDisplay
            v-if="slotProps.data.keybinding"
            :key-combo="slotProps.data.keybinding.combo"
            :is-modified="
              keybindingStore.isCommandKeybindingModified(slotProps.data.id)
            "
          />
          <span v-else>-</span>
        </template>
      </Column>
      <Column field="source" :header="$t('g.source')">
        <template #body="slotProps">
          <span class="overflow-hidden text-ellipsis">{{
            slotProps.data.source || '-'
          }}</span>
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="editDialogVisible"
      class="min-w-96"
      modal
      :header="currentEditingCommand?.label"
      @hide="cancelEdit"
    >
      <div>
        <InputText
          ref="keybindingInput"
          class="mb-2 text-center"
          :model-value="newBindingKeyCombo?.toString() ?? ''"
          placeholder="Press keys for new binding"
          autocomplete="off"
          fluid
          @keydown.stop.prevent="captureKeybinding"
        />
        <Message v-if="existingKeybindingOnCombo" severity="warn">
          Keybinding already exists on
          <Tag
            severity="secondary"
            :value="existingKeybindingOnCombo.commandId"
          />
        </Message>
      </div>
      <template #footer>
        <Button
          :label="existingKeybindingOnCombo ? 'Overwrite' : 'Save'"
          :icon="existingKeybindingOnCombo ? 'pi pi-pencil' : 'pi pi-check'"
          :severity="existingKeybindingOnCombo ? 'warn' : undefined"
          autofocus
          @click="saveKeybinding"
        />
      </template>
    </Dialog>
    <Button
      v-tooltip="$t('g.resetAllKeybindingsTooltip')"
      class="mt-4"
      :label="$t('g.resetAll')"
      icon="pi pi-replay"
      severity="danger"
      fluid
      text
      @click="resetAllKeybindings"
    />
  </PanelTemplate>
</template>

<script setup lang="ts">
import { FilterMatchMode } from '@primevue/core/api'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchBox from '@/components/common/SearchBox.vue'
import { useKeybindingService } from '@/services/keybindingService'
import { useCommandStore } from '@/stores/commandStore'
import {
  KeyComboImpl,
  KeybindingImpl,
  useKeybindingStore
} from '@/stores/keybindingStore'
import { normalizeI18nKey } from '@/utils/formatUtil'

import PanelTemplate from './PanelTemplate.vue'
import KeyComboDisplay from './keybinding/KeyComboDisplay.vue'

const filters = ref({
  global: { value: '', matchMode: FilterMatchMode.CONTAINS }
})

const keybindingStore = useKeybindingStore()
const keybindingService = useKeybindingService()
const commandStore = useCommandStore()
const { t } = useI18n()

interface ICommandData {
  id: string
  keybinding: KeybindingImpl | null
  label: string
  source?: string
}

const commandsData = computed<ICommandData[]>(() => {
  return Object.values(commandStore.commands).map((command) => ({
    id: command.id,
    label: t(
      `commands.${normalizeI18nKey(command.id)}.label`,
      command.label ?? ''
    ),
    keybinding: keybindingStore.getKeybindingByCommandId(command.id),
    source: command.source
  }))
})

const selectedCommandData = ref<ICommandData | null>(null)
const editDialogVisible = ref(false)
const newBindingKeyCombo = ref<KeyComboImpl | null>(null)
const currentEditingCommand = ref<ICommandData | null>(null)
const keybindingInput = ref<InstanceType<typeof InputText> | null>(null)

const existingKeybindingOnCombo = computed<KeybindingImpl | null>(() => {
  if (!currentEditingCommand.value) {
    return null
  }

  // If the new keybinding is the same as the current editing command, then don't show the error
  if (
    currentEditingCommand.value.keybinding?.combo?.equals(
      newBindingKeyCombo.value
    )
  ) {
    return null
  }

  if (!newBindingKeyCombo.value) {
    return null
  }

  return keybindingStore.getKeybinding(newBindingKeyCombo.value)
})

function editKeybinding(commandData: ICommandData) {
  currentEditingCommand.value = commandData
  newBindingKeyCombo.value = commandData.keybinding
    ? commandData.keybinding.combo
    : null
  editDialogVisible.value = true
}

watchEffect(() => {
  if (editDialogVisible.value) {
    // nextTick doesn't work here, so we use a timeout instead
    setTimeout(() => {
      // @ts-expect-error - $el is an internal property of the InputText component
      keybindingInput.value?.$el?.focus()
    }, 300)
  }
})

async function removeKeybinding(commandData: ICommandData) {
  if (commandData.keybinding) {
    keybindingStore.unsetKeybinding(commandData.keybinding)
    await keybindingService.persistUserKeybindings()
  }
}

async function captureKeybinding(event: KeyboardEvent) {
  // Allow the use of keyboard shortcuts when adding keyboard shortcuts
  if (!event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
    switch (event.key) {
      case 'Escape':
        cancelEdit()
        return
      case 'Enter':
        await saveKeybinding()
        return
    }
  }
  const keyCombo = KeyComboImpl.fromEvent(event)
  newBindingKeyCombo.value = keyCombo
}

function cancelEdit() {
  editDialogVisible.value = false
  currentEditingCommand.value = null
  newBindingKeyCombo.value = null
}

async function saveKeybinding() {
  if (currentEditingCommand.value && newBindingKeyCombo.value) {
    const updated = keybindingStore.updateKeybindingOnCommand(
      new KeybindingImpl({
        commandId: currentEditingCommand.value.id,
        combo: newBindingKeyCombo.value
      })
    )
    if (updated) {
      await keybindingService.persistUserKeybindings()
    }
  }
  cancelEdit()
}

async function resetKeybinding(commandData: ICommandData) {
  if (keybindingStore.resetKeybindingForCommand(commandData.id)) {
    await keybindingService.persistUserKeybindings()
  } else {
    console.warn(
      `No changes made when resetting keybinding for command: ${commandData.id}`
    )
  }
}

const toast = useToast()
async function resetAllKeybindings() {
  keybindingStore.resetAllKeybindings()
  await keybindingService.persistUserKeybindings()
  toast.add({
    severity: 'info',
    summary: 'Info',
    detail: 'All keybindings reset',
    life: 3000
  })
}
</script>

<style scoped>
:deep(.p-datatable-tbody) > tr > td {
  @apply p-1;
  min-height: 2rem;
}

:deep(.p-datatable-row-selected) .actions,
:deep(.p-datatable-selectable-row:hover) .actions {
  @apply visible;
}
</style>
