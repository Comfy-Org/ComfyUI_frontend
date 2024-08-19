<template>
  <SideBarTabTemplate :title="$t('sideToolbar.queue')">
    <template #tool-buttons>
      <Button
        :icon="isExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
        text
        severity="secondary"
        @click="toggleExpanded"
        class="toggle-expanded-button"
        v-tooltip="$t('sideToolbar.queueTab.showFlatList')"
      />
      <Button
        icon="pi pi-trash"
        text
        severity="primary"
        @click="confirmRemoveAll($event)"
        class="clear-all-button"
      />
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
            :isFlatTask="isExpanded"
            @contextmenu="handleContextMenu"
            @preview="handlePreview"
          />
        </div>
        <div ref="loadMoreTrigger" style="height: 1px" />
      </div>
      <div v-else>
        <NoResultsPlaceholder
          icon="pi pi-info-circle"
          :title="$t('noTasksFound')"
          :message="$t('noTasksFoundMessage')"
        />
      </div>
    </template>
  </SideBarTabTemplate>
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
import TaskItem from './queue/TaskItem.vue'
import ResultGallery from './queue/ResultGallery.vue'
import SideBarTabTemplate from './SidebarTabTemplate.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'
import { api } from '@/scripts/api'

const confirm = useConfirm()
const toast = useToast()
const queueStore = useQueueStore()
const { t } = useI18n()

const isExpanded = ref(false)
const visibleTasks = ref<TaskItemImpl[]>([])
const scrollContainer = ref<HTMLElement | null>(null)
const loadMoreTrigger = ref<HTMLElement | null>(null)
const galleryActiveIndex = ref(-1)

const ITEMS_PER_PAGE = 8
const SCROLL_THRESHOLD = 100 // pixels from bottom to trigger load

const allTasks = computed(() =>
  isExpanded.value ? queueStore.flatTasks : queueStore.tasks
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

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
  visibleTasks.value = allTasks.value.slice(0, ITEMS_PER_PAGE)
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
  visibleTasks.value = allTasks.value.slice(0, ITEMS_PER_PAGE)
}

const menu = ref(null)
const menuTargetTask = ref<TaskItemImpl | null>(null)
const menuItems = computed<MenuItem[]>(() => [
  {
    label: t('delete'),
    icon: 'pi pi-trash',
    command: () => menuTargetTask.value && removeTask(menuTargetTask.value)
  },
  {
    label: t('loadWorkflow'),
    icon: 'pi pi-file-export',
    command: () => menuTargetTask.value?.loadWorkflow()
  }
])

const handleContextMenu = ({
  task,
  event
}: {
  task: TaskItemImpl
  event: Event
}) => {
  menuTargetTask.value = task
  menu.value?.show(event)
}

const handlePreview = (task: TaskItemImpl) => {
  galleryActiveIndex.value = allGalleryItems.value.findIndex(
    (item) => item.url === task.previewOutput?.url
  )
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
      visibleTasks.value = newTasks.slice(0, ITEMS_PER_PAGE)
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

.queue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  padding: 0.5rem;
  gap: 0.5rem;
}
</style>
