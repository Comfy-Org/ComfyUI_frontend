<template>
  <a
    v-tooltip.bottom="item.label"
    href="#"
    class="cursor-pointer p-breadcrumb-item-link"
    :class="{
      'flex items-center gap-1': isActive,
      'p-breadcrumb-item-link-menu-visible': menu?.overlayVisible,
      'p-breadcrumb-item-link-icon-visible': item.icon || isActive
    }"
    @click="handleClick"
  >
    <i v-if="item.icon" :class="item.icon" class="p-breadcrumb-item-icon" />
    <span class="p-breadcrumb-item-label">{{ item.label }}</span>
    <i v-if="isActive" class="pi pi-chevron-down text-xs"></i>
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
</template>

<script setup lang="ts">
import Menu, { MenuState } from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import { computed, ref } from 'vue'
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
const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()

const menuItems = computed<MenuItem[]>(() => {
  return [
    {
      label: t('g.rename'),
      icon: 'pi pi-pencil',
      command: async () => {
        const dialogService = useDialogService()
        let initialName =
          workflowStore.activeSubgraph?.name ??
          workflowStore.activeWorkflow?.filename

        if (!initialName) return

        const newName = await dialogService.prompt({
          title: t('g.rename'),
          message: t('breadcrumbsMenu.enterNewName'),
          defaultValue: initialName
        })

        if (newName && newName !== initialName) {
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
            }
          }

          // Force the navigation stack to recompute the labels
          // TODO: investigate if there is a better way to do this
          const navigationStore = useSubgraphNavigationStore()
          navigationStore.restoreState(navigationStore.exportState())
        }
      }
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

const handleClick = (event: Event) => {
  if (props.isActive) {
    menu.value?.toggle(event)
  } else {
    props.item.command?.({ item: props.item, originalEvent: event })
  }
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
</style>
