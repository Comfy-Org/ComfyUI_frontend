<template>
  <div class="keybinding-panel flex min-w-0 flex-col gap-2 overflow-x-hidden">
    <Teleport defer to="#keybinding-panel-header">
      <SearchInput
        v-model="searchQuery"
        class="max-w-96"
        size="lg"
        autofocus
        :placeholder="
          $t('g.searchPlaceholder', { subject: $t('g.keybindings') })
        "
      />
    </Teleport>

    <Teleport defer to="#keybinding-panel-actions">
      <div class="flex items-center gap-2">
        <KeybindingPresetToolbar
          :preset-names="presetNames"
          @presets-changed="refreshPresetList"
        />
        <Menu :items="menuEntries" to="#keybinding-panel-actions" align="end">
          <template #trigger>
            <Button
              size="icon-lg"
              data-testid="keybinding-preset-menu"
              icon="icon-[lucide--ellipsis]"
              :aria-label="$t('g.more')"
            />
          </template>
        </Menu>
      </div>
    </Teleport>

    <Table
      data-testid="keybinding-table-container"
      class="rounded-lg border border-border-default"
    >
      <TableHeader>
        <TableRow>
          <TableSortHead v-model:direction="commandSortDirection">
            {{ $t('g.command') }}
          </TableSortHead>
          <TableHead class="w-3/10">{{ $t('g.keybinding') }}</TableHead>
          <TableHead class="w-4/25">{{ $t('g.source') }}</TableHead>
          <TableHead class="w-36" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <KeybindingCommandRows
          v-for="commandData in visibleCommands"
          :key="commandData.id"
          :command="commandData"
          :expanded="expandedCommandIds.has(commandData.id)"
          :selected="selectedCommandData?.id === commandData.id"
          @row-click="activateRow(commandData)"
          @row-dblclick="handleRowDblClick(commandData)"
          @row-contextmenu="handleRowContextMenu($event, commandData)"
          @row-keydown="handleRowKeydown($event, commandData)"
          @edit="editKeybinding(commandData, $event)"
          @add="addKeybinding(commandData)"
          @reset="resetKeybinding(commandData)"
          @remove="handleRemoveKeybindingFromMenu(commandData)"
          @remove-single="removeSingleKeybinding(commandData, $event)"
        />
      </TableBody>
    </Table>
    <Pagination
      v-if="filteredCommands.length > commandsPerPageOptions[0]"
      :page="currentPage"
      :total="filteredCommands.length"
      :items-per-page="commandsPerPage"
      :items-per-page-options="commandsPerPageOptions"
      @update:page="currentPage = $event"
      @update:items-per-page="setCommandsPerPage"
    />
    <ContextMenu ref="rowMenu" :model="rowMenuItems" />

    <Button
      v-tooltip="$t('g.resetAllKeybindingsTooltip')"
      class="mt-4 w-full"
      variant="destructive-textonly"
      @click="resetAllKeybindings"
    >
      <i class="icon-[lucide--rotate-ccw]" />
      {{ $t('g.resetAll') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import Button from '@/components/ui/button/Button.vue'
import ContextMenu from '@/components/ui/menu/ContextMenu.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import Pagination from '@/components/ui/pagination/Pagination.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import TableSortHead from '@/components/ui/table/TableSortHead.vue'
import { filterByQuery, sortByText } from '@/components/ui/table/tableUtils'
import type { TableSortDirection } from '@/components/ui/table/tableUtils'
import { useEditKeybindingDialog } from '@/composables/useEditKeybindingDialog'
import type { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useKeybindingPresetService } from '@/platform/keybindings/presetService'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { normalizeI18nKey } from '@/utils/formatUtil'

import KeybindingCommandRows from './keybinding/KeybindingCommandRows.vue'
import type { KeybindingCommand } from './keybinding/keybindingCommandTypes'
import KeybindingPresetToolbar from './keybinding/KeybindingPresetToolbar.vue'

const searchQuery = ref('')

const keybindingStore = useKeybindingStore()
const keybindingService = useKeybindingService()
const presetService = useKeybindingPresetService()
const settingStore = useSettingStore()
const commandStore = useCommandStore()
const dialogStore = useDialogStore()
const { t } = useI18n()
const toastStore = useToastStore()

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
      await presetService.switchToDefaultPreset()
    }
  }
}

onMounted(() => initPresets())

// "..." menu entries (teleported to header)
async function saveAsNewPreset() {
  await presetService.promptAndSaveNewPreset()
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
const commandsData = computed<KeybindingCommand[]>(() => {
  return Object.values(commandStore.commands).map((command) => ({
    id: command.id,
    label: t(
      `commands.${normalizeI18nKey(command.id)}.label`,
      command.label ?? command.id
    ),
    keybindings: keybindingStore.getKeybindingsByCommandId(command.id),
    source: command.source,
    isModified: keybindingStore.isCommandKeybindingModified(command.id)
  }))
})

const commandSortDirection = ref<TableSortDirection | null>(null)
const currentPage = ref(1)
const commandsPerPage = ref(50)
const commandsPerPageOptions = [25, 50, 100]
const filteredCommands = computed(() => {
  const filtered = filterByQuery(
    commandsData.value,
    searchQuery.value,
    (command) => `${command.id} ${command.label}`
  )
  return commandSortDirection.value
    ? sortByText(
        filtered,
        commandSortDirection.value,
        (command) => command.label
      )
    : filtered
})
const visibleCommands = computed(() => {
  const start = (currentPage.value - 1) * commandsPerPage.value
  return filteredCommands.value.slice(start, start + commandsPerPage.value)
})

function setCommandsPerPage(value: number) {
  commandsPerPage.value = value
  currentPage.value = 1
}

const expandedCommandIds = ref<Set<string>>(new Set())

function toggleExpanded(commandId: string) {
  if (expandedCommandIds.value.has(commandId)) {
    expandedCommandIds.value.delete(commandId)
  } else {
    expandedCommandIds.value.add(commandId)
  }
}

watch(searchQuery, () => {
  currentPage.value = 1
  expandedCommandIds.value.clear()
})

const selectedCommandData = ref<KeybindingCommand | null>(null)
const editKeybindingDialog = useEditKeybindingDialog()

const rowMenu = useTemplateRef('rowMenu')
const contextMenuTarget = ref<KeybindingCommand | null>(null)
const rowMenuItems = computed<MenuItem[]>(() => {
  const target = contextMenuTarget.value
  if (!target) return []
  const hasBindings = target.keybindings.length > 0
  return [
    {
      label: t('g.changeKeybinding'),
      icon: 'icon-[lucide--pencil]',
      disabled: !hasBindings,
      command: () => changeKeybinding(target)
    },
    {
      label: t('g.addNewKeybinding'),
      icon: 'icon-[lucide--plus]',
      command: () => addKeybinding(target)
    },
    { separator: true },
    {
      label: t('g.resetToDefault'),
      icon: 'icon-[lucide--rotate-ccw]',
      disabled: !target.isModified,
      command: () => resetKeybinding(target)
    },
    {
      label: t('g.removeKeybinding'),
      icon: 'icon-[lucide--trash-2]',
      disabled: !hasBindings,
      command: () => handleRemoveKeybindingFromMenu(target)
    }
  ]
})

function editKeybinding(
  commandData: KeybindingCommand,
  binding: KeybindingImpl
) {
  editKeybindingDialog.show({
    commandId: commandData.id,
    commandLabel: commandData.label,
    currentCombo: binding.combo,
    mode: 'edit',
    existingBinding: binding
  })
}

function addKeybinding(commandData: KeybindingCommand) {
  editKeybindingDialog.show({
    commandId: commandData.id,
    commandLabel: commandData.label,
    currentCombo: null,
    mode: 'add'
  })
}

function activateRow(commandData: KeybindingCommand) {
  selectedCommandData.value = commandData
  if (
    commandData.keybindings.length >= 2 ||
    expandedCommandIds.value.has(commandData.id)
  ) {
    toggleExpanded(commandData.id)
  }
}

function handleRowKeydown(
  event: KeyboardEvent,
  commandData: KeybindingCommand
) {
  if (event.target !== event.currentTarget) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    activateRow(commandData)
  }
}

function handleRowDblClick(commandData: KeybindingCommand) {
  if (commandData.keybindings.length === 0) {
    addKeybinding(commandData)
  } else if (commandData.keybindings.length === 1) {
    editKeybinding(commandData, commandData.keybindings[0])
  }
}

function handleRowContextMenu(
  event: MouseEvent,
  commandData: KeybindingCommand
) {
  selectedCommandData.value = commandData
  contextMenuTarget.value = commandData
  rowMenu.value?.show(event)
}

async function removeSingleKeybinding(
  commandData: KeybindingCommand,
  index: number
) {
  const binding = commandData.keybindings[index]
  if (binding) {
    keybindingStore.unsetKeybinding(binding)
    if (commandData.keybindings.length <= 2) {
      expandedCommandIds.value.delete(commandData.id)
    }
    await keybindingService.persistUserKeybindings()
  }
}

function handleRemoveAllKeybindings(commandData: KeybindingCommand) {
  const dialog = showConfirmDialog({
    headerProps: { title: t('g.removeAllKeybindingsTitle') },
    props: { promptText: t('g.removeAllKeybindingsMessage') },
    footerProps: {
      confirmText: t('g.removeAll'),
      confirmVariant: 'destructive',
      onCancel: () => dialogStore.closeDialog(dialog),
      onConfirm: async () => {
        keybindingStore.removeAllKeybindingsForCommand(commandData.id)
        await keybindingService.persistUserKeybindings()
        dialogStore.closeDialog(dialog)
      }
    }
  })
}

function handleRemoveKeybindingFromMenu(commandData: KeybindingCommand) {
  if (commandData.keybindings.length >= 2) {
    handleRemoveAllKeybindings(commandData)
  } else {
    removeSingleKeybinding(commandData, 0)
  }
}

function changeKeybinding(commandData: KeybindingCommand) {
  if (commandData.keybindings.length === 1) {
    editKeybinding(commandData, commandData.keybindings[0])
  } else {
    expandedCommandIds.value.add(commandData.id)
  }
}

async function resetKeybinding(commandData: KeybindingCommand) {
  if (keybindingStore.resetKeybindingForCommand(commandData.id)) {
    expandedCommandIds.value.delete(commandData.id)
    await keybindingService.persistUserKeybindings()
  } else {
    console.warn(
      `No changes made when resetting keybinding for command: ${commandData.id}`
    )
  }
}

function resetAllKeybindings() {
  const dialog = showConfirmDialog({
    headerProps: {
      title: t('g.resetAllKeybindingsTitle')
    },
    props: {
      promptText: t('g.resetAllKeybindingsMessage')
    },
    footerProps: {
      confirmText: t('g.resetAll'),
      confirmVariant: 'destructive',
      onCancel: () => {
        dialogStore.closeDialog(dialog)
      },
      onConfirm: async () => {
        keybindingStore.resetAllKeybindings()
        await keybindingService.persistUserKeybindings()
        dialogStore.closeDialog(dialog)
        toastStore.add({
          severity: 'info',
          summary: t('g.info'),
          detail: t('g.allKeybindingsReset'),
          life: 3000
        })
      }
    }
  })
}
</script>
