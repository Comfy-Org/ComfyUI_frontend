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

    <Table data-testid="keybinding-table-container">
      <TableHeader>
        <TableRow>
          <TableSortHead v-model:direction="commandSortDirection">
            {{ $t('g.command') }}
          </TableSortHead>
          <TableHead class="w-3/10">{{ $t('g.keybinding') }}</TableHead>
          <TableHead class="w-4/25">{{ $t('g.source') }}</TableHead>
          <TableHead class="w-36">
            <span class="sr-only">{{ $t('g.actions') }}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <RovingFocusGroup
        v-model:current-tab-stop-id="currentRowTabStopId"
        as-child
        orientation="vertical"
      >
        <TableBody>
          <KeybindingCommandRows
            v-for="command in visibleCommands"
            :key="command.id"
            :command="command"
            :expanded="expandedCommandIds.has(command.id)"
            :selected="selectedCommandId === command.id"
            @activate="activateRow(command)"
            @row-dblclick="handleRowDblClick(command)"
            @row-contextmenu="handleRowContextMenu($event, command)"
            @edit="editKeybinding(command, $event)"
            @add="addKeybinding(command)"
            @reset="resetKeybinding(command)"
            @remove="handleRemoveKeybindingFromMenu(command)"
            @remove-single="removeSingleKeybinding(command, $event)"
          />
        </TableBody>
      </RovingFocusGroup>
    </Table>
    <Pagination
      v-if="filteredCommands.length > commandsPerPageOptions[0]"
      v-model:page="currentPage"
      v-model:items-per-page="commandsPerPage"
      :total="filteredCommands.length"
      :items-per-page-options="commandsPerPageOptions"
    />
    <ContextMenu ref="rowMenu" :model="rowMenuItems" @hide="restoreRowFocus" />

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
import type { ComponentProps } from 'vue-component-type-helpers'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RovingFocusGroup } from 'reka-ui'

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
import KeybindingPresetToolbar from './keybinding/KeybindingPresetToolbar.vue'

type KeybindingCommand = ComponentProps<typeof KeybindingCommandRows>['command']

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
  return Object.values(commandStore.commands).map((command) => {
    const keybindings = keybindingStore.getKeybindingsByCommandId(command.id)
    return {
      expandable: keybindings.length >= 2,
      id: command.id,
      isModified: keybindingStore.isCommandKeybindingModified(command.id),
      keybindings,
      label: t(
        `commands.${normalizeI18nKey(command.id)}.label`,
        command.label ?? command.id
      ),
      rowId: `keybinding-row-${command.id}`,
      source: command.source
    }
  })
})

const commandSortDirection = ref<TableSortDirection | null>(null)
const currentPage = ref(1)
const commandsPerPage = ref(50)
const commandsPerPageOptions = [25, 50, 100]
const filteredCommands = computed(() => {
  const filtered = filterByQuery(
    commandsData.value,
    searchQuery.value,
    (command) => [command.id, command.label]
  )
  return sortByText(
    filtered,
    commandSortDirection.value,
    (command) => command.label
  )
})
const visibleCommands = computed(() => {
  const start = (currentPage.value - 1) * commandsPerPage.value
  return filteredCommands.value.slice(start, start + commandsPerPage.value)
})

watch(commandSortDirection, () => {
  currentPage.value = 1
})

const focusedRowTabStopId = ref<string | null>(null)
const currentRowTabStopId = computed({
  get: () => {
    const rowIds = visibleCommands.value.map((command) => command.rowId)
    const focused = focusedRowTabStopId.value
    return focused && rowIds.includes(focused) ? focused : (rowIds[0] ?? null)
  },
  set: (rowId: string | null) => {
    focusedRowTabStopId.value = rowId
  }
})

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

const selectedCommandId = ref<string | null>(null)
const editKeybindingDialog = useEditKeybindingDialog()

const rowMenu = useTemplateRef('rowMenu')
const contextMenuTarget = ref<KeybindingCommand | null>(null)
let rowMenuOrigin: HTMLElement | null = null
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

function editKeybinding(command: KeybindingCommand, binding: KeybindingImpl) {
  editKeybindingDialog.show({
    commandId: command.id,
    commandLabel: command.label,
    currentCombo: binding.combo,
    existingBinding: binding
  })
}

function addKeybinding(command: KeybindingCommand) {
  editKeybindingDialog.show({
    commandId: command.id,
    commandLabel: command.label,
    currentCombo: null
  })
}

function activateRow(command: KeybindingCommand) {
  selectedCommandId.value = command.id
  if (command.expandable || expandedCommandIds.value.has(command.id)) {
    toggleExpanded(command.id)
  }
}

function handleRowDblClick(command: KeybindingCommand) {
  if (command.keybindings.length === 0) {
    addKeybinding(command)
  } else if (command.keybindings.length === 1) {
    editKeybinding(command, command.keybindings[0])
  }
}

function handleRowContextMenu(event: Event, command: KeybindingCommand) {
  selectedCommandId.value = command.id
  contextMenuTarget.value = command
  rowMenuOrigin =
    event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  rowMenu.value?.show(event)
}

function restoreRowFocus() {
  const focused = document.activeElement
  if (focused === document.body || focused?.closest('[role="menu"]')) {
    rowMenuOrigin?.focus()
  }
  rowMenuOrigin = null
}

async function removeSingleKeybinding(
  command: KeybindingCommand,
  index: number
) {
  const binding = command.keybindings[index]
  if (binding) {
    keybindingStore.unsetKeybinding(binding)
    if (command.keybindings.length <= 2) {
      expandedCommandIds.value.delete(command.id)
    }
    await keybindingService.persistUserKeybindings()
  }
}

function handleRemoveAllKeybindings(command: KeybindingCommand) {
  const dialog = showConfirmDialog({
    headerProps: { title: t('g.removeAllKeybindingsTitle') },
    props: { promptText: t('g.removeAllKeybindingsMessage') },
    footerProps: {
      confirmText: t('g.removeAll'),
      confirmVariant: 'destructive',
      onCancel: () => dialogStore.closeDialog(dialog),
      onConfirm: async () => {
        keybindingStore.removeAllKeybindingsForCommand(command.id)
        await keybindingService.persistUserKeybindings()
        dialogStore.closeDialog(dialog)
      }
    }
  })
}

function handleRemoveKeybindingFromMenu(command: KeybindingCommand) {
  if (command.expandable) {
    handleRemoveAllKeybindings(command)
  } else {
    removeSingleKeybinding(command, 0)
  }
}

function changeKeybinding(command: KeybindingCommand) {
  if (command.keybindings.length === 1) {
    editKeybinding(command, command.keybindings[0])
  } else {
    expandedCommandIds.value.add(command.id)
  }
}

async function resetKeybinding(command: KeybindingCommand) {
  if (keybindingStore.resetKeybindingForCommand(command.id)) {
    expandedCommandIds.value.delete(command.id)
    await keybindingService.persistUserKeybindings()
  } else {
    console.warn(
      `No changes made when resetting keybinding for command: ${command.id}`
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
