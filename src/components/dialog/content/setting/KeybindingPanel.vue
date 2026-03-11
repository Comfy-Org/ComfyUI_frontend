<template>
  <div class="keybinding-panel flex flex-col gap-2">
    <SearchInput
      v-model="filters['global'].value"
      :placeholder="$t('g.searchPlaceholder', { subject: $t('g.keybindings') })"
    />

    <DataTable
      v-model:selection="selectedCommandData"
      v-model:context-menu-selection="contextMenuSelection"
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
              :class="expandedCommandIds.has(slotProps.data.id) && 'rotate-90'"
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
                  keybindingStore.isCommandKeybindingModified(slotProps.data.id)
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
            <template v-if="slotProps.data.keybindings.length >= 2">
              <Button
                variant="textonly"
                size="icon"
                :aria-label="$t('g.addNewKeybinding')"
                @click="addKeybinding(slotProps.data)"
              >
                <i class="icon-[lucide--plus]" />
              </Button>
              <Button
                variant="textonly"
                size="icon"
                :aria-label="$t('g.delete')"
                @click="handleRemoveAllKeybindings(slotProps.data)"
              >
                <i class="pi pi-trash" />
              </Button>
            </template>
            <template v-else-if="slotProps.data.keybindings.length === 1">
              <Button
                variant="textonly"
                size="icon"
                :aria-label="$t('g.edit')"
                @click="
                  editKeybinding(slotProps.data, slotProps.data.keybindings[0])
                "
              >
                <i class="pi pi-pencil" />
              </Button>
              <Button
                variant="textonly"
                size="icon"
                :aria-label="$t('g.addNewKeybinding')"
                @click="addKeybinding(slotProps.data)"
              >
                <i class="icon-[lucide--plus]" />
              </Button>
              <Button
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
                <i class="pi pi-replay" />
              </Button>
              <Button
                variant="textonly"
                size="icon"
                :aria-label="$t('g.delete')"
                @click="removeSingleKeybinding(slotProps.data, 0)"
              >
                <i class="pi pi-trash" />
              </Button>
            </template>
            <template v-else>
              <Button
                variant="textonly"
                size="icon"
                :aria-label="$t('g.addNewKeybinding')"
                @click="addKeybinding(slotProps.data)"
              >
                <i class="icon-[lucide--plus]" />
              </Button>
              <Button
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
                <i class="pi pi-replay" />
              </Button>
              <Button
                variant="textonly"
                size="icon"
                :aria-label="$t('g.delete')"
                disabled
              >
                <i class="pi pi-trash" />
              </Button>
            </template>
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
                  keybindingStore.isCommandKeybindingModified(slotProps.data.id)
                "
              />
            </div>
            <div class="flex flex-row">
              <Button
                variant="textonly"
                size="icon"
                :aria-label="$t('g.edit')"
                @click="editKeybinding(slotProps.data, binding)"
              >
                <i class="pi pi-pencil" />
              </Button>
              <Button
                v-if="idx === 0"
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
                <i class="pi pi-replay" />
              </Button>
              <Button
                variant="textonly"
                size="icon"
                :aria-label="$t('g.removeKeybinding')"
                @click="removeSingleKeybinding(slotProps.data, idx)"
              >
                <i class="pi pi-trash" />
              </Button>
            </div>
          </div>
        </div>
      </template>
    </DataTable>

    <Teleport to="body">
      <div
        v-if="contextMenuOpen"
        ref="contextMenuRef"
        class="fixed z-1200 min-w-56 rounded-lg border border-border-subtle bg-base-background px-2 py-3 shadow-interface"
        :style="{ left: contextMenuPos.x + 'px', top: contextMenuPos.y + 'px' }"
      >
        <button
          class="flex w-full cursor-pointer items-center gap-2 rounded-sm border-none bg-transparent px-3 py-2 text-sm text-text-primary outline-none hover:bg-node-component-surface-hovered focus-visible:bg-node-component-surface-hovered disabled:cursor-default disabled:opacity-50"
          :disabled="
            !contextMenuTarget || contextMenuTarget.keybindings.length === 0
          "
          @click="ctxChangeKeybinding"
        >
          <i class="icon-[lucide--pencil] size-4" />
          {{ $t('g.changeKeybinding') }}
        </button>
        <button
          class="flex w-full cursor-pointer items-center gap-2 rounded-sm border-none bg-transparent px-3 py-2 text-sm text-text-primary outline-none hover:bg-node-component-surface-hovered focus-visible:bg-node-component-surface-hovered"
          @click="ctxAddKeybinding"
        >
          <i class="icon-[lucide--plus] size-4" />
          {{ $t('g.addNewKeybinding') }}
        </button>
        <hr class="my-1 border-border-subtle" />
        <button
          class="flex w-full cursor-pointer items-center gap-2 rounded-sm border-none bg-transparent px-3 py-2 text-sm text-text-primary outline-none hover:bg-node-component-surface-hovered focus-visible:bg-node-component-surface-hovered disabled:cursor-default disabled:opacity-50"
          :disabled="
            !contextMenuTarget ||
            !keybindingStore.isCommandKeybindingModified(contextMenuTarget.id)
          "
          @click="ctxResetToDefault"
        >
          <i class="icon-[lucide--rotate-ccw] size-4" />
          {{ $t('g.resetToDefault') }}
        </button>
        <button
          class="flex w-full cursor-pointer items-center gap-2 rounded-sm border-none bg-transparent px-3 py-2 text-sm text-text-primary outline-none hover:bg-node-component-surface-hovered focus-visible:bg-node-component-surface-hovered disabled:cursor-default disabled:opacity-50"
          :disabled="
            !contextMenuTarget || contextMenuTarget.keybindings.length === 0
          "
          @click="ctxRemoveKeybinding"
        >
          <i class="icon-[lucide--trash-2] size-4" />
          {{ $t('g.removeKeybinding') }}
        </button>
      </div>
    </Teleport>

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
    <Button
      v-tooltip="$t('g.resetAllKeybindingsTooltip')"
      class="mt-4 w-full"
      variant="destructive-textonly"
      @click="resetAllKeybindings"
    >
      <i class="pi pi-replay" />
      {{ $t('g.resetAll') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { FilterMatchMode } from '@primevue/core/api'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import RemoveAllKeybindingsContent from '@/components/dialog/content/setting/keybinding/RemoveAllKeybindingsContent.vue'
import RemoveAllKeybindingsHeader from '@/components/dialog/content/setting/keybinding/RemoveAllKeybindingsHeader.vue'
import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { KeyComboImpl } from '@/platform/keybindings/keyCombo'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useDialogService } from '@/services/dialogService'
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
const dialogService = useDialogService()
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
const editDialogVisible = ref(false)
const newBindingKeyCombo = ref<KeyComboImpl | null>(null)
const currentEditingCommand = ref<ICommandData | null>(null)
const editingBinding = ref<KeybindingImpl | null>(null)
const editMode = ref<'edit' | 'add'>('edit')
const keybindingInput = ref<InstanceType<typeof InputText> | null>(null)

const contextMenuTarget = ref<ICommandData | null>(null)
const contextMenuSelection = ref<ICommandData | null>(null)
const contextMenuOpen = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const contextMenuRef = ref<HTMLElement | null>(null)

onClickOutside(contextMenuRef, () => closeContextMenu())

function closeContextMenu() {
  contextMenuOpen.value = false
}

const existingKeybindingOnCombo = computed<KeybindingImpl | null>(() => {
  if (!currentEditingCommand.value) return null

  if (editingBinding.value?.combo?.equals(newBindingKeyCombo.value)) {
    return null
  }

  if (!newBindingKeyCombo.value) return null

  return keybindingStore.getKeybinding(newBindingKeyCombo.value)
})

function editKeybinding(commandData: ICommandData, binding: KeybindingImpl) {
  currentEditingCommand.value = commandData
  editingBinding.value = binding
  editMode.value = 'edit'
  newBindingKeyCombo.value = binding.combo
  editDialogVisible.value = true
}

function addKeybinding(commandData: ICommandData) {
  currentEditingCommand.value = commandData
  editingBinding.value = null
  editMode.value = 'add'
  newBindingKeyCombo.value = null
  editDialogVisible.value = true
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
  event.originalEvent.preventDefault()
  contextMenuTarget.value = event.data
  const mouseEvent = event.originalEvent as MouseEvent
  contextMenuPos.value = { x: mouseEvent.clientX, y: mouseEvent.clientY }
  contextMenuOpen.value = true
}

watchEffect(() => {
  if (editDialogVisible.value) {
    setTimeout(() => {
      // @ts-expect-error - $el is an internal property of the InputText component
      keybindingInput.value?.$el?.focus()
    }, 300)
  }
})

async function removeSingleKeybinding(
  commandData: ICommandData,
  index: number
) {
  const binding = commandData.keybindings[index]
  if (binding) {
    keybindingStore.unsetKeybinding(binding)
    await keybindingService.persistUserKeybindings()
  }
}

const REMOVE_ALL_DIALOG_KEY = 'remove-all-keybindings'

function showRemoveAllDialog(): Promise<boolean> {
  return new Promise((resolve) => {
    dialogService.showSmallLayoutDialog({
      key: REMOVE_ALL_DIALOG_KEY,
      headerComponent: RemoveAllKeybindingsHeader,
      component: RemoveAllKeybindingsContent,
      props: {
        onResult: (result: boolean) => {
          resolve(result)
          dialogStore.closeDialog({ key: REMOVE_ALL_DIALOG_KEY })
        }
      },
      dialogComponentProps: {
        onClose: () => resolve(false)
      }
    })
  })
}

async function handleRemoveAllKeybindings(commandData: ICommandData) {
  const confirmed = await showRemoveAllDialog()
  if (!confirmed) return
  keybindingStore.removeAllKeybindingsForCommand(commandData.id)
  await keybindingService.persistUserKeybindings()
}

function handleRemoveKeybindingFromMenu(commandData: ICommandData) {
  if (commandData.keybindings.length >= 2) {
    handleRemoveAllKeybindings(commandData)
  } else {
    removeSingleKeybinding(commandData, 0)
  }
}

function ctxChangeKeybinding() {
  if (!contextMenuTarget.value) {
    closeContextMenu()
    return
  }
  const target = contextMenuTarget.value
  if (target.keybindings.length === 1) {
    editKeybinding(target, target.keybindings[0])
  } else if (target.keybindings.length >= 2) {
    if (!expandedCommandIds.value.has(target.id)) {
      toggleExpanded(target.id)
    }
  }
  closeContextMenu()
}

function ctxAddKeybinding() {
  if (contextMenuTarget.value) {
    addKeybinding(contextMenuTarget.value)
  }
  closeContextMenu()
}

function ctxResetToDefault() {
  if (contextMenuTarget.value) {
    resetKeybinding(contextMenuTarget.value)
  }
  closeContextMenu()
}

function ctxRemoveKeybinding() {
  if (
    contextMenuTarget.value &&
    contextMenuTarget.value.keybindings.length > 0
  ) {
    handleRemoveKeybindingFromMenu(contextMenuTarget.value)
  }
  closeContextMenu()
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
  editingBinding.value = null
  newBindingKeyCombo.value = null
}

async function saveKeybinding() {
  const commandId = currentEditingCommand.value?.id
  const combo = newBindingKeyCombo.value
  const currentEditMode = editMode.value
  const currentEditingBindingValue = editingBinding.value
  cancelEdit()
  if (!combo || commandId === undefined) return

  if (currentEditMode === 'add') {
    keybindingStore.addUserKeybinding(new KeybindingImpl({ commandId, combo }))
  } else if (currentEditingBindingValue) {
    keybindingStore.updateSpecificKeybinding(
      currentEditingBindingValue,
      new KeybindingImpl({ commandId, combo })
    )
  } else {
    keybindingStore.updateKeybindingOnCommand(
      new KeybindingImpl({ commandId, combo })
    )
  }
  await keybindingService.persistUserKeybindings()
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
