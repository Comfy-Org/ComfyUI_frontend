<template>
  <SidebarTabTemplate :title="$t('sideToolbar.queue')">
    <template #tool-buttons>
      <Button
        v-tooltip.bottom="$t(`sideToolbar.queueTab.${imageFit}ImagePreview`)"
        :icon="
          imageFit === 'cover'
            ? 'pi pi-arrow-down-left-and-arrow-up-right-to-center'
            : 'pi pi-arrow-up-right-and-arrow-down-left-from-center'
        "
        text
        severity="secondary"
        class="toggle-expanded-button"
        @click="toggleImageFit"
      />
      <Button
        v-if="isInFolderView"
        v-tooltip.bottom="$t('sideToolbar.queueTab.backToAllTasks')"
        icon="pi pi-arrow-left"
        text
        severity="secondary"
        class="back-button"
        @click="exitFolderView"
      />
      <template v-else>
        <Button
          v-tooltip="$t('sideToolbar.queueTab.showFlatList')"
          :icon="isExpanded ? 'pi pi-images' : 'pi pi-image'"
          text
          severity="secondary"
          class="toggle-expanded-button"
          @click="toggleExpanded"
        />
        <Button
          v-if="queueStore.hasPendingTasks"
          v-tooltip.bottom="$t('sideToolbar.queueTab.clearPendingTasks')"
          icon="pi pi-stop"
          severity="danger"
          text
          @click="() => commandStore.execute('Comfy.ClearPendingTasks')"
        />
        <Button
          icon="pi pi-trash"
          text
          severity="primary"
          class="clear-all-button"
          @click="confirmRemoveAll($event)"
        />
      </template>
    </template>
    <template #body>
      <VirtualGrid
        v-if="allTasks?.length"
        :items="allTasks"
        :grid-style="{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          padding: '0.5rem',
          gap: '0.5rem'
        }"
      >
        <template #item="{ item }">
          <TaskItem
            :task="item"
            :is-flat-task="isExpanded || isInFolderView"
            @contextmenu="handleContextMenu"
            @preview="handlePreview"
            @task-output-length-clicked="enterFolderView($event)"
          />
        </template>
      </VirtualGrid>
      <div v-else-if="queueStore.isLoading">
        <ProgressSpinner
          style="width: 50px; left: 50%; transform: translateX(-50%)"
        />
      </div>
      <div v-else>
        <NoResultsPlaceholder
          icon="pi pi-info-circle"
          :title="$t('g.noTasksFound')"
          :message="$t('g.noTasksFoundMessage')"
        />
      </div>
    </template>
  </SidebarTabTemplate>
  <ConfirmPopup />
  <ContextMenu ref="menu" :model="menuItems" />
  <ResultGallery
    v-model:activeIndex="galleryActiveIndex"
    :all-gallery-items="allGalleryItems"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ConfirmPopup from 'primevue/confirmpopup'
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem } from 'primevue/menuitem'
import ProgressSpinner from 'primevue/progressspinner'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import { ComfyNode } from '@/schemas/comfyWorkflowSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { useCommandStore } from '@/stores/commandStore'
import {
  ResultItemImpl,
  TaskItemImpl,
  useQueueStore
} from '@/stores/queueStore'
import { useSettingStore } from '@/stores/settingStore'

import SidebarTabTemplate from './SidebarTabTemplate.vue'
import ResultGallery from './queue/ResultGallery.vue'
import TaskItem from './queue/TaskItem.vue'

const IMAGE_FIT = 'Comfy.Queue.ImageFit'
const confirm = useConfirm()
const toast = useToast()
const queueStore = useQueueStore()
const settingStore = useSettingStore()
const commandStore = useCommandStore()
const { t } = useI18n()

// Expanded view: show all outputs in a flat list.
const isExpanded = ref(false)
const galleryActiveIndex = ref(-1)
const allGalleryItems = shallowRef<ResultItemImpl[]>([])
// Folder view: only show outputs from a single selected task.
const folderTask = ref<TaskItemImpl | null>(null)
const isInFolderView = computed(() => folderTask.value !== null)
const imageFit = computed<string>(() => settingStore.get(IMAGE_FIT))

const allTasks = computed(() =>
  isInFolderView.value
    ? folderTask.value
      ? folderTask.value.flatten()
      : []
    : isExpanded.value
      ? queueStore.flatTasks
      : queueStore.tasks
)
const updateGalleryItems = () => {
  allGalleryItems.value = allTasks.value.flatMap((task: TaskItemImpl) => {
    const previewOutput = task.previewOutput
    return previewOutput ? [previewOutput] : []
  })
}

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}

const removeTask = async (task: TaskItemImpl) => {
  if (task.isRunning) {
    await api.interrupt()
  }
  await queueStore.delete(task)
}

const removeAllTasks = async () => {
  await queueStore.clear()
}

const confirmRemoveAll = (event: Event) => {
  confirm.require({
    target: event.currentTarget as HTMLElement,
    message: 'Do you want to delete all tasks?',
    icon: 'pi pi-info-circle',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true
    },
    acceptProps: {
      label: 'Delete',
      severity: 'danger'
    },
    accept: async () => {
      await removeAllTasks()
      toast.add({
        severity: 'info',
        summary: 'Confirmed',
        detail: 'Tasks deleted',
        life: 3000
      })
    }
  })
}

const menu = ref<InstanceType<typeof ContextMenu> | null>(null)
const menuTargetTask = ref<TaskItemImpl | null>(null)
const menuTargetNode = ref<ComfyNode | null>(null)
const menuItems = computed<MenuItem[]>(() => [
  {
    label: t('g.delete'),
    icon: 'pi pi-trash',
    command: () => menuTargetTask.value && removeTask(menuTargetTask.value),
    disabled: isExpanded.value || isInFolderView.value
  },
  {
    label: t('g.loadWorkflow'),
    icon: 'pi pi-file-export',
    command: () => menuTargetTask.value?.loadWorkflow(app),
    disabled: !menuTargetTask.value?.workflow
  },
  {
    label: t('g.goToNode'),
    icon: 'pi pi-arrow-circle-right',
    command: () => {
      if (!menuTargetNode.value) return

      useLitegraphService().goToNode(menuTargetNode.value.id)
    },
    visible: !!menuTargetNode.value
  },
  {
    label: t('g.setAsBackground'),
    icon: 'pi pi-image',
    command: () => {
      const url = menuTargetTask.value?.previewOutput?.url
      if (url) {
        void settingStore.set('Comfy.Canvas.BackgroundImage', url)
      }
    }
  }
])

const handleContextMenu = ({
  task,
  event,
  node
}: {
  task: TaskItemImpl
  event: Event
  node: ComfyNode | null
}) => {
  menuTargetTask.value = task
  menuTargetNode.value = node
  menu.value?.show(event)
}

const handlePreview = (task: TaskItemImpl) => {
  updateGalleryItems()
  galleryActiveIndex.value = allGalleryItems.value.findIndex(
    (item) => item.url === task.previewOutput?.url
  )
}

const enterFolderView = (task: TaskItemImpl) => {
  folderTask.value = task
}

const exitFolderView = () => {
  folderTask.value = null
}

const toggleImageFit = async () => {
  await settingStore.set(
    IMAGE_FIT,
    imageFit.value === 'cover' ? 'contain' : 'cover'
  )
}

watch(allTasks, () => {
  const isGalleryOpen = galleryActiveIndex.value !== -1
  if (!isGalleryOpen) return

  const prevLength = allGalleryItems.value.length
  updateGalleryItems()
  const lengthChange = allGalleryItems.value.length - prevLength
  if (!lengthChange) return

  const newIndex = galleryActiveIndex.value + lengthChange
  galleryActiveIndex.value = Math.max(0, newIndex)
})
</script>
