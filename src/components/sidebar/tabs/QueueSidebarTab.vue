<template>
  <SidebarTabTemplate :title="$t('sideToolbar.queue')">
    <template #tool-buttons>
      <Button
        :icon="
          imageFit === 'cover'
            ? 'pi pi-arrow-down-left-and-arrow-up-right-to-center'
            : 'pi pi-arrow-up-right-and-arrow-down-left-from-center'
        "
        text
        severity="secondary"
        @click="toggleImageFit"
        class="toggle-expanded-button"
        v-tooltip="$t(`sideToolbar.queueTab.${imageFit}ImagePreview`)"
      />
      <Button
        v-if="isInFolderView"
        icon="pi pi-arrow-left"
        text
        severity="secondary"
        @click="exitFolderView"
        class="back-button"
        v-tooltip="$t('sideToolbar.queueTab.backToAllTasks')"
      />
      <template v-else>
        <Button
          :icon="isExpanded ? 'pi pi-images' : 'pi pi-image'"
          text
          severity="secondary"
          @click="toggleExpanded"
          class="toggle-expanded-button"
          v-tooltip="$t('sideToolbar.queueTab.showFlatList')"
        />
        <Button
          v-if="queueStore.hasPendingTasks"
          icon="pi pi-stop"
          severity="danger"
          text
          @click="() => commandStore.execute('Comfy.ClearPendingTasks')"
          v-tooltip.bottom="$t('sideToolbar.queueTab.clearPendingTasks')"
        />
        <Button
          icon="pi pi-trash"
          text
          severity="primary"
          @click="confirmRemoveAll($event)"
          class="clear-all-button"
        />
      </template>
    </template>
    <template #body>
      <div
        v-if="visibleTasks.length > 0"
        ref="scrollContainer"
        class="scroll-container"
      >
        <div class="queue-grid">
          <TaskItem
            v-for="task in visibleTasks"
            :key="task.key"
            :task="task"
            :isFlatTask="isExpanded || isInFolderView"
            @contextmenu="handleContextMenu"
            @preview="handlePreview"
            @taskOutputLengthClicked="enterFolderView($event)"
          />
        </div>
        <div ref="loadMoreTrigger" style="height: 1px" />
      </div>
      <div v-else-if="queueStore.isLoading">
        <ProgressSpinner
          style="width: 50px; left: 50%; transform: translateX(-50%)"
        />
      </div>
      <div v-else>
        <NoResultsPlaceholder
          icon="pi pi-info-circle"
          :title="$t('noTasksFound')"
          :message="$t('noTasksFoundMessage')"
        />
      </div>
    </template>
  </SidebarTabTemplate>
  <ConfirmPopup />
  <ContextMenu ref="menu" :model="menuItems" />
  <ResultGallery
    v-model:activeIndex="galleryActiveIndex"
    :allGalleryItems="allGalleryItems"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useInfiniteScroll, useResizeObserver } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import ConfirmPopup from 'primevue/confirmpopup'
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem } from 'primevue/menuitem'
import ProgressSpinner from 'primevue/progressspinner'
import TaskItem from './queue/TaskItem.vue'
import ResultGallery from './queue/ResultGallery.vue'
import SidebarTabTemplate from './SidebarTabTemplate.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'
import { api } from '@/scripts/api'
import { ComfyNode } from '@/types/comfyWorkflow'
import { useSettingStore } from '@/stores/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { app } from '@/scripts/app'

const IMAGE_FIT = 'Comfy.Queue.ImageFit'
const confirm = useConfirm()
const toast = useToast()
const queueStore = useQueueStore()
const settingStore = useSettingStore()
const commandStore = useCommandStore()
const { t } = useI18n()

// Expanded view: show all outputs in a flat list.
const isExpanded = ref(false)
const visibleTasks = ref<TaskItemImpl[]>([])
const scrollContainer = ref<HTMLElement | null>(null)
const loadMoreTrigger = ref<HTMLElement | null>(null)
const galleryActiveIndex = ref(-1)
// Folder view: only show outputs from a single selected task.
const folderTask = ref<TaskItemImpl | null>(null)
const isInFolderView = computed(() => folderTask.value !== null)
const imageFit = computed<string>(() => settingStore.get(IMAGE_FIT))

const ITEMS_PER_PAGE = 8
const SCROLL_THRESHOLD = 100 // pixels from bottom to trigger load

const allTasks = computed(() =>
  isInFolderView.value
    ? folderTask.value
      ? folderTask.value.flatten()
      : []
    : isExpanded.value
      ? queueStore.flatTasks
      : queueStore.tasks
)
const allGalleryItems = computed(() =>
  allTasks.value.flatMap((task: TaskItemImpl) => {
    const previewOutput = task.previewOutput
    return previewOutput ? [previewOutput] : []
  })
)

const loadMoreItems = () => {
  const currentLength = visibleTasks.value.length
  const newTasks = allTasks.value.slice(
    currentLength,
    currentLength + ITEMS_PER_PAGE
  )
  visibleTasks.value.push(...newTasks)
}

const checkAndLoadMore = () => {
  if (!scrollContainer.value) return

  const { scrollHeight, scrollTop, clientHeight } = scrollContainer.value
  if (scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD) {
    loadMoreItems()
  }
}

useInfiniteScroll(
  scrollContainer,
  () => {
    if (visibleTasks.value.length < allTasks.value.length) {
      loadMoreItems()
    }
  },
  { distance: SCROLL_THRESHOLD }
)

// Use ResizeObserver to detect container size changes
// This is necessary as the sidebar tab can change size when user drags the splitter.
useResizeObserver(scrollContainer, () => {
  nextTick(() => {
    checkAndLoadMore()
  })
})

const updateVisibleTasks = () => {
  visibleTasks.value = allTasks.value.slice(0, ITEMS_PER_PAGE)
}

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
  updateVisibleTasks()
}

const removeTask = (task: TaskItemImpl) => {
  if (task.isRunning) {
    api.interrupt()
  }
  queueStore.delete(task)
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

const onStatus = async () => {
  await queueStore.update()
  updateVisibleTasks()
}

const menu = ref(null)
const menuTargetTask = ref<TaskItemImpl | null>(null)
const menuTargetNode = ref<ComfyNode | null>(null)
const menuItems = computed<MenuItem[]>(() => [
  {
    label: t('delete'),
    icon: 'pi pi-trash',
    command: () => menuTargetTask.value && removeTask(menuTargetTask.value),
    disabled: isExpanded.value || isInFolderView.value
  },
  {
    label: t('loadWorkflow'),
    icon: 'pi pi-file-export',
    command: () => menuTargetTask.value?.loadWorkflow(app),
    disabled: !menuTargetTask.value?.workflow
  },
  {
    label: t('goToNode'),
    icon: 'pi pi-arrow-circle-right',
    command: () => app.goToNode(menuTargetNode.value?.id),
    visible: !!menuTargetNode.value
  }
])

const handleContextMenu = ({
  task,
  event,
  node
}: {
  task: TaskItemImpl
  event: Event
  node?: ComfyNode
}) => {
  menuTargetTask.value = task
  menuTargetNode.value = node
  menu.value?.show(event)
}

const handlePreview = (task: TaskItemImpl) => {
  galleryActiveIndex.value = allGalleryItems.value.findIndex(
    (item) => item.url === task.previewOutput?.url
  )
}

const enterFolderView = (task: TaskItemImpl) => {
  folderTask.value = task
  updateVisibleTasks()
}

const exitFolderView = () => {
  folderTask.value = null
  updateVisibleTasks()
}

const toggleImageFit = () => {
  settingStore.set(IMAGE_FIT, imageFit.value === 'cover' ? 'contain' : 'cover')
}

onMounted(() => {
  api.addEventListener('status', onStatus)
  queueStore.update()
})

onUnmounted(() => {
  api.removeEventListener('status', onStatus)
})

// Watch for changes in allTasks and reset visibleTasks if necessary
watch(
  allTasks,
  (newTasks) => {
    if (
      visibleTasks.value.length === 0 ||
      visibleTasks.value.length > newTasks.length
    ) {
      updateVisibleTasks()
    }

    nextTick(() => {
      checkAndLoadMore()
    })
  },
  { immediate: true }
)
</script>

<style scoped>
.scroll-container {
  height: 100%;
  overflow-y: auto;
}

.scroll-container::-webkit-scrollbar {
  width: 1px;
}

.scroll-container::-webkit-scrollbar-thumb {
  background-color: transparent;
}

.queue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  padding: 0.5rem;
  gap: 0.5rem;
}
</style>
