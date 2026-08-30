<template>
  <div
    :ref="primeVueOverlay.overlayScopeRef"
    class="keybinding-panel flex min-w-0 flex-col gap-2 overflow-x-hidden"
  >
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
          :content-style="keybindingOverlayContentStyle"
          @presets-changed="refreshPresetList"
        />
        <DropdownMenu
          :entries="menuEntries"
          :style="keybindingOverlayContentStyle"
          icon="icon-[lucide--ellipsis]"
          item-class="text-sm gap-2"
          button-size="unset"
          button-class="size-10"
          to="#keybinding-panel-actions"
          align="end"
        >
          <template #button>
            <Button
              size="unset"
              class="size-10"
              data-testid="keybinding-preset-menu"
            >
              <i class="icon-[lucide--ellipsis]" />
            </Button>
          </template>
        </DropdownMenu>
      </div>
    </Teleport>

    <ContextMenuRoot>
      <ContextMenuTrigger as-child>
        <div
          class="min-w-0 overflow-x-hidden"
          @contextmenu.capture="clearContextMenuTarget"
        >
          <Table
            data-testid="keybinding-table-container"
            class="rounded-lg border border-border-default"
          >
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    class="flex items-center gap-1 hover:text-base-foreground"
                    @click="toggleCommandSort"
                  >
                    {{ $t('g.command') }}
                    <i
                      :class="
                        commandSortDirection === 'ascending'
                          ? 'icon-[lucide--arrow-up]'
                          : 'icon-[lucide--arrow-down]'
                      "
                      class="size-4"
                    />
                  </button>
                </TableHead>
                <TableHead class="w-3/10">{{ $t('g.keybinding') }}</TableHead>
                <TableHead class="w-4/25">{{ $t('g.source') }}</TableHead>
                <TableHead class="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <template
                v-for="commandData in visibleCommands"
                :key="commandData.id"
              >
                <TableRow
                  :data-state="
                    selectedCommandData?.id === commandData.id
                      ? 'selected'
                      : undefined
                  "
                  @click="handleRowClick($event, commandData)"
                  @dblclick="handleRowDblClick(commandData)"
                  @contextmenu="handleRowContextMenu(commandData)"
                >
                  <TableCell class="p-1">
                    <div
                      class="flex min-w-0 items-center gap-1 truncate"
                      :class="commandData.keybindings.length < 2 && 'pl-5'"
                      :title="commandData.id"
                    >
                      <i
                        v-if="commandData.keybindings.length >= 2"
                        class="icon-[lucide--chevron-right] size-4 shrink-0 text-muted-foreground transition-transform"
                        :class="
                          expandedCommandIds.has(commandData.id) && 'rotate-90'
                        "
                      />
                      <i
                        v-if="
                          commandData.keybindings.some(
                            (b: KeybindingImpl) => b.combo.isBrowserReserved
                          )
                        "
                        v-tooltip="$t('g.browserReservedKeybindingTooltip')"
                        class="icon-[lucide--triangle-alert] shrink-0 text-warning-background"
                      />
                      {{ commandData.label }}
                    </div>
                  </TableCell>
                  <TableCell class="p-1">
                    <KeybindingList
                      :keybindings="commandData.keybindings"
                      :is-modified="commandData.isModified"
                    />
                  </TableCell>
                  <TableCell class="p-1">
                    <span class="block truncate" :title="commandData.source">{{
                      commandData.source || '-'
                    }}</span>
                  </TableCell>
                  <TableCell class="p-1 whitespace-nowrap">
                    <div
                      class="actions flex flex-row justify-end whitespace-nowrap"
                    >
                      <Button
                        v-if="commandData.keybindings.length === 1"
                        v-tooltip="$t('g.edit')"
                        variant="textonly"
                        size="icon"
                        :aria-label="$t('g.edit')"
                        @click="
                          editKeybinding(
                            commandData,
                            commandData.keybindings[0]
                          )
                        "
                      >
                        <i class="icon-[lucide--pencil]" />
                      </Button>
                      <Button
                        v-tooltip="$t('g.addNewKeybinding')"
                        variant="textonly"
                        size="icon"
                        :aria-label="$t('g.addNewKeybinding')"
                        @click="addKeybinding(commandData)"
                      >
                        <i class="icon-[lucide--plus]" />
                      </Button>
                      <Button
                        v-tooltip="$t('g.reset')"
                        variant="textonly"
                        size="icon"
                        :aria-label="$t('g.reset')"
                        :disabled="!commandData.isModified"
                        @click="resetKeybinding(commandData)"
                      >
                        <i class="icon-[lucide--rotate-ccw]" />
                      </Button>
                      <Button
                        v-tooltip="$t('g.delete')"
                        variant="textonly"
                        size="icon"
                        :aria-label="$t('g.delete')"
                        :disabled="commandData.keybindings.length === 0"
                        @click="handleRemoveKeybindingFromMenu(commandData)"
                      >
                        <i class="icon-[lucide--trash-2]" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow v-if="expandedCommandIds.has(commandData.id)">
                  <TableCell colspan="4" class="p-0">
                    <div
                      class="pl-4"
                      data-testid="keybinding-expansion-content"
                    >
                      <div
                        v-for="(binding, idx) in commandData.keybindings"
                        :key="binding.combo.serialize()"
                        data-testid="keybinding-expansion-binding"
                        class="flex items-center justify-between border-b border-border-subtle py-1.5 last:border-b-0"
                      >
                        <div class="flex items-center gap-4">
                          <span class="text-muted-foreground">{{
                            commandData.label
                          }}</span>
                          <KeyComboDisplay
                            :key-combo="binding.combo"
                            :is-modified="commandData.isModified"
                          />
                        </div>
                        <div class="flex flex-row">
                          <Button
                            v-tooltip="$t('g.edit')"
                            variant="textonly"
                            size="icon"
                            :aria-label="$t('g.edit')"
                            @click="editKeybinding(commandData, binding)"
                          >
                            <i class="icon-[lucide--pencil]" />
                          </Button>
                          <Button
                            v-tooltip="$t('g.removeKeybinding')"
                            variant="textonly"
                            size="icon"
                            :aria-label="$t('g.removeKeybinding')"
                            @click="removeSingleKeybinding(commandData, idx)"
                          >
                            <i class="icon-[lucide--trash-2]" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
          <Pagination
            v-if="filteredCommands.length > commandsPerPage"
            :page="currentPage"
            :total="filteredCommands.length"
            :items-per-page="commandsPerPage"
            class="mt-3 flex justify-center"
            @update:page="currentPage = $event"
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuPortal>
        <ContextMenuContent
          :style="keybindingOverlayContentStyle"
          class="z-1800 min-w-56 rounded-lg border border-border-subtle bg-base-background px-2 py-3 shadow-interface"
        >
          <ContextMenuItem
            class="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm text-text-primary outline-none select-none hover:bg-node-component-surface-hovered focus:bg-node-component-surface-hovered data-disabled:cursor-default data-disabled:opacity-50"
            :disabled="
              !contextMenuTarget || contextMenuTarget.keybindings.length === 0
            "
            @select="ctxChangeKeybinding"
          >
            <i class="icon-[lucide--pencil] size-4" />
            {{ $t('g.changeKeybinding') }}
          </ContextMenuItem>
          <ContextMenuItem
            class="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm text-text-primary outline-none select-none hover:bg-node-component-surface-hovered focus:bg-node-component-surface-hovered"
            @select="ctxAddKeybinding"
          >
            <i class="icon-[lucide--plus] size-4" />
            {{ $t('g.addNewKeybinding') }}
          </ContextMenuItem>
          <ContextMenuSeparator class="my-1 h-px bg-border-subtle" />
          <ContextMenuItem
            class="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm text-text-primary outline-none select-none hover:bg-node-component-surface-hovered focus:bg-node-component-surface-hovered data-disabled:cursor-default data-disabled:opacity-50"
            :disabled="!contextMenuTarget?.isModified"
            @select="ctxResetToDefault"
          >
            <i class="icon-[lucide--rotate-ccw] size-4" />
            {{ $t('g.resetToDefault') }}
          </ContextMenuItem>
          <ContextMenuItem
            class="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm text-text-primary outline-none select-none hover:bg-node-component-surface-hovered focus:bg-node-component-surface-hovered data-disabled:cursor-default data-disabled:opacity-50"
            :disabled="
              !contextMenuTarget || contextMenuTarget.keybindings.length === 0
            "
            @select="ctxRemoveKeybinding"
          >
            <i class="icon-[lucide--trash-2] size-4" />
            {{ $t('g.removeKeybinding') }}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenuPortal>
    </ContextMenuRoot>

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
import type { MenuItem } from '@/components/ui/menu/types'
import { useToast } from 'primevue/usetoast'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuTrigger
} from 'reka-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import DropdownMenu from '@/components/common/DropdownMenu.vue'
import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import Button from '@/components/ui/button/Button.vue'
import Pagination from '@/components/ui/pagination/Pagination.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import { filterByQuery, sortByText } from '@/components/ui/table/tableUtils'
import type { TableSortDirection } from '@/components/ui/table/tableUtils'
import { useEditKeybindingDialog } from '@/composables/useEditKeybindingDialog'
import { usePrimeVueOverlayChildStyle } from '@/composables/usePopoverSizing'
import type { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useKeybindingPresetService } from '@/platform/keybindings/presetService'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { normalizeI18nKey } from '@/utils/formatUtil'

import KeybindingList from './keybinding/KeybindingList.vue'
import KeybindingPresetToolbar from './keybinding/KeybindingPresetToolbar.vue'
import KeyComboDisplay from './keybinding/KeyComboDisplay.vue'

const searchQuery = ref('')

const keybindingStore = useKeybindingStore()
const keybindingService = useKeybindingService()
const presetService = useKeybindingPresetService()
const settingStore = useSettingStore()
const commandStore = useCommandStore()
const dialogStore = useDialogStore()
const { t } = useI18n()
const primeVueOverlay = usePrimeVueOverlayChildStyle()
const keybindingOverlayContentStyle = primeVueOverlay.contentStyle

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
interface ICommandData {
  id: string
  keybindings: KeybindingImpl[]
  label: string
  source?: string
  isModified: boolean
}

const commandsData = computed<ICommandData[]>(() => {
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

const commandSortDirection = ref<TableSortDirection>('ascending')
const currentPage = ref(1)
const commandsPerPage = 50
const filteredCommands = computed(() => {
  const filtered = filterByQuery(
    commandsData.value,
    searchQuery.value,
    (command) => `${command.id} ${command.label}`
  )
  return sortByText(
    filtered,
    commandSortDirection.value,
    (command) => command.label
  )
})
const visibleCommands = computed(() => {
  const start = (currentPage.value - 1) * commandsPerPage
  return filteredCommands.value.slice(start, start + commandsPerPage)
})

function toggleCommandSort() {
  commandSortDirection.value =
    commandSortDirection.value === 'ascending' ? 'descending' : 'ascending'
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

const selectedCommandData = ref<ICommandData | null>(null)
const editKeybindingDialog = useEditKeybindingDialog()

const contextMenuTarget = ref<ICommandData | null>(null)

function editKeybinding(commandData: ICommandData, binding: KeybindingImpl) {
  editKeybindingDialog.show({
    commandId: commandData.id,
    commandLabel: commandData.label,
    currentCombo: binding.combo,
    mode: 'edit',
    existingBinding: binding
  })
}

function addKeybinding(commandData: ICommandData) {
  editKeybindingDialog.show({
    commandId: commandData.id,
    commandLabel: commandData.label,
    currentCombo: null,
    mode: 'add'
  })
}

function handleRowClick(event: MouseEvent, commandData: ICommandData) {
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  if (target.closest('.actions')) return
  selectedCommandData.value = commandData
  if (
    commandData.keybindings.length >= 2 ||
    expandedCommandIds.value.has(commandData.id)
  ) {
    toggleExpanded(commandData.id)
  }
}

function handleRowDblClick(commandData: ICommandData) {
  if (commandData.keybindings.length === 0) {
    addKeybinding(commandData)
  } else if (commandData.keybindings.length === 1) {
    editKeybinding(commandData, commandData.keybindings[0])
  }
}

function handleRowContextMenu(commandData: ICommandData) {
  selectedCommandData.value = commandData
  contextMenuTarget.value = commandData
}

function clearContextMenuTarget() {
  contextMenuTarget.value = null
}

async function removeSingleKeybinding(
  commandData: ICommandData,
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

function handleRemoveAllKeybindings(commandData: ICommandData) {
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

function handleRemoveKeybindingFromMenu(commandData: ICommandData) {
  if (commandData.keybindings.length >= 2) {
    handleRemoveAllKeybindings(commandData)
  } else {
    removeSingleKeybinding(commandData, 0)
  }
}

function ctxChangeKeybinding() {
  if (!contextMenuTarget.value) return
  const target = contextMenuTarget.value
  if (target.keybindings.length === 1) {
    editKeybinding(target, target.keybindings[0])
  } else if (target.keybindings.length >= 2) {
    if (!expandedCommandIds.value.has(target.id)) {
      toggleExpanded(target.id)
    }
  }
}

function ctxAddKeybinding() {
  if (contextMenuTarget.value) {
    addKeybinding(contextMenuTarget.value)
  }
}

function ctxResetToDefault() {
  if (contextMenuTarget.value) {
    resetKeybinding(contextMenuTarget.value)
  }
}

function ctxRemoveKeybinding() {
  if (
    contextMenuTarget.value &&
    contextMenuTarget.value.keybindings.length > 0
  ) {
    handleRemoveKeybindingFromMenu(contextMenuTarget.value)
  }
}

async function resetKeybinding(commandData: ICommandData) {
  if (keybindingStore.resetKeybindingForCommand(commandData.id)) {
    expandedCommandIds.value.delete(commandData.id)
    await keybindingService.persistUserKeybindings()
  } else {
    console.warn(
      `No changes made when resetting keybinding for command: ${commandData.id}`
    )
  }
}

const toast = useToast()

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
        toast.add({
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
