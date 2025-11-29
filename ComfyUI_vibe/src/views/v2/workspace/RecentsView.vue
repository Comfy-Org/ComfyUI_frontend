<script setup lang="ts">
import { ref } from 'vue'
import WorkspaceViewHeader from '@/components/v2/workspace/WorkspaceViewHeader.vue'

interface RecentItem {
  id: string
  name: string
  type: 'canvas' | 'workflow' | 'asset' | 'project'
  icon: string
  updatedAt: string
  thumbnail?: string
}

const recentItems = ref<RecentItem[]>([
  { id: '1', name: 'Portrait Generation', type: 'canvas', icon: 'pi-objects-column', updatedAt: '2 minutes ago' },
  { id: '2', name: 'SDXL Workflow', type: 'workflow', icon: 'pi-sitemap', updatedAt: '15 minutes ago' },
  { id: '3', name: 'Product Shots', type: 'project', icon: 'pi-folder', updatedAt: '1 hour ago' },
  { id: '4', name: 'reference_image.png', type: 'asset', icon: 'pi-image', updatedAt: '2 hours ago' },
  { id: '5', name: 'Inpainting Canvas', type: 'canvas', icon: 'pi-objects-column', updatedAt: '3 hours ago' },
  { id: '6', name: 'ControlNet Pipeline', type: 'workflow', icon: 'pi-sitemap', updatedAt: '5 hours ago' },
  { id: '7', name: 'Marketing Assets', type: 'project', icon: 'pi-folder', updatedAt: 'Yesterday' },
  { id: '8', name: 'logo_v2.png', type: 'asset', icon: 'pi-image', updatedAt: 'Yesterday' },
])

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    canvas: 'Canvas',
    workflow: 'Workflow',
    asset: 'Asset',
    project: 'Project'
  }
  return labels[type] || type
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    canvas: 'bg-blue-500/20 text-blue-400',
    workflow: 'bg-purple-500/20 text-purple-400',
    asset: 'bg-green-500/20 text-green-400',
    project: 'bg-amber-500/20 text-amber-400'
  }
  return colors[type] || 'bg-zinc-500/20 text-zinc-400'
}
</script>

<template>
  <div class="p-6">
    <WorkspaceViewHeader
      title="Recents"
      subtitle="Recently accessed items"
      :show-create-buttons="true"
    />

    <div class="space-y-2">
      <div
        v-for="item in recentItems"
        :key="item.id"
        class="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
      >
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
          <i :class="['pi', item.icon, 'text-lg text-zinc-500 dark:text-zinc-400']" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium text-zinc-900 dark:text-zinc-100">{{ item.name }}</span>
            <span :class="['rounded px-1.5 py-0.5 text-[10px] font-medium', getTypeColor(item.type)]">
              {{ getTypeLabel(item.type) }}
            </span>
          </div>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">{{ item.updatedAt }}</p>
        </div>
        <button class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
          <i class="pi pi-ellipsis-v text-sm" />
        </button>
      </div>
    </div>
  </div>
</template>
