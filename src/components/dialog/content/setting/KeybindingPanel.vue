<template>
  <div class="keybinding-panel flex flex-col gap-2">
    <SearchInput
      v-model="filters['global'].value"
      :placeholder="$t('g.searchPlaceholder', { subject: $t('g.keybindings') })"
    />

    <ContextMenuRoot>
      <ContextMenuTrigger as-child>
        <div @contextmenu.capture="clearContextMenuTarget">
          <DataTable
            v-model:selection="selectedCommandData"
            v-model:expanded-rows="expandedRows"
            :value="commandsData"
            data-key="id"
            :global-filter-fields="['id', 'label']"
            :filters="filters"
            selection-mode="single"
            context-menu
            striped-rows
            :pt="{
              header: 'px-0'
            }"
            @row-click="handleRowClick($event)"
            @row-dblclick="handleRowDblClick($event.data)"
            @row-contextmenu="handleRowContextMenu($event)"
          >
            <Column
              field="id"
              :header="$t('g.command')"
              sortable
              class="max-w-64 2xl:max-w-full"
              :pt="{ bodyCell: 'p-1 min-h-8' }"
            >
              <template #body="slotProps">
                <div
                  class="flex items-center gap-1 truncate"
                  :class="slotProps.data.keybindings.length < 2 && 'pl-5'"
                  :title="slotProps.data.id"
                >
                  <i
                    v-if="slotProps.data.keybindings.length >= 2"
                    class="icon-[lucide--chevron-right] size-4 shrink-0 text-muted-foreground transition-transform"
                    :class="
                      expandedCommandIds.has(slotProps.data.id) && 'rotate-90'
                    "
                  />
                  <i
                    v-if="
                      slotProps.data.keybindings.some(
                        (b: KeybindingImpl) => b.combo.isBrowserReserved
                      )
                    "
                    v-tooltip="$t('g.browserReservedKeybindingTooltip')"
                    class="icon-[lucide--triangle-alert] shrink-0 text-warning-background"
                  />
                  {{ slotProps.data.label }}
                </div>
              </template>
            </Column>
            <Column
              field="keybindings"
              :header="$t('g.keybinding')"
              :pt="{ bodyCell: 'p-1 min-h-8' }"
            >
              <template #body="slotProps">
                <div
                  v-if="slotProps.data.keybindings.length > 0"
                  class="flex items-center gap-1"
                >
                  <template
                    v-for="(binding, idx) in (
                      slotProps.data as ICommandData
                    ).keybindings.slice(0, 2)"
                    :key="binding.combo.serialize()"
                  >
                    <span v-if="idx > 0" class="text-muted-foreground">,</span>
                    <KeyComboDisplay
                      :key-combo="binding.combo"
                      :is-modified="
                        keybindingStore.isCommandKeybindingModified(
                          slotProps.data.id
                        )
                      "
                    />
                  </template>
                  <span
                    v-if="slotProps.data.keybindings.length > 2"
                    class="rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {{
                      $t('g.nMoreKeybindings', {
                        count: slotProps.data.keybindings.length - 2
                      })
                    }}
                  </span>
                </div>
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
            <Column field="actions" header="" :pt="{ bodyCell: 'p-1 min-h-8' }">
              <template #body="slotProps">
                <div class="actions flex flex-row justify-end">
                  <Button
                    v-if="slotProps.data.keybindings.length === 1"
                    v-tooltip="$t('g.edit')"
                    variant="textonly"
                    size="icon"
                    :aria-label="$t('g.edit')"
                    @click="
                      editKeybinding(
                        slotProps.data,
                        slotProps.data.keybindings[0]
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
                    @click="addKeybinding(slotProps.data)"
                  >
                    <i class="icon-[lucide--plus]" />
                  </Button>
                  <Button
                    v-tooltip="$t('g.reset')"
                    variant="textonly"
                    size="icon"
                    :aria-label="$t('g.reset')"
                    :disabled="
                      !keybindingStore.isCommandKeybindingModified(
                        slotProps.data.id
                      )
                    "
                    @click="resetKeybinding(slotProps.data)"
                  >
                    <i class="icon-[lucide--rotate-ccw]" />
                  </Button>
                  <Button
                    v-tooltip="$t('g.delete')"
                    variant="textonly"
                    size="icon"
                    :aria-label="$t('g.delete')"
                    :disabled="slotProps.data.keybindings.length === 0"
                    @click="handleRemoveKeybindingFromMenu(slotProps.data)"
                  >
                    <i class="icon-[lucide--trash-2]" />
                  </Button>
                </div>
              </template>
            </Column>
            <template #expansion="slotProps">
              <div class="pl-4">
                <div
                  v-for="(binding, idx) in (slotProps.data as ICommandData)
                    .keybindings"
                  :key="binding.combo.serialize()"
                  class="flex items-center justify-between border-b border-border-subtle py-1.5 last:border-b-0"
                >
                  <div class="flex items-center gap-4">
                    <span class="text-muted-foreground">{{
                      slotProps.data.label
                    }}</span>
                    <KeyComboDisplay
                      :key-combo="binding.combo"
                      :is-modified="
                        keybindingStore.isCommandKeybindingModified(
                          slotProps.data.id
                        )
                      "
                    />
                  </div>
                  <div class="flex flex-row">
                    <Button
                      v-tooltip="$t('g.edit')"
                      variant="textonly"
                      size="icon"
                      :aria-label="$t('g.edit')"
                      @click="editKeybinding(slotProps.data, binding)"
                    >
                      <i class="icon-[lucide--pencil]" />
                    </Button>
                    <Button
                      v-tooltip="$t('g.removeKeybinding')"
                      variant="textonly"
                      size="icon"
                      :aria-label="$t('g.removeKeybinding')"
                      @click="removeSingleKeybinding(slotProps.data, idx)"
                    >
                      <i class="icon-[lucide--trash-2]" />
                    </Button>
                  </div>
                </div>
              </div>
            </template>
          </DataTable>
        </div>
      </ContextMenuTrigger>
      <ContextMenuPortal>
        <ContextMenuContent
          class="z-1200 min-w-56 rounded-lg border border-border-subtle bg-base-background px-2 py-3 shadow-interface"
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
            :disabled="
              !contextMenuTarget ||
              !keybindingStore.isCommandKeybindingModified(contextMenuTarget.id)
            "
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
import { FilterMatchMode } from '@primevue/core/api'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import { useToast } from 'primevue/usetoast'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuTrigger
} from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { useEditKeybindingDialog } from '@/composables/useEditKeybindingDialog'
import type { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { normalizeI18nKey } from '@/utils/formatUtil'

import KeyComboDisplay from './keybinding/KeyComboDisplay.vue'

const filters = ref({
  global: { value: '', matchMode: FilterMatchMode.CONTAINS }
})

const keybindingStore = useKeybindingStore()
const keybindingService = useKeybindingService()
const commandStore = useCommandStore()
const dialogStore = useDialogStore()
const { t } = useI18n()

interface ICommandData {
  id: string
  keybindings: KeybindingImpl[]
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
    keybindings: keybindingStore.getKeybindingsByCommandId(command.id),
    source: command.source
  }))
})

const expandedCommandIds = ref<Set<string>>(new Set())

const expandedRows = computed({
  get() {
    const result: Record<string, boolean> = {}
    for (const id of expandedCommandIds.value) {
      result[id] = true
    }
    return result
  },
  set(value: Record<string, boolean>) {
    expandedCommandIds.value = new Set(Object.keys(value))
  }
})

function toggleExpanded(commandId: string) {
  if (expandedCommandIds.value.has(commandId)) {
    expandedCommandIds.value.delete(commandId)
  } else {
    expandedCommandIds.value.add(commandId)
  }
}

watch(filters, () => expandedCommandIds.value.clear(), { deep: true })

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

function handleRowClick(event: { originalEvent: Event; data: ICommandData }) {
  const target = event.originalEvent.target as HTMLElement
  if (target.closest('.actions')) return
  const commandData = event.data
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

function handleRowContextMenu(event: {
  originalEvent: Event
  data: ICommandData
}) {
  contextMenuTarget.value = event.data
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
