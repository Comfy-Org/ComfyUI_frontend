<template>
  <div class="keybinding-panel flex flex-col gap-2">
    <Teleport defer to="#keybinding-panel-header">
      <SearchBox
        v-model="filters['global'].value"
        class="max-w-96"
        size="lg"
        :placeholder="
          $t('g.searchPlaceholder', { subject: $t('g.keybindings') })
        "
      />
    </Teleport>

    <Teleport defer to="#keybinding-panel-actions">
      <DropdownMenu
        :entries="menuEntries"
        icon="icon-[lucide--ellipsis]"
        item-class="text-sm gap-2"
        button-size="unset"
        button-class="size-10"
      />
    </Teleport>

    <KeybindingPresetToolbar
      :preset-names="presetNames"
      @presets-changed="refreshPresetList"
    />

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
      <Column field="actions" header="" :pt="{ bodyCell: 'p-1 min-h-8' }">
        <template #body="slotProps">
          <div class="actions flex flex-row">
            <Button
              variant="textonly"
              size="icon"
              :aria-label="$t('g.edit')"
              @click="editKeybinding(slotProps.data)"
            >
              <i class="pi pi-pencil" />
            </Button>
            <Button
              variant="textonly"
              size="icon"
              :aria-label="$t('g.reset')"
              :disabled="
                !keybindingStore.isCommandKeybindingModified(slotProps.data.id)
              "
              @click="resetKeybinding(slotProps.data)"
            >
              <i class="pi pi-replay" />
            </Button>
            <Button
              variant="textonly"
              size="icon"
              :aria-label="$t('g.delete')"
              :disabled="!slotProps.data.keybinding"
              @click="removeKeybinding(slotProps.data)"
            >
              <i class="pi pi-trash" />
            </Button>
          </div>
        </template>
      </Column>
      <Column
        field="id"
        :header="$t('g.command')"
        sortable
        class="max-w-64 2xl:max-w-full"
        :pt="{ bodyCell: 'p-1 min-h-8' }"
      >
        <template #body="slotProps">
          <div class="truncate" :title="slotProps.data.id">
            {{ slotProps.data.label }}
          </div>
        </template>
      </Column>
      <Column
        field="keybinding"
        :header="$t('g.keybinding')"
        :pt="{ bodyCell: 'p-1 min-h-8' }"
      >
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
      <Column
        field="source"
        :header="$t('g.source')"
        :pt="{ bodyCell: 'p-1 min-h-8' }"
      >
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
          :placeholder="$t('g.pressKeysForNewBinding')"
          autocomplete="off"
          fluid
          @keydown.stop.prevent="captureKeybinding"
        />
        <Message v-if="existingKeybindingOnCombo" severity="warn">
          {{ $t('g.keybindingAlreadyExists') }}
          <Tag
            severity="secondary"
            :value="existingKeybindingOnCombo.commandId"
          />
        </Message>
      </div>
      <template #footer>
        <Button
          :variant="existingKeybindingOnCombo ? 'destructive' : 'primary'"
          autofocus
          @click="saveKeybinding"
        >
          <i
            :class="existingKeybindingOnCombo ? 'pi pi-pencil' : 'pi pi-check'"
          />
          {{ existingKeybindingOnCombo ? $t('g.overwrite') : $t('g.save') }}
        </Button>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import { FilterMatchMode } from '@primevue/core/api'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { computed, onMounted, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import DropdownMenu from '@/components/common/DropdownMenu.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import Button from '@/components/ui/button/Button.vue'
import { KeyComboImpl } from '@/platform/keybindings/keyCombo'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useKeybindingPresetService } from '@/platform/keybindings/presetService'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogService } from '@/services/dialogService'
import { normalizeI18nKey } from '@/utils/formatUtil'

import KeybindingPresetToolbar from './keybinding/KeybindingPresetToolbar.vue'
import KeyComboDisplay from './keybinding/KeyComboDisplay.vue'

const filters = ref({
  global: { value: '', matchMode: FilterMatchMode.CONTAINS }
})

const keybindingStore = useKeybindingStore()
const keybindingService = useKeybindingService()
const presetService = useKeybindingPresetService()
const settingStore = useSettingStore()
const commandStore = useCommandStore()
const dialogService = useDialogService()
const { t } = useI18n()

const presetNames = ref<string[]>([])

async function refreshPresetList() {
  presetNames.value = (await presetService.listPresets()) ?? []
}

async function initPresets() {
  await refreshPresetList()
  const currentName = settingStore.get('Comfy.Keybinding.CurrentPreset')
  if (currentName !== 'default') {
    const preset = await presetService.loadPreset(currentName)
    if (preset) {
      keybindingStore.savedPresetData = preset
      keybindingStore.currentPresetName = currentName
    } else {
      keybindingStore.currentPresetName = 'default'
      keybindingStore.savedPresetData = null
      await settingStore.set('Comfy.Keybinding.CurrentPreset', 'default')
    }
  }
}

onMounted(() => initPresets())

// "..." menu entries (teleported to header)
async function saveAsNewPreset() {
  const name = await dialogService.prompt({
    title: t('g.keybindingPresets.saveAsNewPreset'),
    message: t('g.keybindingPresets.presetNamePrompt'),
    defaultValue: ''
  })
  if (!name) return
  const trimmedName = name.trim()
  if (!trimmedName) return
  if (presetNames.value.includes(trimmedName)) {
    const overwrite = await dialogService.confirm({
      title: t('g.keybindingPresets.overwritePresetTitle'),
      message: t('g.keybindingPresets.overwritePresetMessage', {
        name: trimmedName
      }),
      type: 'overwrite'
    })
    if (!overwrite) return
  }
  await presetService.savePreset(trimmedName)
  refreshPresetList()
}

async function handleDeletePreset() {
  await presetService.deletePreset(keybindingStore.currentPresetName)
  refreshPresetList()
}

async function handleImportPreset() {
  await presetService.importPreset()
  refreshPresetList()
}

const showSaveAsNew = computed(
  () =>
    keybindingStore.currentPresetName !== 'default' ||
    keybindingStore.isCurrentPresetModified
)

const menuEntries = computed<MenuItem[]>(() => [
  ...(showSaveAsNew.value
    ? [
        {
          label: t('g.keybindingPresets.saveAsNewPreset'),
          icon: 'icon-[lucide--save]',
          command: saveAsNewPreset
        }
      ]
    : []),
  {
    label: t('g.keybindingPresets.resetToDefault'),
    icon: 'icon-[lucide--rotate-cw]',
    command: () =>
      presetService.switchPreset('default').then(() => refreshPresetList())
  },
  {
    label: t('g.keybindingPresets.deletePreset'),
    icon: 'icon-[lucide--trash-2]',
    disabled: keybindingStore.currentPresetName === 'default',
    command: handleDeletePreset
  },
  {
    label: t('g.keybindingPresets.importPreset'),
    icon: 'icon-[lucide--file-input]',
    command: handleImportPreset
  },
  {
    label: t('g.keybindingPresets.exportPreset'),
    icon: 'icon-[lucide--file-output]',
    command: () => presetService.exportPreset()
  }
])

// Keybinding table logic
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
  const commandId = currentEditingCommand.value?.id
  const combo = newBindingKeyCombo.value
  cancelEdit()
  if (!combo || commandId == undefined) return

  const updated = keybindingStore.updateKeybindingOnCommand(
    new KeybindingImpl({ commandId, combo })
  )
  if (updated) await keybindingService.persistUserKeybindings()
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
</script>
