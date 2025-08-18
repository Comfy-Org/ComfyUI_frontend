<template>
  <SidebarTabTemplate :title="$t('sideToolbar.outputExplorer')">
    <template #tool-buttons>
      <Button
        v-tooltip.bottom="$t('g.back')"
        icon="pi pi-arrow-up"
        severity="secondary"
        text
        :disabled="!currentFolder"
        @click="handleBackParentFolder"
      />
      <Button
        v-tooltip.bottom="$t('g.refresh')"
        icon="pi pi-refresh"
        severity="secondary"
        text
        @click="loadFolderItems"
      />
    </template>
    <template #header>
      <SearchBox
        v-model:modelValue="searchQuery"
        class="model-lib-search-box p-2 2xl:p-4"
        :placeholder="$t('g.searchIn', ['output'])"
        @search="handleSearch"
      />
    </template>
    <template #body>
      <div class="h-full overflow-hidden">
        <ListExplorer
          class="flex-1"
          :style="{ height: 'calc(100% - 36px)' }"
          :items="renderedItems"
          @item-db-click="handleDbClickItem"
        ></ListExplorer>
        <div class="h-8 flex items-center px-2 text-sm">
          <div class="flex gap-1">
            {{ $t('g.itemsCount', [itemsCount]) }}
          </div>
        </div>
      </div>
    </template>
  </SidebarTabTemplate>

  <Teleport to="body">
    <div
      v-show="previewVisible"
      class="fixed left-0 top-0 z-[5000] flex h-full w-full items-center justify-center bg-black/70"
    >
      <div class="absolute right-3 top-3">
        <Button
          icon="pi pi-times"
          severity="secondary"
          rounded
          @click="closePreview"
        ></Button>
      </div>
      <div class="h-full w-full select-none p-10">
        <img
          v-if="currentItem?.type === 'image'"
          class="h-full w-full object-contain"
          :src="`/api/output/${folderPrefix}${currentItem?.name}`"
          alt="preview"
        />
        <video
          v-if="currentItem?.type === 'video'"
          class="h-full w-full object-contain"
          :src="`/api/output/${folderPrefix}${currentItem?.name}`"
          controls
        ></video>
        <div
          v-if="currentItem?.type === 'audio'"
          class="w-full h-full flex items-center justify-center"
        >
          <div
            class="px-8 pt-6 rounded-full"
            :style="{ background: 'var(--p-button-secondary-background)' }"
          >
            <div class="text-center mb-2">{{ currentItem?.name }}</div>
            <audio
              :src="`/api/output/${folderPrefix}${currentItem?.name}`"
              controls
            ></audio>
          </div>
        </div>
      </div>
      <div class="absolute left-2 top-1/2">
        <Button
          icon="pi pi-angle-left"
          severity="secondary"
          rounded
          @click="openPreviousItem"
        ></Button>
      </div>
      <div class="absolute right-2 top-1/2">
        <Button
          icon="pi pi-angle-right"
          severity="secondary"
          rounded
          @click="openNextItem"
        ></Button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'

import ListExplorer from '@/components/common/ListExplorer.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import { api } from '@/scripts/api'

interface OutputItem {
  key: string
  name: string
  type: 'folder' | 'image' | 'video' | 'audio'
  size: number
  createTime: number
  modifyTime: number
}

const searchQuery = ref<string>('')

const folderPaths = ref<OutputItem[]>([])
const currentFolder = computed(() => {
  return folderPaths.value.map((item) => item.name).join('/')
})
const currentFolderItems = ref<OutputItem[]>([])
const folderPrefix = computed(() => {
  return currentFolder.value ? `${currentFolder.value}/` : ''
})

const filterContent = ref('')

const itemsCount = computed(() => {
  return currentFolderItems.value.length.toLocaleString()
})

const renderedItems = computed(() => {
  const query = filterContent.value
  let items = currentFolderItems.value

  if (query) {
    items = items.filter((item) => {
      return item.name.toLowerCase().includes(query.toLowerCase())
    })
  }

  // Convert OutputItem to Item format expected by ListExplorer
  return items.map((item) => ({
    key: item.key,
    name: item.name,
    type: item.type,
    size: item.size,
    modifyTime: item.modifyTime
  }))
})

const handleSearch = async (query: string) => {
  filterContent.value = query
}

const previewVisible = ref(false)
const currentItem = ref<OutputItem | null>(null)
const currentItemIndex = ref(-1)
const currentTypeItems = ref<OutputItem[]>([])

const closePreview = () => {
  previewVisible.value = false
  currentItem.value = null
}

const openPreviousItem = () => {
  currentItemIndex.value--
  if (currentItemIndex.value < 0) {
    currentItemIndex.value = currentTypeItems.value.length - 1
  }
  const item = currentTypeItems.value[currentItemIndex.value]
  currentItem.value = item
}

const openNextItem = () => {
  currentItemIndex.value++
  if (currentItemIndex.value > currentTypeItems.value.length - 1) {
    currentItemIndex.value = 0
  }
  const item = currentTypeItems.value[currentItemIndex.value]
  currentItem.value = item
}

const openItemPreview = (item: OutputItem) => {
  previewVisible.value = true
  currentItem.value = item

  const itemType = item.type
  currentTypeItems.value = currentFolderItems.value.filter(
    (o) => o.type === itemType
  )

  currentItemIndex.value = currentTypeItems.value.indexOf(item)
}

const loadFolderItems = async () => {
  const resData = await api.getOutputFolderItems(currentFolder.value)
  currentFolderItems.value = resData.map((item: any) => ({
    key: item.name,
    ...item
  }))
}

const openFolder = async (item: OutputItem, pathIndex: number) => {
  folderPaths.value.splice(pathIndex)
  folderPaths.value.push(item)
  await loadFolderItems()
}

const handleBackParentFolder = async () => {
  folderPaths.value.pop()
  await loadFolderItems()
}

const handleDbClickItem = (item: any, _event: MouseEvent) => {
  // Find the original OutputItem from currentFolderItems
  const originalItem = currentFolderItems.value.find(
    (outputItem) => outputItem.key === item.key
  )
  if (!originalItem) return

  if (originalItem.type === 'folder') {
    void openFolder(originalItem, folderPaths.value.length)
  } else {
    openItemPreview(originalItem)
  }
}

onMounted(async () => {
  await loadFolderItems()
})
</script>

<style scoped>
:deep(.pi-fake-spacer) {
  height: 1px;
  width: 16px;
}

:deep(audio::-webkit-media-controls-enclosure) {
  background-color: inherit;
}
</style>
