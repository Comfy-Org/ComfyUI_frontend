<script setup lang="ts">
import { ref } from 'vue'

type LinearTab = 'chat' | 'tool' | 'apps' | 'workflow'

const activeTab = ref<LinearTab>('tool')

const tabs: Array<{ id: LinearTab; icon: string; label: string }> = [
  { id: 'chat', icon: 'pi-sparkles', label: 'Chat' },
  { id: 'tool', icon: 'pi-sliders-h', label: 'Tool' },
  { id: 'apps', icon: 'pi-th-large', label: 'Apps' },
  { id: 'workflow', icon: 'pi-sitemap', label: 'Workflow' },
]

const emit = defineEmits<{
  'update:activeTab': [tab: LinearTab]
}>()

function selectTab(tab: LinearTab): void {
  activeTab.value = tab
  emit('update:activeTab', tab)
}
</script>

<template>
  <aside class="flex h-full w-12 flex-col items-center border-r border-zinc-800 bg-zinc-900 py-2">
    <!-- Tab Buttons -->
    <div class="flex flex-col gap-1">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        v-tooltip.right="tab.label"
        :class="[
          'flex h-10 w-10 flex-col items-center justify-center rounded-lg transition-colors',
          activeTab === tab.id
            ? 'bg-zinc-800 text-zinc-100'
            : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
        ]"
        @click="selectTab(tab.id)"
      >
        <i :class="['pi', tab.icon, 'text-base']" />
      </button>
    </div>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Bottom Actions -->
    <div class="flex flex-col gap-1">
      <button
        v-tooltip.right="'Settings'"
        class="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-zinc-300"
      >
        <i class="pi pi-cog text-base" />
      </button>
    </div>
  </aside>
</template>
