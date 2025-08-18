<template>
  <a
    ref="wrapperRef"
    v-tooltip.bottom="{
      value: item.label,
      showDelay: 512
    }"
    href="#"
    class="cursor-pointer p-breadcrumb-item-link"
    :class="{
      'flex items-center gap-1': isActive,
      'p-breadcrumb-item-link-menu-visible': menu?.overlayVisible,
      'p-breadcrumb-item-link-icon-visible': isActive,
      'active-breadcrumb-item': isActive
    }"
    @click="handleClick"
  >
    <span class="p-breadcrumb-item-label">{{ item.label }}</span>
    <i v-if="isActive" class="pi pi-angle-down text-[10px]"></i>
  </a>
  <Menu
    v-if="isActive"
    ref="menu"
    :model="menuItems"
    :popup="true"
    :pt="{
      root: {
        style: 'background-color: var(--comfy-menu-secondary-bg)'
      },
      itemLink: {
        class: 'py-2'
      }
    }"
  />
  <InputText
    v-if="isEditing"
    ref="itemInputRef"
    v-model="itemLabel"
    class="fixed z-[10000] text-[.8rem] px-2 py-2"
    @blur="inputBlur(true)"
    @click.stop
    @keydown.enter="inputBlur(true)"
    @keydown.esc="inputBlur(false)"
  />
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Menu, { MenuState } from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useDialogService } from '@/services/dialogService'
import { useWorkflowService } from '@/services/workflowService'
import { useCommandStore } from '@/stores/commandStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { ComfyWorkflow, useWorkflowStore } from '@/stores/workflowStore'
import { appendJsonExt } from '@/utils/formatUtil'

interface Props {
  item: MenuItem
  isActive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false
})

const { t } = useI18n()
const menu = ref<InstanceType<typeof Menu> & MenuState>()
const dialogService = useDialogService()
const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const isEditing = ref(false)
const itemLabel = ref<string>()
const itemInputRef = ref<{ $el?: HTMLInputElement }>()
const wrapperRef = ref<HTMLAnchorElement>()

const rename = async (
  newName: string | null | undefined,
  initialName: string
) => {
  if (newName && newName !== initialName) {
    // Synchronize the node titles with the new name
    props.item.updateTitle?.(newName)

    if (workflowStore.activeSubgraph) {
      workflowStore.activeSubgraph.name = newName
    } else if (workflowStore.activeWorkflow) {
      try {
        await workflowService.renameWorkflow(
          workflowStore.activeWorkflow,
          ComfyWorkflow.basePath + appendJsonExt(newName)
        )
      } catch (error) {
        console.error(error)
        dialogService.showErrorDialog(error)
        return
      }
    }

    // Force the navigation stack to recompute the labels
    // TODO: investigate if there is a better way to do this
    const navigationStore = useSubgraphNavigationStore()
    navigationStore.restoreState(navigationStore.exportState())
  }
}

const menuItems = computed<MenuItem[]>(() => {
  return [
    {
      label: t('g.rename'),
      icon: 'pi pi-pencil',
      command: startRename
    },
    {
      label: t('breadcrumbsMenu.duplicate'),
      icon: 'pi pi-copy',
      command: async () => {
        await workflowService.duplicateWorkflow(workflowStore.activeWorkflow!)
      },
      visible: props.item.key === 'root'
    },
    {
      separator: true
    },
    {
      label: t('breadcrumbsMenu.clearWorkflow'),
      icon: 'pi pi-trash',
      command: async () => {
        await useCommandStore().execute('Comfy.ClearWorkflow')
      }
    },
    {
      separator: true,
      visible: props.item.key === 'root'
    },
    {
      label: t('breadcrumbsMenu.deleteWorkflow'),
      icon: 'pi pi-times',
      command: async () => {
        await workflowService.deleteWorkflow(workflowStore.activeWorkflow!)
      },
      visible: props.item.key === 'root'
    }
  ]
})

const handleClick = (event: MouseEvent) => {
  if (isEditing.value) {
    return
  }

  if (event.detail === 1) {
    if (props.isActive) {
      menu.value?.toggle(event)
    } else {
      props.item.command?.({ item: props.item, originalEvent: event })
    }
  } else if (props.isActive && event.detail === 2) {
    menu.value?.hide()
    event.stopPropagation()
    event.preventDefault()
    startRename()
  }
}

const startRename = () => {
  isEditing.value = true
  itemLabel.value = props.item.label as string
  void nextTick(() => {
    if (itemInputRef.value?.$el) {
      itemInputRef.value.$el.focus()
      itemInputRef.value.$el.select()
      if (wrapperRef.value) {
        itemInputRef.value.$el.style.width = `${Math.max(200, wrapperRef.value.offsetWidth)}px`
      }
    }
  })
}

const inputBlur = async (doRename: boolean) => {
  if (doRename) {
    await rename(itemLabel.value, props.item.label as string)
  }

  isEditing.value = false
}
</script>

<style scoped>
.p-breadcrumb-item-link,
.p-breadcrumb-item-icon {
  @apply select-none;
}

.p-breadcrumb-item-link {
  @apply overflow-hidden;
  padding: var(--p-breadcrumb-item-padding);
}

.p-breadcrumb-item-label {
  @apply whitespace-nowrap text-ellipsis overflow-hidden;
}

.active-breadcrumb-item {
  color: var(--text-primary);
}
</style>
