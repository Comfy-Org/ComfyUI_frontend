<script setup lang="ts">
import { ref } from 'vue'
import WorkspaceViewHeader from '@/components/v2/workspace/WorkspaceViewHeader.vue'

interface TrashItem {
  id: string
  name: string
  type: 'canvas' | 'workflow' | 'asset' | 'project'
  icon: string
  deletedAt: string
  expiresIn: string
}

const trashItems = ref<TrashItem[]>([
  { id: '1', name: 'Old Canvas Draft', type: 'canvas', icon: 'pi-objects-column', deletedAt: '2 days ago', expiresIn: '28 days' },
  { id: '2', name: 'Test Workflow', type: 'workflow', icon: 'pi-sitemap', deletedAt: '5 days ago', expiresIn: '25 days' },
  { id: '3', name: 'unused_asset.png', type: 'asset', icon: 'pi-image', deletedAt: '1 week ago', expiresIn: '23 days' },
  { id: '4', name: 'Archived Project', type: 'project', icon: 'pi-folder', deletedAt: '2 weeks ago', expiresIn: '16 days' },
])

const selectedItems = ref<Set<string>>(new Set())

function toggleSelect(id: string): void {
  if (selectedItems.value.has(id)) {
    selectedItems.value.delete(id)
  } else {
    selectedItems.value.add(id)
  }
}

function selectAll(): void {
  if (selectedItems.value.size === trashItems.value.length) {
    selectedItems.value.clear()
  } else {
    trashItems.value.forEach(item => selectedItems.value.add(item.id))
  }
}

function restoreSelected(): void {
  trashItems.value = trashItems.value.filter(item => !selectedItems.value.has(item.id))
  selectedItems.value.clear()
}

function deleteSelected(): void {
  trashItems.value = trashItems.value.filter(item => !selectedItems.value.has(item.id))
  selectedItems.value.clear()
}

function emptyTrash(): void {
  trashItems.value = []
  selectedItems.value.clear()
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    canvas: 'Canvas',
    workflow: 'Workflow',
    asset: 'Asset',
    project: 'Project'
  }
  return labels[type] || type
}
</script>

<template>
  <div class="p-6">
    <WorkspaceViewHeader
      title="Trash"
      subtitle="Items are permanently deleted after 30 days"
      :show-create-buttons="false"
    />

    <!-- Actions Bar -->
    <div v-if="trashItems.length > 0" class="mb-4 flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            :checked="selectedItems.size === trashItems.length"
            :indeterminate="selectedItems.size > 0 && selectedItems.size < trashItems.length"
            class="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
            @change="selectAll"
          />
          Select all
        </label>
        <template v-if="selectedItems.size > 0">
          <span class="text-sm text-zinc-500">{{ selectedItems.size }} selected</span>
          <button
            class="flex items-center gap-1.5 rounded-md bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
            @click="restoreSelected"
          >
            <i class="pi pi-refresh text-[10px]" />
            Restore
          </button>
          <button
            class="flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/20"
            @click="deleteSelected"
          >
            <i class="pi pi-trash text-[10px]" />
            Delete forever
          </button>
        </template>
      </div>
      <button
        class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
        @click="emptyTrash"
      >
        <i class="pi pi-trash text-[10px]" />
        Empty trash
      </button>
    </div>

    <!-- Trash Items -->
    <div v-if="trashItems.length > 0" class="space-y-2">
      <div
        v-for="item in trashItems"
        :key="item.id"
        :class="[
          'flex items-center gap-4 rounded-lg border p-4 transition-colors',
          selectedItems.has(item.id)
            ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-500/10'
            : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50'
        ]"
      >
        <input
          type="checkbox"
          :checked="selectedItems.has(item.id)"
          class="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
          @change="toggleSelect(item.id)"
        />
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
          <i :class="['pi', item.icon, 'text-lg text-zinc-400']" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium text-zinc-900 dark:text-zinc-100">{{ item.name }}</span>
            <span class="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
              {{ getTypeLabel(item.type) }}
            </span>
          </div>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            Deleted {{ item.deletedAt }} · Expires in {{ item.expiresIn }}
          </p>
        </div>
        <div class="flex items-center gap-1">
          <button
            class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="Restore"
          >
            <i class="pi pi-refresh text-sm" />
          </button>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
            title="Delete forever"
          >
            <i class="pi pi-trash text-sm" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 dark:border-zinc-700">
      <div class="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <i class="pi pi-trash text-2xl text-zinc-400" />
      </div>
      <h3 class="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">Trash is empty</h3>
      <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Deleted items will appear here</p>
    </div>
  </div>
</template>
